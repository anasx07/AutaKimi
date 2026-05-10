import { NetworkService } from '@common/services/network'
import {
  FetchOptions,
  Manga,
  ElectronApi,
  IpcResult,
  Extension,
  Chapter,
  HistoryEntry,
  StateUpdateEvent
} from '@common/types'
import { normalizeManga } from '@common/utils/mangaNormalizer'
import { CatalogService } from './catalog.service'
import { useUIStore } from '../model/ui.store'

// Use Electron IPC API if window.api is exposed (Desktop)
// On mobile (Expo), window.api is set in app/_layout.tsx by MobileApi
const getApi = (): ElectronApi => {
  if (typeof window !== 'undefined' && window.api) {
    return window.api
  }
  // In a pure web environment without API bridge, provide a minimal fallback
  // that throws informative errors
  return new Proxy({} as ElectronApi, {
    get(_, prop) {
      return () => Promise.reject(new Error(`ElectronApi.${String(prop)} not available — no API bridge found`))
    }
  })
}

async function callIpc<T>(fn: () => Promise<IpcResult<T>>): Promise<T> {
  const res = await fn()
  if (!res.ok) throw new Error(res.error)
  return res.value
}

// Domain-level concurrency lock for Cloudflare bypasses
const activeBypasses = new Map<string, Promise<unknown>>()

