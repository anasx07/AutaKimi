import { ipcMain, session } from 'electron'
import { IpcChannel } from '../types/ipc'
import { extensionOrchestrator } from '../services/extension.service'
import { NetworkConfig } from '../../common/config/network'
import { settingsRepo } from '../db'
import { wrapIpc, isValidUrl } from './utils'
import { CacheManager, CacheGroup } from '../services/cache.service'

export function registerNetworkHandlers() {
  ipcMain.handle(
    IpcChannel.FETCH_REPO,
    wrapIpc(async (_, url: string) => {
      if (!isValidUrl(url)) throw new Error('Invalid URL')
      const bypassCf = (await settingsRepo.get('bypass_cloudflare')) === 'true'
      const headers = { 'User-Agent': NetworkConfig.DEFAULT_UA }
      const response = await extensionOrchestrator.fetch(url, { headers }, bypassCf)
      if (!response.ok)
        throw new Error(`Failed to fetch repo: ${response.status} ${response.statusText}`)
      return response.json()
    })
  )

  ipcMain.handle(
    IpcChannel.FETCH_TEXT,
    wrapIpc(async (_, url: string, options?: any) => {
      if (!isValidUrl(url)) throw new Error('Invalid URL')
      const bypassCf = options?.bypassCf ?? (await settingsRepo.get('bypass_cloudflare')) === 'true'
      console.log(`[FetchText] → ${url} (bypassCf=${bypassCf})`)
      try {
        const response = await extensionOrchestrator.fetch(url, options || {}, bypassCf)
        const data = await response.text()
        console.log(`[FetchText] ← ${url} status=${response.status} bodyLen=${data.length}`)
        return { data, status: response.status, ok: response.ok }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error(`[FetchText] ✗ ${url}:`, msg)
        throw e
      }
    })
  )

  ipcMain.handle(
    IpcChannel.CLEAR_CACHE,
    wrapIpc(async () => {
      await session.defaultSession.clearCache()
      await CacheManager.getInstance().invalidate(CacheGroup.IMAGES)
      await CacheManager.getInstance().cleanup() // Trigger global cleanup
      return true
    })
  )

  ipcMain.handle(
    IpcChannel.CLEAR_COOKIES,
    wrapIpc(async () => {
      await session.defaultSession.clearStorageData({ storages: ['cookies'] })
      return true
    })
  )
}
