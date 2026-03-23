import { ipcMain, session } from 'electron'
import { IpcChannel } from '../types/ipc'
import { extensionOrchestrator } from '../services/extension.service'
import { settingsRepo } from '../db'
import { imageCache } from '../index'

export function registerNetworkHandlers() {
  ipcMain.handle(IpcChannel.FETCH_REPO, async (_, url: string) => {
    try {
      console.log('[fetch-repo] IPC calling URL:', url)
      const bypassCfValue = await settingsRepo.get('bypass_cloudflare')
      const bypassCf = bypassCfValue === 'true'

      const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
      const response = await extensionOrchestrator.fetch(url, { headers }, bypassCf)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch repo: ${response.status} ${response.statusText}`)
      }
      const data = await response.json()
      return { ok: true, value: data }
    } catch (error: any) {
      console.error('Error fetching repo IPC:', error)
      return { ok: false, error: error instanceof Error ? error.message : 'Unknown error fetching repository' }
    }
  })

  ipcMain.handle(IpcChannel.FETCH_TEXT, async (_, url: string, options?: any) => {
    try {
      const bypassCfValue = await settingsRepo.get('bypass_cloudflare')
      const bypassCf = bypassCfValue === 'true'

      const response = await extensionOrchestrator.fetch(url, options || {}, bypassCf)
      const text = await response.text()
      return { 
        ok: true, 
        value: { data: text, status: response.status, ok: response.ok } 
      }
    } catch (error: any) {
      return { ok: false, error: error.message || 'Unknown network error' }
    }
  })

  ipcMain.handle(IpcChannel.CLEAR_CACHE, async () => {
    try {
      await session.defaultSession.clearCache()
      if (imageCache) await imageCache.clear()
      return { ok: true, value: true }
    } catch (error: any) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle(IpcChannel.CLEAR_COOKIES, async () => {
    try {
      await session.defaultSession.clearStorageData({ storages: ['cookies'] })
      return { ok: true, value: true }
    } catch (error: any) {
      return { ok: false, error: error.message }
    }
  })
}
