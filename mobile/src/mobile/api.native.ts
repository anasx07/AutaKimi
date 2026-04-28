import { ElectronApi, IpcResult, FetchOptions, Extension, StateUpdateEvent } from '../common/types'
import { MobileDB } from './db.native'
import { MobileNetwork } from './network.native'
import { MobileExtension } from './extension.native'
import { MobileDownload } from './download.native'
import { MobileCache } from './cache.native'
import Constants from 'expo-constants'
import * as WebBrowser from 'expo-web-browser'

export const MobileApi: ElectronApi = {
  init: () => MobileDB.init(),
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

  getSystemState: async () => ({
    ok: true,
    value: { activeDownloads: {} }
  }),

  onSystemStateUpdate: (_callback: (data: StateUpdateEvent) => void) => {
    return () => {}
  },

  detectTheme: async (_baseUrl: string): Promise<IpcResult<string>> => {
    return { ok: true, value: 'madara' }
  },

  onAppUpdate: () => () => {},
  onDownloadEvent: (callback: (data: any) => void) => {
    MobileDownload.onEvent(callback)
    return () => MobileDownload.onEvent(() => {})
  },
  onCfStatus: () => () => {},
  onCacheInvalidate: () => () => {},

  installUpdate: async () => {},
  checkForUpdates: async () => {},

  platform: 'android',
  version: Constants.expoConfig?.version || '1.0.0'
}
