import { ipcMain } from 'electron'
import { IpcChannel } from '../types/ipc'
import { downloadManager } from '../services/download.service'

export function registerDownloadHandlers() {
  ipcMain.handle(IpcChannel.DOWNLOAD_CHAPTER, async (_, { mangaId, chapterId, pageUrls }: { mangaId: string; chapterId: string; pageUrls: string[] }) => {
    try {
      downloadManager.startDownload({ mangaId, chapterId, pageUrls })
      return { ok: true, value: true }
    } catch (error: any) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle(IpcChannel.CANCEL_DOWNLOAD, async (_, { mangaId, chapterId }: { mangaId: string; chapterId: string }) => {
    try {
      downloadManager.cancelDownload(mangaId, chapterId)
      return { ok: true, value: true }
    } catch (error: any) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle(IpcChannel.GET_DOWNLOAD_STATUS, async (_, { mangaId, chapterId }: { mangaId: string; chapterId: string }) => {
    try {
      const status = await downloadManager.getStatus(mangaId, chapterId)
      return { ok: true, value: status }
    } catch (error: any) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle(IpcChannel.GET_MANGA_DOWNLOADS, async (_, mangaId: string) => {
    try {
      const downloads = await downloadManager.getMangaDownloads(mangaId)
      return { ok: true, value: downloads }
    } catch (error: any) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle(IpcChannel.DOWNLOAD_GET_ALL_MANGA, async () => {
    try {
      const manga = await downloadManager.getDownloadedManga()
      return { ok: true, value: manga }
    } catch (error: any) {
      return { ok: false, error: error.message }
    }
  })
}
