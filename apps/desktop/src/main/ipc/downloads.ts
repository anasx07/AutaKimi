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
        {
          mangaId,
          chapterId,
          pageUrls,
          type,
          mangaTitle,
          extensionName,
          chapterTitle
        }: {
          mangaId: string
          chapterId: string
          pageUrls: string[]
          type: 'manga' | 'anime'
          mangaTitle?: string
          extensionName?: string
          chapterTitle?: string
        }
      ) => {
        const webContents = _.sender
        downloadManager.setWebContents(webContents)
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
    wrapIpc(async (_, { mangaId, chapterId }: { mangaId: string; chapterId: string }) => {
      downloadManager.cancelDownload(mangaId, chapterId)
      return true
    })
  )

  registerHandler(
    IpcChannel.REMOVE_DOWNLOAD,
    wrapIpc(async (_, { mangaId, chapterId }: { mangaId: string; chapterId: string }) => {
      await downloadManager.deleteDownload(mangaId, chapterId)
      return true
    })
  )

  registerHandler(
    IpcChannel.GET_DOWNLOAD_STATUS,
    wrapIpc(async (_, { mangaId, chapterId }: { mangaId: string; chapterId: string }) =>
      downloadManager.getStatus(mangaId, chapterId)
    )
  )

  registerHandler(
    IpcChannel.GET_MANGA_DOWNLOADS,
    wrapIpc((_, mangaId: string) => downloadManager.getMangaDownloads(mangaId))
  )

  registerHandler(
    IpcChannel.DOWNLOAD_GET_ALL_MANGA,
    wrapIpc((_, type?: string) => downloadManager.getDownloadedManga(type as any))
  )

  registerHandler(
    IpcChannel.DOWNLOAD_CLEAR_ALL,
    wrapIpc((_, type?: string) => downloadManager.clearAll(type as any))
  )

  registerHandler(IpcChannel.GET_SYSTEM_STATE, wrapIpc(async () => stateRegistry.getState()))
}

