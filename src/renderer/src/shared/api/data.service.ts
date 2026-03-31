import { NetworkService } from '@common/services/network'
import { FetchOptions, Manga, ElectronApi, IpcResult } from '@common/types'
import { normalizeManga } from '@common/utils/mangaNormalizer'
import { MobileApi } from '@mobile/api'

// Use Electron IPC API if window.api is exposed (Desktop)
// Otherwise fall back to MobileApi (Capacitor/Native)
const getApi = (): ElectronApi => {
  if (typeof window !== 'undefined' && window.api) {
    return window.api
  }
  return MobileApi
}

async function callIpc<T>(fn: () => Promise<IpcResult<T>>): Promise<T> {
  const res = await fn()
  if (!res.ok) throw new Error(res.error)
  return res.value
}

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
    addExtension: (data: any) => callIpc(() => getApi().db.addExtension(data)),
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
    addHistory: (data: any) => callIpc(() => getApi().db.addHistory(data)),
    getHistory: (args?: { limit?: number; offset?: number; type?: 'manga' | 'anime' } | number) =>
      callIpc(() => getApi().db.getHistory(args)),
    deleteHistoryEntry: (id: number) => callIpc(() => getApi().db.deleteHistoryEntry(id)),
    deleteHistoryByManga: (mangaId: string) =>
      callIpc(() => getApi().db.deleteHistoryByManga(mangaId)),
    clearHistory: (type?: 'manga' | 'anime') => callIpc(() => getApi().db.clearHistory(type)),
    clearLibrary: (type?: 'manga' | 'anime') => callIpc(() => getApi().db.clearLibrary(type)),
    getChapters: (mangaId: string) => callIpc(() => getApi().db.getChapters(mangaId)),
    saveChapters: (args: { mangaId: string; chapters: any[] }) =>
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
        (r: any) => !r.ok && (r.status >= 500 || r.status === 429)
      )
    ),
  fetchText: (url: string, options?: FetchOptions) =>
    callIpc(() =>
      NetworkService.executeWithRetry(
        () => getApi().fetchText(url, options),
        (r: any) => !r.ok && (r.status >= 500 || r.status === 429),
        options?.attempts || 3,
        options?.delay || 1000
      )
    ),
  executeExtension: (args: { pkg: string; code: string; contextArgs?: any }) =>
    callIpc(() => getApi().executeExtension(args)),
  installExtension: (ext: any, repoUrl: string) =>
    callIpc(() => getApi().installExtension(ext, repoUrl)),
  clearCache: () => callIpc(() => getApi().clearCache()),
  clearCookies: () => callIpc(() => getApi().clearCookies()),
  openExternal: (url: string) => getApi().openExternal(url),
  openInternalBrowser: (url: string) => getApi().openInternalBrowser(url),
  cfBypass: (url: string) => callIpc(() => getApi().cfBypass(url)),
  cfFetchHtml: (url: string) => callIpc(() => getApi().cfFetchHtml(url)),
  getExtensionsCatalog: async (): Promise<IpcResult<any[]>> => {
    const REPO_URL =
      'https://raw.githubusercontent.com/keiyoushi/extensions-source/main/index.min.json'
    const ICON_BASE = 'https://raw.githubusercontent.com/keiyoushi/extensions-source/main/icons'

    // 1. Load Local Bundled Extensions (Vite eager glob)
    const catalogModules = import.meta.glob('./sources/catalog/extensions/*.json', {
      eager: true
    })
    const localExtensions = Object.values(catalogModules).flatMap((m: any) => m.default || m)

    // Map local to our metadata format
    const processedLocal = localExtensions.map((ext: any) => ({
      pkg: ext.pkg,
      name: ext.name,
      lang: ext.lang,
      icon: `${ICON_BASE}/${ext.pkg}.png`,
      version: ext.version,
      baseUrl: ext.sources?.[0]?.baseUrl || '',
      repoUrl: 'local',
      nsfw: ext.nsfw || 0
    }))

    try {
      // 2. Try to fetch Remote Index for updates
      const res = await fetch(REPO_URL)
      if (!res.ok) throw new Error('Remote fetch failed')
      const remoteData = await res.json()

      // Transform remote format
      const remoteExtensions = remoteData.map((ext: any) => ({
        pkg: ext.pkg,
        name: ext.name,
        lang: ext.lang,
        icon: `${ICON_BASE}/${ext.pkg}.png`,
        version: ext.version,
        baseUrl: ext.baseUrl || '',
        repoUrl: 'https://raw.githubusercontent.com/keiyoushi/extensions-source/main',
        nsfw: ext.nsfw || 0
      }))

      // 3. Merge (Remote overrides Local if present)
      const mergedMap = new Map()

      // Fill with local first
      processedLocal.forEach((ext) => mergedMap.set(ext.pkg, ext))

      // Update with remote (newer info)
      remoteExtensions.forEach((ext: any) => {
        mergedMap.set(ext.pkg, ext)
      })

      return { ok: true, value: Array.from(mergedMap.values()) }
    } catch (e: any) {
      console.warn('[DataService] Failed to fetch remote catalog, falling back to local only:', e)
      // Return local only if remote fails
      return { ok: true, value: processedLocal }
    }
  },
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
  onAppUpdate: (callback: (data: any) => void) => getApi()?.onAppUpdate(callback),
  onCacheInvalidate: (callback: (data: any) => void) => getApi()?.onCacheInvalidate(callback),
  platform: getApi()?.platform || 'win32'
}
