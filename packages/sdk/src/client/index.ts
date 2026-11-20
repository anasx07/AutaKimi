import { ElectronApi, IpcResult } from '../types/ipc'

/**
 * Platform Abstraction Layer — Client RPC Helpers
 * Provides a unified, type-safe API client for Desktop (Electron) and Mobile (Expo React Native).
 */

export const getApi = (): ElectronApi => {
  if (typeof window !== 'undefined' && (window as any).api) {
    return (window as any).api
  }
  return new Proxy({} as ElectronApi, {
    get(_, prop) {
      return () =>
        Promise.reject(new Error(`ElectronApi.${String(prop)} not available — no API bridge found`))
    }
  })
}

export async function callIpc<T>(fn: () => Promise<IpcResult<T>>): Promise<T> {
  const res = await fn()
  if (!res.ok) throw new Error(res.error)
  return res.value
}

export const clientDb = {
  getExtensions: () => callIpc(() => getApi().db.getExtensions()),
  addExtension: (data: any) => callIpc(() => getApi().db.addExtension(data)),
  getExtension: (pkg: string) => callIpc(() => getApi().db.getExtension(pkg)),
  removeExtension: (pkg: string) => callIpc(() => getApi().db.removeExtension(pkg)),
  getInstalledExtensions: () => callIpc(() => getApi().db.getExtensions()),
  getLibrary: (args?: any) => callIpc(() => getApi().db.getLibrary(args)),
  toggleLibrary: (manga: any) => callIpc(() => getApi().db.toggleLibrary(manga)),
  getSetting: (key: string) => callIpc(() => getApi().db.getSetting(key)),
  getSettings: () => callIpc(() => getApi().db.getSettings()),
  setSetting: (key: string, value: string) => callIpc(() => getApi().db.setSetting(key, value)),
  getProgress: (mangaId: string) => callIpc(() => getApi().db.getProgress(mangaId)),
  updateProgress: (data: any) => callIpc(() => getApi().db.updateProgress(data)),
  addHistory: (data: any) => callIpc(() => getApi().db.addHistory(data)),
  getHistory: (args?: any) => callIpc(() => getApi().db.getHistory(args)),
  deleteHistoryEntry: (id: number) => callIpc(() => getApi().db.deleteHistoryEntry(id)),
  deleteHistoryByManga: (mangaId: string) => callIpc(() => getApi().db.deleteHistoryByManga(mangaId)),
  clearHistory: (type?: any) => callIpc(() => getApi().db.clearHistory(type)),
  clearLibrary: (type?: any) => callIpc(() => getApi().db.clearLibrary(type)),
  getChapters: (mangaId: string) => callIpc(() => getApi().db.getChapters(mangaId)),
  saveChapters: (args: any) => callIpc(() => getApi().db.saveChapters(args)),
  getMangaCache: (mangaId: string) => callIpc(() => getApi().db.getMangaCache(mangaId)),
  saveMangaCache: (manga: any) => callIpc(() => getApi().db.saveMangaCache(manga))
}

export const clientSources = {
  getRepos: () => callIpc(() => getApi().sources.getRepos()),
  addRepo: (url: string) => callIpc(() => getApi().sources.addRepo(url)),
  removeRepo: (url: string) => callIpc(() => getApi().sources.removeRepo(url)),
  refreshAll: () => callIpc(() => getApi().sources.refreshAll()),
  getAllSources: () => callIpc(() => getApi().sources.getAllSources()),
  getCatalogExtensions: (lang?: string) => callIpc(() => getApi().sources.getCatalogExtensions(lang)),
  selectDirectory: () => callIpc(() => getApi().sources.selectDirectory())
}
