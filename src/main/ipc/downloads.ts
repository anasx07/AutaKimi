import { ipcMain } from 'electron'
import { IpcChannel } from '../types/ipc'
import { downloadManager } from '../services/download.service'
import { wrapIpc } from './utils'

export function registerDownloadHandlers() {
  ipcMain.handle(IpcChannel.DOWNLOAD_CHAPTER, wrapIpc(async (_, { mangaId, chapterId, pageUrls }: { mangaId: string; chapterId: string; pageUrls: string[] }) => {
    downloadManager.startDownload({ mangaId, chapterId, pageUrls })
    return true
  }))

  ipcMain.handle(IpcChannel.CANCEL_DOWNLOAD, wrapIpc(async (_, { mangaId, chapterId }: { mangaId: string; chapterId: string }) => {
    downloadManager.cancelDownload(mangaId, chapterId)
    return true
  }))
  
  ipcMain.handle(IpcChannel.REMOVE_DOWNLOAD, wrapIpc(async (_, { mangaId, chapterId }: { mangaId: string; chapterId: string }) => {
    await downloadManager.deleteDownload(mangaId, chapterId)
    return true
  }))

  ipcMain.handle(IpcChannel.GET_DOWNLOAD_STATUS, wrapIpc((_, { mangaId, chapterId }: { mangaId: string; chapterId: string }) => downloadManager.getStatus(mangaId, chapterId)))

  ipcMain.handle(IpcChannel.GET_MANGA_DOWNLOADS, wrapIpc((_, mangaId: string) => downloadManager.getMangaDownloads(mangaId)))

  ipcMain.handle(IpcChannel.DOWNLOAD_GET_ALL_MANGA, wrapIpc((_, type?: 'manga' | 'anime') => downloadManager.getDownloadedManga(type)))
}
