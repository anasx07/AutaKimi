import { Result } from './result'
import { FetchOptions, FetchResult } from './network'
import { Manga } from './manga'
import { DownloadEntry } from './download'
import { StateUpdateEvent, SystemState } from './state'
import { Extension } from './extension'
import { Chapter } from './chapter'
import { HistoryEntry } from './history'

export type IpcResult<T> = Result<T>

/**
 * Centralized IPC channel definitions to avoid magic strings.
 */
export enum IpcChannel {
  FETCH_REPO = 'fetch-repo',
  FETCH_TEXT = 'fetch-text',
  DETECT_THEME = 'detect-theme',
  EXTENSION_INSTALL = 'extension:install',

  DB_GET_EXTENSIONS = 'db:get-extensions',
  DB_ADD_EXTENSION = 'db:add-extension',
  DB_GET_EXTENSION = 'db:get-extension',
  DB_REMOVE_EXTENSION = 'db:remove-extension',

  DB_GET_LIBRARY = 'db:get-library',
  DB_TOGGLE_LIBRARY = 'db:toggle-library',
  DB_CLEAR_LIBRARY = 'db:clear-library',

  DB_GET_SETTING = 'db:get-setting',
  DB_GET_SETTINGS = 'db:get-settings',
  DB_SET_SETTING = 'db:set-setting',

  DB_GET_PROGRESS = 'db:get-progress',
  DB_UPDATE_PROGRESS = 'db:update-progress',

  DB_ADD_HISTORY = 'db:add-history',
  DB_GET_HISTORY = 'db:get-history',
  DB_DELETE_HISTORY_ENTRY = 'db:delete-history-entry',
  DB_DELETE_HISTORY_BY_MANGA = 'db:delete-history-by-manga',
  DB_CLEAR_HISTORY = 'db:clear-history',

  DB_GET_CHAPTERS = 'db:get-chapters',
  DB_SAVE_CHAPTERS = 'db:save-chapters',

  DB_GET_MANGA_CACHE = 'db:get-manga-cache',
  DB_SAVE_MANGA_CACHE = 'db:save-manga-cache',

  EXECUTE_EXTENSION = 'execute-extension',
  CLEAR_CACHE = 'clear-cache',
  CLEAR_COOKIES = 'clear-cookies',
  OPEN_EXTERNAL = 'open-external',

  // Window Controls
  WINDOW_MINIMIZE = 'window:minimize',
  WINDOW_MAXIMIZE = 'window:maximize',
  WINDOW_RESTORE = 'window:restore',
  WINDOW_CLOSE = 'window:close',
  WINDOW_IS_MAXIMIZED = 'window:is-maximized',
  WINDOW_UPDATE_OVERLAY = 'window:update-overlay',

  // Downloads
  DOWNLOAD_CHAPTER = 'download:chapter',
  CANCEL_DOWNLOAD = 'download:cancel',
  GET_DOWNLOAD_STATUS = 'download:status',
  GET_MANGA_DOWNLOADS = 'download:manga-list',
  DOWNLOAD_GET_ALL_MANGA = 'download:get-all-manga',
  REMOVE_DOWNLOAD = 'download:remove',
  DOWNLOAD_CLEAR_ALL = 'download:clear-all',
  DOWNLOAD_EVENT = 'download:event',
  GET_SYSTEM_STATE = 'system:get-state',
  SYSTEM_STATE_UPDATE = 'system:state-update',

  // App Updates
  APP_UPDATE = 'app:update',
  INSTALL_UPDATE = 'app:install-update',
  CHECK_FOR_UPDATE = 'app:check-for-update',
  GET_VERSION = 'app:get-version',
  OPEN_INTERNAL_BROWSER = 'open-internal-browser',
  CF_BYPASS = 'cf:bypass',
  CF_FETCH_HTML = 'cf:fetch-html',
  CF_STATUS = 'cf:status',

  // Synchronization
  SYNC_START_SERVER = 'sync:start-server',
  SYNC_STOP_SERVER = 'sync:stop-server',
  SYNC_GET_STATUS = 'sync:get-status',
  SYNC_GET_PAIRING_PAYLOAD = 'sync:get-pairing-payload',

  // Source Repositories
  SOURCES_GET_REPOS = 'sources:get-repos',
  SOURCES_ADD_REPO = 'sources:add-repo',
  SOURCES_REMOVE_REPO = 'sources:remove-repo',
  SOURCES_REFRESH_ALL = 'sources:refresh-all'
}

/**
 * Formal interface for the `window.api` bridge.
 * Methods return IpcResult<T> to be handled via callIpc.
 */
