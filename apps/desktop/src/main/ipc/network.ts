import { session } from 'electron'
import { IpcChannel } from '../types/ipc'
import { extensionOrchestrator } from '../services/extension.service'
import { NetworkConfig } from '@common/config/network'
import { registerHandler, wrapIpc, isValidUrl } from './utils'
import { cacheManager, CacheGroup } from '../services/cache.service'

export function registerNetworkHandlers() {
  registerHandler(
    IpcChannel.FETCH_REPO,
    wrapIpc(async (_, url: string) => {
      if (!isValidUrl(url)) throw new Error('Invalid URL')
      const headers = { 'User-Agent': NetworkConfig.DEFAULT_UA }
      const response = await extensionOrchestrator.fetch(url, { headers })
      if (!response.ok)
        throw new Error(`Failed to fetch repo: ${response.status} ${response.statusText}`)
      return response.json()
    })
  )

  registerHandler(
    IpcChannel.FETCH_TEXT,
    wrapIpc(async (_, url: string, options?: any) => {
      if (!isValidUrl(url)) throw new Error('Invalid URL')
      console.log(`[FetchText] → ${url}`)
      try {
        const response = await extensionOrchestrator.fetch(url, options || {})
        const data = await response.text()
        console.log(`[FetchText] ← ${url} status=${response.status} bodyLen=${data.length}`)

        // Ensure only serializable data is returned
        return {
          data,
          status: Number(response.status),
          ok: Boolean(response.ok)
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error(`[FetchText] ✗ ${url}:`, msg)
        throw e
      }
    })
  )

  registerHandler(
    IpcChannel.CLEAR_CACHE,
    wrapIpc(async () => {
      await session.defaultSession.clearCache()
      await cacheManager.invalidate(CacheGroup.IMAGES)
      await cacheManager.cleanup() // Trigger global cleanup
      return { success: true }
    })
  )

  registerHandler(
    IpcChannel.CLEAR_COOKIES,
    wrapIpc(async () => {
      await session.defaultSession.clearStorageData({ storages: ['cookies'] })
      return { success: true }
    })
  )
}

