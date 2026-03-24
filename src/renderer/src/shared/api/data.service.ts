import { NetworkService } from '@common/services/network'

const getApi = () => (window as any).api;

export const DataService = {
  db: {
    getExtensions: async () => {
      const res = await getApi().db.getExtensions()
      if (!res.ok) throw new Error(res.error)
      return res.value
    },
    addExtension: async (data: any) => {
      const res = await getApi().db.addExtension(data)
      if (!res.ok) throw new Error(res.error)
      return res.value
    },
    getExtension: async (pkg: string) => {
      const res = await getApi().db.getExtension(pkg)
      if (!res.ok) throw new Error(res.error)
      return res.value
    },
    removeExtension: async (pkg: string) => {
      const res = await getApi().db.removeExtension(pkg)
      if (!res.ok) throw new Error(res.error)
      return res.value
    },
    getLibrary: async () => {
      const res = await getApi().db.getLibrary()
      if (!res.ok) throw new Error(res.error)
      return res.value
    },
    toggleLibrary: async (manga: any) => {
      const res = await getApi().db.toggleLibrary(manga)
      if (!res.ok) throw new Error(res.error)
      return res.value
    },
    getSetting: async (key: string) => {
      const res = await getApi().db.getSetting(key)
      if (!res.ok) throw new Error(res.error)
      return res.value
    },
    getSettings: async () => {
      const res = await getApi().db.getSettings()
      if (!res.ok) throw new Error(res.error)
      return res.value
    },
    setSetting: async (key: string, value: string) => {
      const res = await getApi().db.setSetting(key, value)
      if (!res.ok) throw new Error(res.error)
      return res.value
    },
    getProgress: async (mangaId: string) => {
      const res = await getApi().db.getProgress(mangaId)
      if (!res.ok) throw new Error(res.error)
      return res.value
    },
    updateProgress: async (data: any) => {
      const res = await getApi().db.updateProgress(data)
      if (!res.ok) throw new Error(res.error)
      return res.value
    },
    addHistory: async (data: any) => {
      const res = await getApi().db.addHistory(data)
      if (!res.ok) throw new Error(res.error)
      return res.value
    },
    getHistory: async (args?: any) => {
      const res = await getApi().db.getHistory(args)
      if (!res.ok) throw new Error(res.error)
      return res.value
    },
    deleteHistoryEntry: async (id: number) => {
      const res = await getApi().db.deleteHistoryEntry(id)
      if (!res.ok) throw new Error(res.error)
      return res.value
    },
    deleteHistoryByManga: async (mangaId: string) => {
      const res = await getApi().db.deleteHistoryByManga(mangaId)
      if (!res.ok) throw new Error(res.error)
      return res.value
    },
    clearHistory: async () => {
      const res = await getApi().db.clearHistory()
      if (!res.ok) throw new Error(res.error)
      return res.value
    },
    getChapters: async (mangaId: string) => {
      const res = await getApi().db.getChapters(mangaId)
      if (!res.ok) throw new Error(res.error)
      return res.value
    },
    saveChapters: async (args: { mangaId: string; chapters: any[] }) => {
      const res = await getApi().db.saveChapters(args)
      if (!res.ok) throw new Error(res.error)
      return res.value
    },
    getMangaCache: async (mangaId: string) => {
      const res = await getApi().db.getMangaCache(mangaId)
      if (!res.ok) throw new Error(res.error)
      return res.value
    },
    saveMangaCache: async (manga: any) => {
      if (!manga.title) {
        console.warn('[DataService] Skipping saveMangaCache: title is missing', manga)
        return null
      }
      const res = await getApi().db.saveMangaCache(manga)
      if (!res.ok) throw new Error(res.error)
      return res.value
    }
  },

  fetchRepo: async (url: string) => {
    const res: any = await NetworkService.executeWithRetry(
      () => getApi().fetchRepo(url),
      (r: any) => !r.ok && (r.status >= 500 || r.status === 429)
    );
    if (!res.ok) throw new Error(res.error);
    return res.value;
  },
  fetchText: async (url: string, options?: any) => {
    const res: any = await NetworkService.executeWithRetry(
      () => getApi().fetchText(url, options),
      (r: any) => !r.ok && (r.status >= 500 || r.status === 429),
      options?.attempts || 3,
      options?.delay || 1000
    );
    if (!res.ok) throw new Error(res.error);
    return res.value;
  },
  executeExtension: async (args: any) => {
    const res: any = await getApi().executeExtension(args)
    if (!res.ok) throw new Error(res.error)
    return res.value
  },
  installExtension: async (ext: any, repoUrl: string) => {
    const res: any = await getApi().installExtension(ext, repoUrl)
    if (!res.ok) throw new Error(res.error)
    return res.value
  },
  clearCache: async () => {
    const res: any = await getApi().clearCache()
    if (!res.ok) throw new Error(res.error)
    return res.value
  },
  clearCookies: async () => {
    const res: any = await getApi().clearCookies()
    if (!res.ok) throw new Error(res.error)
    return res.value
  },
  openExternal: (url: string) => getApi().openExternal(url),
  openInternalBrowser: (url: string) => getApi().openInternalBrowser(url),
  download: {
    start: async (args: any) => {
      const res: any = await getApi().download.start(args)
      if (!res.ok) throw new Error(res.error)
      return res.value
    },
    cancel: async (args: any) => {
      const res: any = await getApi().download.cancel(args)
      if (!res.ok) throw new Error(res.error)
      return res.value
    },
    getStatus: async (args: any) => {
      const res: any = await getApi().download.getStatus(args)
      if (!res.ok) throw new Error(res.error)
      return res.value
    },
    getMangaDownloads: async (mangaId: string) => {
      const res: any = await getApi().download.getMangaDownloads(mangaId)
      if (!res.ok) throw new Error(res.error)
      return res.value
    },
    getAllMangaDownloads: async () => {
      const res: any = await getApi().download.getAllMangaDownloads()
      if (!res.ok) throw new Error(res.error)
      return res.value
    }
  },
  platform: (window as any).api?.platform || 'win32'
}
