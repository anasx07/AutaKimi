import { getApi, callIpc } from './base'

export const DownloadService = {
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
  getMangaDownloads: (mangaId: string) => callIpc(() => getApi().download.getMangaDownloads(mangaId)),
  getAllMangaDownloads: (type?: 'manga' | 'anime') =>
    callIpc(() => getApi().download.getAllMangaDownloads(type)),
  remove: (args: { mangaId: string; chapterId: string }) =>
    callIpc(() => getApi().download.remove(args)),
  clearAll: (type?: 'manga' | 'anime') => callIpc(() => getApi().download.clearAll(type))
}