export interface ElectronApi {
  init: () => Promise<IpcResult<void>>
  fetchRepo: (url: string) => Promise<IpcResult<any>>
  fetchText: (url: string, options?: FetchOptions) => Promise<IpcResult<FetchResult>>
  detectTheme: (baseUrl: string) => Promise<IpcResult<string>>
  sync: {
    startServer: () => Promise<IpcResult<{ success: boolean; port: number; ip: string }>>
    stopServer: () => Promise<IpcResult<void>>
    getStatus: () => Promise<IpcResult<{ isRunning: boolean; port: number; ip: string; deviceId: string }>>
    getPairingPayload: (args: { ip: string; port: number }) => Promise<IpcResult<string>>
  }
  sources: {
    getRepos: () => Promise<IpcResult<string[]>>
    addRepo: (url: string) => Promise<IpcResult<{ success: boolean; count: number; error?: string }>>
    removeRepo: (url: string) => Promise<IpcResult<void>>
    refreshAll: () => Promise<IpcResult<{ totalCount: number }>>
  }
  db: {
    getExtensions: () => Promise<IpcResult<Extension[]>>
    addExtension: (args: {
      pkg: string
      code?: string
      name?: string
      baseUrl?: string
      lang?: string
      icon?: string
      nsfw?: number
    }) => Promise<IpcResult<{ success?: boolean; error?: string }>>
    getExtension: (pkg: string) => Promise<IpcResult<Extension | null>>
    removeExtension: (pkg: string) => Promise<IpcResult<boolean>>
    getLibrary: (args?: {
      limit?: number
      offset?: number
      type?: string
    }) => Promise<IpcResult<Manga[]>>
    toggleLibrary: (manga: Manga) => Promise<IpcResult<boolean>>
    getSetting: (key: string) => Promise<IpcResult<string | null>>
    getSettings: () => Promise<IpcResult<Record<string, string>>>
    setSetting: (
      key: string,
      value: string
    ) => Promise<IpcResult<{ success?: boolean; error?: string }>>
    getProgress: (
      mangaId: string
    ) => Promise<IpcResult<{ chapterId: string; isRead: boolean; lastPage: number }[]>>
    updateProgress: (args: {
      mangaId: string
      chapterId: string
      isRead: boolean
      lastPage?: number
    }) => Promise<IpcResult<{ success?: boolean; error?: string }>>
    addHistory: (args: {
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
    }) => Promise<IpcResult<{ success?: boolean; error?: string }>>
    getHistory: (
      args?: { limit?: number; offset?: number; type?: string } | number
    ) => Promise<IpcResult<HistoryEntry[]>>
    deleteHistoryEntry: (id: number) => Promise<IpcResult<{ success?: boolean; error?: string }>>
    deleteHistoryByManga: (
      mangaId: string
    ) => Promise<IpcResult<{ success?: boolean; error?: string }>>
    clearHistory: (type?: string) => Promise<IpcResult<{ success?: boolean; error?: string }>>
    clearLibrary: (type?: string) => Promise<IpcResult<{ success?: boolean; error?: string }>>
    getChapters: (mangaId: string) => Promise<IpcResult<Chapter[]>>
    saveChapters: (args: {
      mangaId: string
      chapters: Chapter[]
    }) => Promise<IpcResult<{ success?: boolean; error?: string }>>
    getMangaCache: (mangaId: string) => Promise<IpcResult<Manga | null>>
    saveMangaCache: (manga: Manga) => Promise<IpcResult<{ success?: boolean; error?: string }>>
  }
  clearCache: () => Promise<IpcResult<{ success?: boolean; error?: string }>>
  clearCookies: () => Promise<IpcResult<{ success?: boolean; error?: string }>>
  executeExtension: (args: {
    pkg: string
    code: string
    contextArgs?: Record<string, unknown>
  }) => Promise<IpcResult<any>>
  installExtension: (
    ext: Extension,
    repoUrl: string
  ) => Promise<IpcResult<{ success?: boolean; error?: string }>>
  openExternal: (url: string) => Promise<void>
  download: {
    start: (args: {
      mangaId: string
      chapterId: string
      pageUrls: string[]
      type: 'manga' | 'anime'
      mangaTitle?: string
      extensionName?: string
      chapterTitle?: string
    }) => Promise<IpcResult<boolean>>
    cancel: (args: { mangaId: string; chapterId: string }) => Promise<IpcResult<boolean>>
    getStatus: (args: {
      mangaId: string
      chapterId: string
    }) => Promise<IpcResult<DownloadEntry | undefined>>
    getMangaDownloads: (mangaId: string) => Promise<IpcResult<DownloadEntry[]>>
    getAllMangaDownloads: (type?: string) => Promise<IpcResult<DownloadEntry[]>>
    remove: (args: { mangaId: string; chapterId: string }) => Promise<IpcResult<boolean>>
    clearAll: (type?: string) => Promise<IpcResult<boolean>>
  }
  window: {
    minimize: () => Promise<void>
    maximize: () => Promise<void>
    restore: () => Promise<void>
    close: () => Promise<void>
    isMaximized: () => Promise<IpcResult<boolean>>
    updateOverlay: (options: { color: string; symbolColor: string }) => Promise<void>
  }
  onAppUpdate: (
    callback: (data: { status: string; progress?: { percent: number; bytesPerSecond: number; total: number; transferred: number }; error?: string }) => void
  ) => () => void
  onDownloadEvent: (
    callback: (data: {
      type: 'start' | 'progress' | 'completed' | 'error' | 'canceled'
      mangaId: string
      chapterId: string
      cached?: number
      total?: number
      error?: string
    }) => void
  ) => () => void
  onCfStatus: (
    callback: (data: { status: 'started' | 'completed' | 'failed'; domain?: string }) => void
  ) => () => void
  onCacheInvalidate: (callback: (data: { group: string; key?: string }) => void) => () => void
  installUpdate: () => Promise<void>
  checkForUpdates: () => Promise<void>
  openInternalBrowser: (url: string) => Promise<void>
  cfBypass: (url: string) => Promise<IpcResult<boolean>>
  cfFetchHtml: (url: string) => Promise<IpcResult<string | null>>
  getSystemState: () => Promise<IpcResult<SystemState>>
  onSystemStateUpdate: (callback: (data: StateUpdateEvent) => void) => () => void
  platform: string
  version: string
}
