import { IpcChannel } from './ipc'
import { Manga } from './manga'
import { DownloadEntry } from './download'
import { FetchOptions, FetchResult } from './network'
import { HistoryEntry } from './history'
import { Extension } from './extension'
import { Chapter } from './chapter'

export interface IpcContracts {
  [IpcChannel.FETCH_REPO]: {
    args: string
    result: any
  }
  [IpcChannel.FETCH_TEXT]: {
    args: [string, FetchOptions?]
    result: FetchResult
  }
  [IpcChannel.DETECT_THEME]: {
    args: string
    result: string
  }
  [IpcChannel.EXTENSION_INSTALL]: {
    args: { ext: Extension; repoUrl: string }
    result: { success?: boolean; error?: string }
  }

  [IpcChannel.DB_GET_EXTENSIONS]: {
    args: void
    result: Extension[]
  }
  [IpcChannel.DB_ADD_EXTENSION]: {
    args: {
      pkg: string
      code?: string
      name?: string
      baseUrl?: string
      lang?: string
      icon?: string
    }
    result: boolean
  }
  [IpcChannel.DB_GET_EXTENSION]: {
    args: string
    result: Extension | null
  }
  [IpcChannel.DB_REMOVE_EXTENSION]: {
    args: string
    result: boolean
  }

  [IpcChannel.DB_GET_LIBRARY]: {
    args: { limit?: number; offset?: number; type?: string }
    result: Manga[]
  }
  [IpcChannel.DB_TOGGLE_LIBRARY]: {
    args: Manga
    result: boolean
  }

  [IpcChannel.DB_GET_SETTING]: {
    args: string
    result: string | null
  }
  [IpcChannel.DB_GET_SETTINGS]: {
    args: void
    result: Record<string, string>
  }
  [IpcChannel.DB_SET_SETTING]: {
    args: { key: string; value: string }
    result: boolean
  }

  [IpcChannel.DB_GET_PROGRESS]: {
    args: string
    result: { chapterId: string; isRead: boolean; lastPage: number }[]
  }
  [IpcChannel.DB_UPDATE_PROGRESS]: {
    args: { mangaId: string; chapterId: string; isRead: boolean; lastPage?: number }
    result: boolean
  }

  [IpcChannel.DB_ADD_HISTORY]: {
    args: {
      mangaId: string
      mangaTitle?: string
      mangaCover?: string
      mangaUrl?: string
      chapterId: string
      chapterTitle?: string
      startedAt: string
      durationSeconds?: number
      pkg?: string
      type?: 'manga' | 'anime'
    }
    result: boolean
  }
  [IpcChannel.DB_GET_HISTORY]: {
    args: { limit?: number; offset?: number; type?: string } | number
    result: HistoryEntry[]
  }
  [IpcChannel.DB_DELETE_HISTORY_ENTRY]: {
    args: number
    result: boolean
  }
  [IpcChannel.DB_DELETE_HISTORY_BY_MANGA]: {
    args: string
    result: boolean
  }
  [IpcChannel.DB_CLEAR_HISTORY]: {
    args: void
    result: boolean
  }

  [IpcChannel.DB_GET_CHAPTERS]: {
    args: string
    result: Chapter[]
  }
  [IpcChannel.DB_SAVE_CHAPTERS]: {
    args: { mangaId: string; chapters: Chapter[] }
    result: boolean
  }

  [IpcChannel.DB_GET_MANGA_CACHE]: {
    args: string
    result: Manga | null
  }
  [IpcChannel.DB_SAVE_MANGA_CACHE]: {
    args: Manga
    result: boolean
  }

  [IpcChannel.EXECUTE_EXTENSION]: {
    args: { pkg: string; code: string; contextArgs?: Record<string, unknown> }
    result: any
  }
  [IpcChannel.CLEAR_CACHE]: {
    args: void
    result: boolean
  }
  [IpcChannel.CLEAR_COOKIES]: {
    args: void
    result: boolean
  }
  [IpcChannel.OPEN_EXTERNAL]: {
    args: string
    result: void
  }

  // Window Controls
  [IpcChannel.WINDOW_MINIMIZE]: { args: void; result: void }
  [IpcChannel.WINDOW_MAXIMIZE]: { args: void; result: void }
  [IpcChannel.WINDOW_RESTORE]: { args: void; result: void }
  [IpcChannel.WINDOW_CLOSE]: { args: void; result: void }
  [IpcChannel.WINDOW_IS_MAXIMIZED]: { args: void; result: boolean }
  [IpcChannel.WINDOW_UPDATE_OVERLAY]: {
    args: { color: string; symbolColor: string }
    result: void
  }

  // Downloads
  [IpcChannel.DOWNLOAD_CHAPTER]: {
    args: { mangaId: string; chapterId: string; pageUrls: string[] }
    result: boolean
  }
  [IpcChannel.CANCEL_DOWNLOAD]: {
    args: { mangaId: string; chapterId: string }
    result: boolean
  }
  [IpcChannel.GET_DOWNLOAD_STATUS]: {
    args: { mangaId: string; chapterId: string }
    result: any
  }
  [IpcChannel.GET_MANGA_DOWNLOADS]: {
    args: string
    result: DownloadEntry[]
  }
  [IpcChannel.DOWNLOAD_GET_ALL_MANGA]: {
    args: string | void
    result: DownloadEntry[]
  }

  [IpcChannel.INSTALL_UPDATE]: { args: void; result: void }
  [IpcChannel.CHECK_FOR_UPDATE]: { args: void; result: void }
  [IpcChannel.GET_VERSION]: { args: void; result: string }
  [IpcChannel.OPEN_INTERNAL_BROWSER]: { args: string; result: void }
  [IpcChannel.CF_BYPASS]: { args: string; result: boolean }
  [IpcChannel.CF_FETCH_HTML]: { args: string; result: string | null }
}
