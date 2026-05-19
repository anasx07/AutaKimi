import { Manga, Chapter, HistoryEntry } from '@common/types'
import { normalizeManga } from '@common/utils/mangaNormalizer'
import { getApi, callIpc } from './base'

export const DatabaseService = {
  getExtensions: () => callIpc(() => getApi().db.getExtensions()),
  addExtension: (data: Parameters<ReturnType<typeof getApi>['db']['addExtension']>[0]) =>
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
    return callIpc(() => getApi().db.saveMangaCache({ ...normalized, pkg: manga.pkg } as Manga))
  }
}
