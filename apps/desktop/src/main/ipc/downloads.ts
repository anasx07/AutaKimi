import { IpcChannel } from '../types/ipc'
import { downloadManager } from '../services/download.service'
import { stateRegistry } from '../services/state.service'
import { registerHandler, wrapIpc } from './utils'

export function registerDownloadHandlers(): void {
  registerHandler(
    IpcChannel.DOWNLOAD_CHAPTER,
    wrapIpc(
      async (
        _,
        args: {
          mangaId: string
          chapterId: string
          pageUrls: string[]
          type: 'manga' | 'anime'
          mangaTitle?: string
          extensionName?: string
          chapterTitle?: string
        }
      ) => {
        if (!args || typeof args !== 'object') throw new Error('Invalid arguments')
        const { mangaId, chapterId, pageUrls, type, mangaTitle, extensionName, chapterTitle } = args
        if (typeof mangaId !== 'string' || typeof chapterId !== 'string') {
          throw new Error('Invalid mangaId or chapterId')
        }
        if (!Array.isArray(pageUrls)) throw new Error('Invalid pageUrls array')
        if (type !== 'manga' && type !== 'anime') throw new Error('Invalid type')
        if (mangaTitle !== undefined && typeof mangaTitle !== 'string') throw new Error('Invalid mangaTitle')
        if (extensionName !== undefined && typeof extensionName !== 'string') throw new Error('Invalid extensionName')
        if (chapterTitle !== undefined && typeof chapterTitle !== 'string') throw new Error('Invalid chapterTitle')

        downloadManager.startDownload({
          mangaId,
          chapterId,
          pageUrls,
          type,
          mangaTitle,
          extensionName,
          chapterTitle
        })
        return true
      }
    )
  )

  registerHandler(
    IpcChannel.CANCEL_DOWNLOAD,
    wrapIpc(async (_, args: { mangaId: string; chapterId: string }) => {
      if (!args || typeof args !== 'object') throw new Error('Invalid arguments')
      const { mangaId, chapterId } = args
      if (typeof mangaId !== 'string' || typeof chapterId !== 'string') {
        throw new Error('Invalid mangaId or chapterId')
      }
      downloadManager.cancelDownload(mangaId, chapterId)
      return true
    })
  )

  registerHandler(
    IpcChannel.REMOVE_DOWNLOAD,
    wrapIpc(async (_, args: { mangaId: string; chapterId: string }) => {
      if (!args || typeof args !== 'object') throw new Error('Invalid arguments')
      const { mangaId, chapterId } = args
      if (typeof mangaId !== 'string' || typeof chapterId !== 'string') {
        throw new Error('Invalid mangaId or chapterId')
      }
      await downloadManager.deleteDownload(mangaId, chapterId)
      return true
    })
  )

  registerHandler(
    IpcChannel.GET_DOWNLOAD_STATUS,
    wrapIpc(async (_, args: { mangaId: string; chapterId: string }) => {
      if (!args || typeof args !== 'object') throw new Error('Invalid arguments')
      const { mangaId, chapterId } = args
      if (typeof mangaId !== 'string' || typeof chapterId !== 'string') {
        throw new Error('Invalid mangaId or chapterId')
      }
      return downloadManager.getStatus(mangaId, chapterId)
    })
  )

  registerHandler(
    IpcChannel.GET_MANGA_DOWNLOADS,
    wrapIpc((_, mangaId: string) => {
      if (typeof mangaId !== 'string') throw new Error('Invalid mangaId')
      return downloadManager.getMangaDownloads(mangaId)
    })
  )

  registerHandler(
    IpcChannel.DOWNLOAD_GET_ALL_MANGA,
    wrapIpc((_, type?: string) => {
      if (type !== undefined && type !== 'manga' && type !== 'anime') throw new Error('Invalid type')
      return downloadManager.getDownloadedManga(type as any)
    })
  )

  registerHandler(
    IpcChannel.DOWNLOAD_CLEAR_ALL,
    wrapIpc((_, type?: string) => {
      if (type !== undefined && type !== 'manga' && type !== 'anime') throw new Error('Invalid type')
      return downloadManager.clearAll(type as any)
    })
  )

  registerHandler(IpcChannel.GET_SYSTEM_STATE, wrapIpc(async () => stateRegistry.getState()))
}

