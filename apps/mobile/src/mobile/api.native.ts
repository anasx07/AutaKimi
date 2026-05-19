import { ElectronApi, IpcResult, FetchOptions, Extension, StateUpdateEvent, SystemState } from '@common/types'
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
  },
  db: MobileDB as unknown as ElectronApi['db'],

  fetchRepo: (url: string) => MobileNetwork.fetchRepo(url),
  fetchText: (url: string, options?: FetchOptions) => MobileNetwork.fetchText(url, options),

  executeExtension: (args: { pkg: string; code: string; contextArgs?: Record<string, unknown> }) =>
    MobileExtension.execute(args),

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
          baseUrl: ext.sources?.[0]?.baseUrl,
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
  },

  openInternalBrowser: async (url: string) => {
    await WebBrowser.openBrowserAsync(url)
  },

  cfBypass: (url: string) => MobileNetwork.cfBypass(url),
  cfFetchHtml: (url: string) =>
    MobileNetwork.fetchText(url).then((r) => {
      if (r.ok) return { ok: true, value: r.value.data }
      return { ok: false, error: r.error }
    }),

  download: MobileDownload as unknown as ElectronApi['download'],

  window: {
    minimize: async () => {},
    maximize: async () => {},
    restore: async () => {},
    close: async () => {},
    isMaximized: async () => ({ ok: true, value: true }),
    updateOverlay: async () => {}
  },

  getSystemState: async (): Promise<IpcResult<SystemState>> => {
    const activeDownloads: Record<string, { status: string; cached: number; total: number; type: string }> = {}
    for (const [key, active] of MobileDownload.activeDownloads) {
      const [mangaId, chapterId] = key.split(':')
      activeDownloads[key] = { status: active ? 'downloading' : 'canceled', cached: 0, total: 0, type: 'manga' }
    }
    return { ok: true, value: { activeDownloads } }
  },

  onSystemStateUpdate: (callback: (data: StateUpdateEvent) => void) => {
    MobileDownload.onEvent((data) => {
      callback({
        type: 'download',
        mangaId: data.mangaId,
        chapterId: data.chapterId,
        downloadStatus: data.type
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

    let theme = await check(baseUrl)
    if (theme === 'unknown') {
      const cleanUrl = baseUrl.replace(/\/$/, '')
      theme = await check(`${cleanUrl}/series`) as 'madara' | 'mangastream'
      if (theme === 'unknown') theme = await check(`${cleanUrl}/manga`) as 'madara' | 'mangastream'
    }
    return { ok: true, value: theme as string }
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

  installUpdate: async () => {},
  checkForUpdates: async () => {},

  platform: 'android',
  version: Constants.expoConfig?.version || '1.0.0'
}
