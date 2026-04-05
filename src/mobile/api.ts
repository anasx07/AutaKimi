import { ElectronApi, IpcResult } from '@common/types'
import { MobileDB } from './db'
import { MobileNetwork } from './network'
import { MobileExtension } from './extension'
import { MobileDownload } from './download'
import { MobileCache } from './cache'

// MobileApi is a pure object export here.
// Initialization should be explicitly called via the init() method.

export const MobileApi: ElectronApi = {
  init: () => MobileDB.init(),
  db: MobileDB as any,

  fetchRepo: (url: string) => MobileNetwork.fetchRepo(url),
  fetchText: (url: string, options?: any) => MobileNetwork.fetchText(url, options),

  executeExtension: (args: any) => MobileExtension.execute(args),

  installExtension: async (ext: any, repoUrl: string): Promise<IpcResult<{ success: boolean }>> => {
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

  download: MobileDownload as any,

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

  installUpdate: async () => {},
  checkForUpdates: async () => {},

  platform: 'android',
  version: '1.0.0'
} as any
