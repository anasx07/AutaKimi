import { ElectronApi, IpcResult, FetchOptions, Extension, StateUpdateEvent, SystemState, ActiveTaskState } from '@common/types'
import { MobileDB } from './db.native'
import { MobileNetwork, setCfStatusCallback } from './network.native'
import { MobileExtension } from './extension.native'
import { MobileDownload } from './download.native'
import { MobileCache, setCacheInvalidateCallback } from './cache.native'
import { identityService } from './identity.native'
import { mobileBypassProvider } from './bypass.native'
import Constants from 'expo-constants'
import * as WebBrowser from 'expo-web-browser'

type Callback = (data: any) => void

const cfStatusCallbacks = new Set<Callback>()
const cacheInvalidateCallbacks = new Set<Callback>()

function notifyCfStatus(status: 'started' | 'completed' | 'failed', domain?: string): void {
  cfStatusCallbacks.forEach((cb) => cb({ status, domain }))
}

function notifyCacheInvalidate(group: string, key?: string): void {
  cacheInvalidateCallbacks.forEach((cb) => cb({ group, key }))
}

// Wire callbacks from backend modules to the event registries
setCfStatusCallback((data) => notifyCfStatus(data.status, data.domain))
setCacheInvalidateCallback((data) => notifyCacheInvalidate(data.group, data.key))

