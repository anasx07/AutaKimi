import {
  ElectronApi,
  Extension,
  StateUpdateEvent
} from '@common/types'
import { MobileDB } from './db'
import { MobileNetwork } from './network'
import { MobileExtension } from './extension'
import { MobileDownload } from './download'

// MobileApi is a pure object export here.
// Initialization should be explicitly called via the init() method.

export const MobileApi: ElectronApi = {
  init: () => MobileDB.init(),
  db: MobileDB,

  fetchRepo: (url: string) => MobileNetwork.fetchRepo(url),
  fetchText: (url: string, options?: any) => MobileNetwork.fetchText(url, options) as any,
  detectTheme: (url: string) => MobileExtension.detectTheme(url),

  executeExtension: (args: { pkg: string; code: string; contextArgs?: Record<string, unknown> }) =>
    MobileExtension.execute(args),

  installExtension: (ext: Extension, repoUrl: string) => MobileExtension.install(ext, repoUrl),

  clearCache: async () => {
    // Cache clearing logic can be added here if needed (e.g. clearing local storage)
    return { ok: true, value: { success: true } }
  },

  clearCookies: () => MobileNetwork.clearCookies() as any,

  openExternal: async (url: string) => {
    window.open(url, '_blank')
  },

  openInternalBrowser: async (url: string) => {
    await MobileNetwork.cfBypass(url)
  },

  cfBypass: (url: string) => MobileNetwork.cfBypass(url),
  cfFetchHtml: (url: string) =>
    MobileNetwork.fetchText(url).then((r) => {
      if (r.ok) return { ok: true, value: r.value.data }
      return { ok: false, error: r.error }
    }),

  download: MobileDownload,

  window: {
    minimize: async () => {},
    maximize: async () => {},
    restore: async () => {},
    close: async () => {},
    isMaximized: async () => ({ ok: true, value: true }),
    updateOverlay: async () => {}
  },

  onAppUpdate: () => () => {},
  onDownloadEvent: (callback: any) => {
    MobileDownload.onEvent(callback)
    return () => MobileDownload.onEvent(() => {})
  },
  onCfStatus: () => () => {},
  onCacheInvalidate: () => () => {},
  getSystemState: () => Promise.resolve({ ok: true, value: { activeDownloads: {} } }),
  onSystemStateUpdate: (callback: (data: StateUpdateEvent) => void) => {
    // Bridge MobileDownload events to the renderer's SystemState format
    const handler = (evt: any) => {
      const statusMap: Record<string, any> = {
        start: 'downloading',
        progress: 'downloading',
        completed: 'completed',
        error: 'error',
        canceled: 'canceled'
      }

      callback({
        type: 'active_tasks_update',
        task: {
          mangaId: evt.mangaId,
          chapterId: evt.chapterId,
          status: statusMap[evt.type as string] || 'downloading',
          cached: evt.cached || 0,
          total: evt.total || 0,
          error: evt.error,
          type: 'manga'
        }
      })
    }

    MobileDownload.onEvent(handler)
    return () => MobileDownload.onEvent(() => {})
  },

  installUpdate: async () => {},
  checkForUpdates: async () => {},

  platform: 'android',
  version: '1.0.0'
}
