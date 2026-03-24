import { ipcMain, session } from 'electron'
import { IpcChannel } from '../types/ipc'
import { extensionOrchestrator } from '../services/extension.service'
import { NetworkConfig } from '../../common/config/network'
import { settingsRepo } from '../db'
import { wrapIpc } from './utils'
import { imageCache } from '../index'

export function registerNetworkHandlers() {
  ipcMain.handle(IpcChannel.FETCH_REPO, wrapIpc(async (_, url: string) => {
    const bypassCf = (await settingsRepo.get('bypass_cloudflare')) === 'true'
    const headers = { 'User-Agent': NetworkConfig.DEFAULT_UA }
    const response = await extensionOrchestrator.fetch(url, { headers }, bypassCf)
    if (!response.ok) throw new Error(`Failed to fetch repo: ${response.status} ${response.statusText}`)
    return response.json()
  }))

  ipcMain.handle(IpcChannel.FETCH_TEXT, wrapIpc(async (_, url: string, options?: any) => {
    const bypassCf = options?.bypassCf ?? ((await settingsRepo.get('bypass_cloudflare')) === 'true')
    const response = await extensionOrchestrator.fetch(url, options || {}, bypassCf)
    return { data: await response.text(), status: response.status, ok: response.ok }
  }))

  ipcMain.handle(IpcChannel.CLEAR_CACHE, wrapIpc(async () => {
    await session.defaultSession.clearCache()
    if (imageCache) await imageCache.clear()
    return true
  }))

  ipcMain.handle(IpcChannel.CLEAR_COOKIES, wrapIpc(async () => {
    await session.defaultSession.clearStorageData({ storages: ['cookies'] })
    return true
  }))
}