export const MobileApi: ElectronApi = {
  init: async () => {
    await MobileDB.init()
    await identityService.initialize()
    mobileBypassProvider.initialize()
    return { ok: true, value: undefined }
  },
  db: MobileDB as unknown as ElectronApi['db'],

  fetchRepo: (url: string) => MobileNetwork.fetchRepo(url),
  fetchText: (url: string, options?: FetchOptions) => MobileNetwork.fetchText(url, options),

  executeExtension: (args: { pkg: string; code: string; contextArgs?: Record<string, unknown> }) =>
    MobileExtension.execute(args),

  cancelExtensionExecution: async (taskId: string) => {
    return { ok: true, value: true }
  },

  installExtension: async (ext: Extension, repoUrl: string): Promise<IpcResult<{ success: boolean }>> => {
    const KEI_REPO = 'https://raw.githubusercontent.com/keiyoushi/extensions-source/main'
    const baseUrl = repoUrl === 'local' ? KEI_REPO : repoUrl.replace('/index.min.json', '')

    try {
      const res = await MobileNetwork.fetchText(`${baseUrl}/js/${ext.pkg}.js`)
      if (res.ok) {
        await MobileDB.addExtension({
          pkg: ext.pkg,
          code: res.value.data,
          name: ext.name,
          baseUrl: ext.baseUrl,
          lang: ext.lang,
          icon: ext.icon,
          version: ext.version
        })
        return { ok: true, value: { success: true } }
      }
      return { ok: false, error: res.error || 'Failed to fetch extension code' }
    } catch (err: any) {
      return { ok: false, error: err.message || String(err) }
    }
  },

  clearCache: async () => {
    await MobileCache.clear()
    return { ok: true, value: { success: true } }
  },

  clearCookies: async () => {
    return await MobileNetwork.clearCookies()
  },

  openExternal: async (url: string) => {
    await WebBrowser.openBrowserAsync(url)
    return { ok: true, value: undefined }
  },

  openInternalBrowser: async (url: string) => {
    await WebBrowser.openBrowserAsync(url)
    return { ok: true, value: undefined }
  },

  cfBypass: (url: string) => MobileNetwork.cfBypass(url),
  cfFetchHtml: (url: string) =>
    MobileNetwork.fetchText(url).then((r) => {
      if (r.ok) return { ok: true, value: r.value.data }
      return { ok: false, error: r.error }
    }),

  download: MobileDownload as unknown as ElectronApi['download'],

  window: {
    minimize: async () => ({ ok: true, value: undefined }),
    maximize: async () => ({ ok: true, value: undefined }),
    restore: async () => ({ ok: true, value: undefined }),
    close: async () => ({ ok: true, value: undefined }),
    isMaximized: async () => ({ ok: true, value: true }),
    updateOverlay: async () => ({ ok: true, value: undefined }),
    openExternal: async (url: string) => {
      await WebBrowser.openBrowserAsync(url)
      return { ok: true, value: undefined }
    },
    openInternalBrowser: async (url: string) => {
      await WebBrowser.openBrowserAsync(url)
      return { ok: true, value: undefined }
    }
  },

  getSystemState: async (): Promise<IpcResult<SystemState>> => {
    const activeDownloads: Record<string, ActiveTaskState> = {}
    for (const [key, active] of MobileDownload.activeDownloads) {
      const [mangaId, chapterId] = key.split(':')
      activeDownloads[key] = {
        mangaId,
        chapterId,
        status: active ? 'downloading' : 'canceled',
        cached: 0,
        total: 0,
        type: 'manga'
      }
    }
    return { 
      ok: true, 
      value: { 
        activeDownloads, 
        cloudflareBypasses: {}, 
        activeBypass: null 
      } 
    }
  },

  onSystemStateUpdate: (callback: (data: StateUpdateEvent) => void) => {
    MobileDownload.onEvent((data) => {
      callback({
        type: 'active_tasks_update',
        task: {
          mangaId: data.mangaId,
          chapterId: data.chapterId,
          status: (data.type === 'start' || data.type === 'progress') ? 'downloading' : (data.type === 'completed' ? 'completed' : 'canceled'),
          cached: data.cached || 0,
          total: data.total || 0,
          type: 'manga'
        }
      })
    })
    return () => MobileDownload.onEvent(() => {})
  },

  detectTheme: async (baseUrl: string): Promise<IpcResult<string>> => {
    const check = async (url: string): Promise<'madara' | 'mangastream' | 'unknown'> => {
      try {
        const res = await MobileNetwork.fetchText(url)
        if (!res.ok) return 'unknown'
        const html = res.value.data
        if (html.includes('madara') || html.includes('wp-content/themes/madara') || html.includes('Madara'))
          return 'madara'
        if (html.includes('mangastream') || html.includes('wp-content/themes/mangastream') ||
            html.includes('class="bsx"') || html.includes('class="listupd"'))
          return 'mangastream'
      } catch (e) {
        console.warn('[MobileApi] detectTheme error:', e)
      }
      return 'unknown'
    }

    let theme: 'madara' | 'mangastream' | 'unknown' = await check(baseUrl)
    if (theme === 'unknown') {
      const cleanUrl = baseUrl.replace(/\/$/, '')
      theme = await check(`${cleanUrl}/series`)
      if (theme === 'unknown') theme = await check(`${cleanUrl}/manga`)
    }
    return { ok: true, value: theme }
  },

  onAppUpdate: () => () => {},
  onDownloadEvent: (callback: (data: any) => void) => {
    MobileDownload.onEvent(callback)
    return () => MobileDownload.onEvent(() => {})
  },
  onCfStatus: (callback: (data: { status: 'started' | 'completed' | 'failed'; domain?: string }) => void) => {
    cfStatusCallbacks.add(callback)
    return () => { cfStatusCallbacks.delete(callback) }
  },
  onCacheInvalidate: (callback: (data: { group: string; key?: string }) => void) => {
    cacheInvalidateCallbacks.add(callback)
    return () => { cacheInvalidateCallbacks.delete(callback) }
  },

  installUpdate: async () => ({ ok: true, value: undefined }),
  checkForUpdates: async () => ({ ok: true, value: undefined }),

  sync: {
    startServer: async () => ({ ok: false, error: 'Not supported on mobile' }),
    stopServer: async () => ({ ok: true, value: undefined }),
    getStatus: async () => ({
      ok: true,
      value: { isRunning: false, port: 0, ip: '', deviceId: identityService.getDeviceId() }
    }),
    getPairingPayload: async () => ({ ok: false, error: 'Not supported on mobile' })
  },

  sources: {
    getRepos: async () => ({ ok: true, value: [] }),
    addRepo: async () => ({ ok: true, value: { success: true, count: 0 } }),
    removeRepo: async () => ({ ok: true, value: undefined }),
    refreshAll: async () => ({ ok: true, value: { totalCount: 0 } }),
    getAllSources: async () => ({ ok: true, value: [] }),
    getCatalogExtensions: async () => ({ ok: true, value: [] }),
    selectDirectory: async () => ({ ok: true, value: '' })
  },

  plugins: {
    getAll: async () => ({ ok: true, value: [] }),
    toggle: async () => ({ ok: true, value: undefined }),
    install: async () => ({ ok: true, value: undefined }),
    uninstall: async () => ({ ok: true, value: undefined })
  },

  platform: 'android',
  version: Constants.expoConfig?.version || '1.0.0'
}
