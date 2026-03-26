import { NetworkService } from '@common/services/network'
import { FetchOptions } from '@common/types'

const getApi = () => (window as any).api;

async function callIpc<T = any>(fn: () => Promise<any>): Promise<T> {
  const res = await fn();
  if (!res.ok) throw new Error(res.error);
  return res.value;
}

export const DataService = {
  db: {
    getExtensions: () => callIpc(() => getApi().db.getExtensions()),
    addExtension: (data: any) => callIpc(() => getApi().db.addExtension(data)),
    getExtension: (pkg: string) => callIpc(() => getApi().db.getExtension(pkg)),
    removeExtension: (pkg: string) => callIpc(() => getApi().db.removeExtension(pkg)),
    getLibrary: (args?: { limit?: number; offset?: number; type?: string }) => callIpc(() => getApi().db.getLibrary(args)),
    toggleLibrary: (manga: any) => callIpc(() => getApi().db.toggleLibrary(manga)),
    getSetting: (key: string) => callIpc(() => getApi().db.getSetting(key)),
    getSettings: () => callIpc(() => getApi().db.getSettings()),
    setSetting: (key: string, value: string) => callIpc(() => getApi().db.setSetting(key, value)),
    getProgress: (mangaId: string) => callIpc(() => getApi().db.getProgress(mangaId)),
    updateProgress: (data: any) => callIpc(() => getApi().db.updateProgress(data)),
    addHistory: (data: any) => callIpc(() => getApi().db.addHistory(data)),
    getHistory: (args?: { limit?: number; offset?: number; type?: 'manga' | 'anime' }) => callIpc(() => getApi().db.getHistory(args)),
    deleteHistoryEntry: (id: number) => callIpc(() => getApi().db.deleteHistoryEntry(id)),
    deleteHistoryByManga: (mangaId: string) => callIpc(() => getApi().db.deleteHistoryByManga(mangaId)),
    clearHistory: () => callIpc(() => getApi().db.clearHistory()),
    getChapters: (mangaId: string) => callIpc(() => getApi().db.getChapters(mangaId)),
    saveChapters: (args: { mangaId: string; chapters: any[] }) => callIpc(() => getApi().db.saveChapters(args)),
    getMangaCache: (mangaId: string) => callIpc(() => getApi().db.getMangaCache(mangaId)),
    saveMangaCache: async (manga: any) => {
      if (!manga.title) {
        console.warn('[DataService] Skipping saveMangaCache: title is missing', manga)
        return null
      }
      return callIpc(() => getApi().db.saveMangaCache(manga))
    }
  },

  fetchRepo: (url: string) => callIpc(() => NetworkService.executeWithRetry(
    () => getApi().fetchRepo(url),
    (r: any) => !r.ok && (r.status >= 500 || r.status === 429)
  )),
  fetchText: (url: string, options?: FetchOptions) => callIpc(() => NetworkService.executeWithRetry(
    () => getApi().fetchText(url, options),
    (r: any) => !r.ok && (r.status >= 500 || r.status === 429),
    options?.attempts || 3,
    options?.delay || 1000
  )),
  executeExtension: (args: any) => callIpc(() => getApi().executeExtension(args)),
  installExtension: (ext: any, repoUrl: string) => callIpc(() => getApi().installExtension(ext, repoUrl)),
  clearCache: () => callIpc(() => getApi().clearCache()),
  clearCookies: () => callIpc(() => getApi().clearCookies()),
  openExternal: (url: string) => getApi().openExternal(url),
  openInternalBrowser: (url: string) => getApi().openInternalBrowser(url),
  cfBypass: (url: string) => callIpc(() => getApi().cfBypass(url)),
  cfFetchHtml: (url: string) => callIpc(() => getApi().cfFetchHtml(url)),
  download: {
    start: (args: any) => callIpc(() => getApi().download.start(args)),
    cancel: (args: any) => callIpc(() => getApi().download.cancel(args)),
    getStatus: (args: any) => callIpc(() => getApi().download.getStatus(args)),
    getMangaDownloads: (mangaId: string) => callIpc(() => getApi().download.getMangaDownloads(mangaId)),
    getAllMangaDownloads: (type?: string) => callIpc(() => getApi().download.getAllMangaDownloads(type))
  },
  platform: (window as any).api?.platform || 'win32'
}