export const DataService = {
  /**
   * Resolves the icon path for an extension, prioritizing local bundled icons.
   */
  getExtensionIcon: (pkg: string, remoteIcon?: string): string => {
    try {
      // 1. Try local bundled asset first
      const localPath = new URL(`../../app/assets/Extensionicon/${pkg}.png`, import.meta.url).href
      if (localPath && !localPath.includes('undefined')) return localPath
    } catch (e) {
      // Silent fail
    }

    // 2. Fallback to remote icon from metadata
    if (remoteIcon) return remoteIcon

    // 3. Last resort - raw GitHub fallback
    const ICON_BASE = 'https://raw.githubusercontent.com/keiyoushi/extensions-source/main/icons'
    return `${ICON_BASE}/${pkg}.png`
  },

  init: () => callIpc(() => getApi().init()),
  db: {
    getExtensions: () => callIpc(() => getApi().db.getExtensions()),
    addExtension: (data: Parameters<ElectronApi['db']['addExtension']>[0]) =>
      callIpc(() => getApi().db.addExtension(data)),
    getExtension: (pkg: string) => callIpc(() => getApi().db.getExtension(pkg)),
    removeExtension: (pkg: string) => callIpc(() => getApi().db.removeExtension(pkg)),
    getInstalledExtensions: () => callIpc(() => getApi().db.getExtensions()),
    getLibrary: (args?: { limit?: number; offset?: number; type?: 'manga' | 'anime' }) =>
      callIpc(() => getApi().db.getLibrary(args)),
    toggleLibrary: (manga: Manga) => callIpc(() => getApi().db.toggleLibrary(manga)),
    getSetting: (key: string) => callIpc(() => getApi().db.getSetting(key)),
    getSettings: () => callIpc(() => getApi().db.getSettings()),
    setSetting: (key: string, value: string) => callIpc(() => getApi().db.setSetting(key, value)),
    getProgress: (mangaId: string) => callIpc(() => getApi().db.getProgress(mangaId)),
    updateProgress: (data: {
      mangaId: string
      chapterId: string
      isRead: boolean
      lastPage?: number
    }) => callIpc(() => getApi().db.updateProgress(data)),
    addHistory: (data: HistoryEntry) => callIpc(() => getApi().db.addHistory(data)),
    getHistory: (args?: { limit?: number; offset?: number; type?: 'manga' | 'anime' } | number) =>
      callIpc(() => getApi().db.getHistory(args)),
    deleteHistoryEntry: (id: number) => callIpc(() => getApi().db.deleteHistoryEntry(id)),
    deleteHistoryByManga: (mangaId: string) =>
      callIpc(() => getApi().db.deleteHistoryByManga(mangaId)),
    clearHistory: (type?: 'manga' | 'anime') => callIpc(() => getApi().db.clearHistory(type)),
    clearLibrary: (type?: 'manga' | 'anime') => callIpc(() => getApi().db.clearLibrary(type)),
    getChapters: (mangaId: string) => callIpc(() => getApi().db.getChapters(mangaId)),
    saveChapters: (args: { mangaId: string; chapters: Chapter[] }) =>
      callIpc(() => getApi().db.saveChapters(args)),
    getMangaCache: (mangaId: string) => callIpc(() => getApi().db.getMangaCache(mangaId)),
    saveMangaCache: async (manga: Manga) => {
      const normalized = normalizeManga(manga)
      return callIpc(() => getApi().db.saveMangaCache({ ...normalized, pkg: manga.pkg }))
    }
  },

  fetchRepo: (url: string) =>
    callIpc(() =>
      NetworkService.executeWithRetry(
        () => getApi().fetchRepo(url),
        (r: IpcResult<unknown>) => !r.ok
      )
    ),
  fetchText: (url: string, options?: FetchOptions) =>
    callIpc(() =>
      NetworkService.executeWithRetry(
        () => getApi().fetchText(url, options),
        (r: IpcResult<unknown>) => !r.ok,
        options?.attempts || 3,
        options?.delay || 1000
      )
    ),
  executeExtension: (args: { pkg: string; code: string; contextArgs?: Record<string, unknown> }) =>
    callIpc(() => getApi().executeExtension(args)),
  installExtension: (ext: Extension, repoUrl: string) =>
    callIpc(() => getApi().installExtension(ext, repoUrl)),
  clearCache: () => callIpc(() => getApi().clearCache()),
  clearCookies: () => callIpc(() => getApi().clearCookies()),
  openExternal: (url: string) => getApi().openExternal(url),
  openInternalBrowser: (url: string) => getApi().openInternalBrowser(url),
  cfBypass: async (url: string, silent = false) => {
    const domain = new URL(url).hostname
    const existing = activeBypasses.get(domain)
    if (existing) return existing

    const { setIsCfBypassing } = useUIStore.getState()
    if (!silent) setIsCfBypassing(true, domain)

    const bypassPromise = (async () => {
      try {
        const result = await Promise.race([
          callIpc(() => getApi().cfBypass(url)),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Bypass timed out after 30s')), 30000)
          )
        ])
        return result
      } finally {
        if (!silent) setIsCfBypassing(false)
        activeBypasses.delete(domain)
      }
    })()

    activeBypasses.set(domain, bypassPromise)
    return bypassPromise
  },
  cfFetchHtml: async (url: string, silent = false) => {
    const domain = new URL(url).hostname
    const existing = activeBypasses.get(domain)
    if (existing) return existing

    const { setIsCfBypassing } = useUIStore.getState()
    if (!silent) setIsCfBypassing(true, domain)

    const fetchPromise = (async () => {
      try {
        const result = await Promise.race([
          callIpc(() => getApi().cfFetchHtml(url)),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Bypass timed out after 30s')), 30000)
          )
        ]) as string
        return result
      } finally {
        if (!silent) setIsCfBypassing(false)
        activeBypasses.delete(domain)
      }
    })()

    activeBypasses.set(domain, fetchPromise)
    return fetchPromise
  },
  detectTheme: (baseUrl: string) => callIpc(() => getApi().detectTheme(baseUrl)),
  sync: {
    startServer: () => callIpc(() => getApi().sync.startServer()),
    stopServer: () => callIpc(() => getApi().sync.stopServer()),
    getStatus: () => callIpc(() => getApi().sync.getStatus()),
    getPairingPayload: (args: { ip: string; port: number }) =>
      callIpc(() => getApi().sync.getPairingPayload(args))
  },
  sources: {
    getRepos: () => callIpc(() => getApi().sources.getRepos()),
    addRepo: (url: string) => callIpc(() => getApi().sources.addRepo(url)),
    removeRepo: (url: string) => callIpc(() => getApi().sources.removeRepo(url)),
    refreshAll: () => callIpc(() => getApi().sources.refreshAll())
  },
  getSystemState: () => callIpc(() => getApi().getSystemState()),
  onSystemStateUpdate: (callback: (data: StateUpdateEvent) => void) =>
    getApi().onSystemStateUpdate(callback),
  window: {
    minimize: () => getApi().window.minimize(),
    maximize: () => getApi().window.maximize(),
    restore: () => getApi().window.restore(),
    close: () => getApi().window.close(),
    isMaximized: () => callIpc(() => getApi().window.isMaximized()),
    updateOverlay: (options: { color: string; symbolColor: string }) =>
      getApi().window.updateOverlay(options)
  },
  getExtensionsCatalog: () => CatalogService.getExtensions(),
  download: {
    start: (args: {
      mangaId: string
      chapterId: string
      pageUrls: string[]
      type: 'manga' | 'anime'
      mangaTitle?: string
      extensionName?: string
      chapterTitle?: string
    }) => callIpc(() => getApi().download.start(args)),
    cancel: (args: { mangaId: string; chapterId: string }) =>
      callIpc(() => getApi().download.cancel(args)),
    getStatus: (args: { mangaId: string; chapterId: string }) =>
      callIpc(() => getApi().download.getStatus(args)),
    getMangaDownloads: (mangaId: string) =>
      callIpc(() => getApi().download.getMangaDownloads(mangaId)),
    getAllMangaDownloads: (type?: 'manga' | 'anime') =>
      callIpc(() => getApi().download.getAllMangaDownloads(type)),
    remove: (args: { mangaId: string; chapterId: string }) =>
      callIpc(() => getApi().download.remove(args)),
    clearAll: (type?: 'manga' | 'anime') => callIpc(() => getApi().download.clearAll(type))
  },
  get version() {
    return getApi()?.version || '0.0.0'
  },
  checkForUpdates: () => getApi()?.checkForUpdates(),
  installUpdate: () => getApi()?.installUpdate(),
  onAppUpdate: (
    callback: Parameters<ElectronApi['onAppUpdate']>[0]
  ) => getApi()?.onAppUpdate(callback),
  onCacheInvalidate: (callback: (data: { group: string; key?: string }) => void) =>
    getApi()?.onCacheInvalidate(callback),
  platform: getApi()?.platform || 'win32'
}
