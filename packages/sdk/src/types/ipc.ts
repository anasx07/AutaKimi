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
  INIT = 'init',
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
  SOURCES_REFRESH_ALL = 'sources:refresh-all',
  SOURCES_GET_ALL = 'sources:get-all',
  SOURCES_GET_CATALOG_EXTENSIONS = 'sources:get-catalog-extensions',

  // Plugins
  PLUGINS_GET_ALL = 'plugins:get-all',
  PLUGINS_TOGGLE = 'plugins:toggle'
}

/**
 * Mapping of IPC channels to their function signatures for `ipcRenderer.invoke` / `ipcMain.handle`.
 */
export type IpcInvokeMap = {
  [IpcChannel.INIT]: () => Promise<IpcResult<void>>
  [IpcChannel.FETCH_REPO]: (url: string) => Promise<IpcResult<any>>
  [IpcChannel.FETCH_TEXT]: (url: string, options?: FetchOptions) => Promise<IpcResult<FetchResult>>
  [IpcChannel.DETECT_THEME]: (baseUrl: string) => Promise<IpcResult<string>>

  [IpcChannel.SYNC_START_SERVER]: () => Promise<IpcResult<{ success: boolean; port: number; ip: string }>>
  [IpcChannel.SYNC_STOP_SERVER]: () => Promise<IpcResult<void>>
  [IpcChannel.SYNC_GET_STATUS]: () => Promise<IpcResult<{ isRunning: boolean; port: number; ip: string; deviceId: string }>>
  [IpcChannel.SYNC_GET_PAIRING_PAYLOAD]: (args: { ip: string; port: number }) => Promise<IpcResult<string>>

  [IpcChannel.SOURCES_GET_REPOS]: () => Promise<IpcResult<string[]>>
  [IpcChannel.SOURCES_ADD_REPO]: (url: string) => Promise<IpcResult<{ success: boolean; count: number; error?: string }>>
  [IpcChannel.SOURCES_REMOVE_REPO]: (url: string) => Promise<IpcResult<void>>
  [IpcChannel.SOURCES_REFRESH_ALL]: () => Promise<IpcResult<{ totalCount: number }>>
  [IpcChannel.SOURCES_GET_ALL]: () => Promise<IpcResult<any[]>>
  [IpcChannel.SOURCES_GET_CATALOG_EXTENSIONS]: () => Promise<IpcResult<Extension[]>>

  [IpcChannel.PLUGINS_GET_ALL]: () => Promise<IpcResult<any[]>>
  [IpcChannel.PLUGINS_TOGGLE]: (id: string, enabled: boolean) => Promise<IpcResult<void>>

  [IpcChannel.DB_GET_EXTENSIONS]: () => Promise<IpcResult<Extension[]>>
  [IpcChannel.DB_ADD_EXTENSION]: (args: {
    pkg: string
    code?: string
    name?: string
    baseUrl?: string
    lang?: string
    icon?: string
    nsfw?: boolean
  }) => Promise<IpcResult<{ success?: boolean; error?: string }>>
  [IpcChannel.DB_GET_EXTENSION]: (pkg: string) => Promise<IpcResult<Extension | null>>
  [IpcChannel.DB_REMOVE_EXTENSION]: (pkg: string) => Promise<IpcResult<boolean>>
  [IpcChannel.DB_GET_LIBRARY]: (args?: {
    limit?: number
    offset?: number
    type?: string
  }) => Promise<IpcResult<Manga[]>>
  [IpcChannel.DB_TOGGLE_LIBRARY]: (manga: Manga) => Promise<IpcResult<boolean>>
  [IpcChannel.DB_GET_SETTING]: (key: string) => Promise<IpcResult<string | null>>
  [IpcChannel.DB_GET_SETTINGS]: () => Promise<IpcResult<Record<string, string>>>
  [IpcChannel.DB_SET_SETTING]: (
    key: string,
    value: string
  ) => Promise<IpcResult<{ success?: boolean; error?: string }>>
  [IpcChannel.DB_GET_PROGRESS]: (
    mangaId: string
  ) => Promise<IpcResult<{ chapterId: string; isRead: boolean; lastPage: number }[]>>
  [IpcChannel.DB_UPDATE_PROGRESS]: (args: {
    mangaId: string
    chapterId: string
    isRead: boolean
    lastPage?: number
  }) => Promise<IpcResult<{ success?: boolean; error?: string }>>
  [IpcChannel.DB_ADD_HISTORY]: (args: {
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
  [IpcChannel.DB_GET_HISTORY]: (
    args?: { limit?: number; offset?: number; type?: string } | number
  ) => Promise<IpcResult<HistoryEntry[]>>
  [IpcChannel.DB_DELETE_HISTORY_ENTRY]: (id: number) => Promise<IpcResult<{ success?: boolean; error?: string }>>
  [IpcChannel.DB_DELETE_HISTORY_BY_MANGA]: (
    mangaId: string
  ) => Promise<IpcResult<{ success?: boolean; error?: string }>>
  [IpcChannel.DB_CLEAR_HISTORY]: (type?: string) => Promise<IpcResult<{ success?: boolean; error?: string }>>
  [IpcChannel.DB_CLEAR_LIBRARY]: (type?: string) => Promise<IpcResult<{ success?: boolean; error?: string }>>
  [IpcChannel.DB_GET_CHAPTERS]: (mangaId: string) => Promise<IpcResult<Chapter[]>>
  [IpcChannel.DB_SAVE_CHAPTERS]: (args: {
    mangaId: string
    chapters: Chapter[]
  }) => Promise<IpcResult<{ success?: boolean; error?: string }>>
  [IpcChannel.DB_GET_MANGA_CACHE]: (mangaId: string) => Promise<IpcResult<Manga | null>>
  [IpcChannel.DB_SAVE_MANGA_CACHE]: (manga: Manga) => Promise<IpcResult<{ success?: boolean; error?: string }>>

  [IpcChannel.EXECUTE_EXTENSION]: (args: {
    pkg: string
    code: string
    contextArgs?: Record<string, unknown>
  }) => Promise<IpcResult<any>>
  [IpcChannel.EXTENSION_INSTALL]: (
    ext: Extension,
    repoUrl: string
  ) => Promise<IpcResult<{ success?: boolean; error?: string }>>

  [IpcChannel.CLEAR_CACHE]: () => Promise<IpcResult<{ success?: boolean; error?: string }>>
  [IpcChannel.CLEAR_COOKIES]: () => Promise<IpcResult<{ success?: boolean; error?: string }>>
  [IpcChannel.OPEN_EXTERNAL]: (url: string) => Promise<IpcResult<void>>
  [IpcChannel.OPEN_INTERNAL_BROWSER]: (url: string) => Promise<IpcResult<void>>

  [IpcChannel.WINDOW_MINIMIZE]: () => Promise<IpcResult<void>>
  [IpcChannel.WINDOW_MAXIMIZE]: () => Promise<IpcResult<void>>
  [IpcChannel.WINDOW_RESTORE]: () => Promise<IpcResult<void>>
  [IpcChannel.WINDOW_CLOSE]: () => Promise<IpcResult<void>>
  [IpcChannel.WINDOW_IS_MAXIMIZED]: () => Promise<IpcResult<boolean>>
  [IpcChannel.WINDOW_UPDATE_OVERLAY]: (options: { color: string; symbolColor: string }) => Promise<IpcResult<void>>

  [IpcChannel.DOWNLOAD_CHAPTER]: (args: {
    mangaId: string
    chapterId: string
    pageUrls: string[]
    type: 'manga' | 'anime'
    mangaTitle?: string
    extensionName?: string
    chapterTitle?: string
  }) => Promise<IpcResult<boolean>>
  [IpcChannel.CANCEL_DOWNLOAD]: (args: { mangaId: string; chapterId: string }) => Promise<IpcResult<boolean>>
  [IpcChannel.GET_DOWNLOAD_STATUS]: (args: {
    mangaId: string
    chapterId: string
  }) => Promise<IpcResult<DownloadEntry | undefined>>
  [IpcChannel.GET_MANGA_DOWNLOADS]: (mangaId: string) => Promise<IpcResult<DownloadEntry[]>>
  [IpcChannel.DOWNLOAD_GET_ALL_MANGA]: (type?: string) => Promise<IpcResult<DownloadEntry[]>>
  [IpcChannel.REMOVE_DOWNLOAD]: (args: { mangaId: string; chapterId: string }) => Promise<IpcResult<boolean>>
  [IpcChannel.DOWNLOAD_CLEAR_ALL]: (type?: string) => Promise<IpcResult<boolean>>

  [IpcChannel.INSTALL_UPDATE]: () => Promise<IpcResult<void>>
  [IpcChannel.CHECK_FOR_UPDATE]: () => Promise<IpcResult<void>>
  [IpcChannel.GET_VERSION]: () => string // SendSync usually returns a value directly, but let's see

  [IpcChannel.CF_BYPASS]: (url: string, silent?: boolean) => Promise<IpcResult<boolean>>
  [IpcChannel.CF_FETCH_HTML]: (url: string, silent?: boolean) => Promise<IpcResult<string | null>>
  [IpcChannel.GET_SYSTEM_STATE]: () => Promise<IpcResult<SystemState>>
}

/**
 * Mapping of IPC channels to their event payloads for `ipcRenderer.on`.
 */
export type IpcEventMap = {
  [IpcChannel.APP_UPDATE]: (data: { status: string; progress?: { percent: number; bytesPerSecond: number; total: number; transferred: number }; error?: string }) => void
  [IpcChannel.DOWNLOAD_EVENT]: (data: {
    type: 'start' | 'progress' | 'completed' | 'error' | 'canceled'
    mangaId: string
    chapterId: string
    cached?: number
    total?: number
    error?: string
  }) => void
  [IpcChannel.CF_STATUS]: (data: { status: 'started' | 'completed' | 'failed'; domain?: string }) => void
  ['CACHE_INVALIDATE']: (data: { group: string; key?: string }) => void
  [IpcChannel.SYSTEM_STATE_UPDATE]: (data: StateUpdateEvent) => void
}

/**
 * Formal interface for the `window.api` bridge.
 * Methods return IpcResult<T> to be handled via callIpc.
 */
export interface ElectronApi {
  init: IpcInvokeMap[IpcChannel.INIT]
  fetchRepo: IpcInvokeMap[IpcChannel.FETCH_REPO]
  fetchText: IpcInvokeMap[IpcChannel.FETCH_TEXT]
  detectTheme: IpcInvokeMap[IpcChannel.DETECT_THEME]
  sync: {
    startServer: IpcInvokeMap[IpcChannel.SYNC_START_SERVER]
    stopServer: IpcInvokeMap[IpcChannel.SYNC_STOP_SERVER]
    getStatus: IpcInvokeMap[IpcChannel.SYNC_GET_STATUS]
    getPairingPayload: IpcInvokeMap[IpcChannel.SYNC_GET_PAIRING_PAYLOAD]
  }
  sources: {
    getRepos: IpcInvokeMap[IpcChannel.SOURCES_GET_REPOS]
    addRepo: IpcInvokeMap[IpcChannel.SOURCES_ADD_REPO]
    removeRepo: IpcInvokeMap[IpcChannel.SOURCES_REMOVE_REPO]
    refreshAll: IpcInvokeMap[IpcChannel.SOURCES_REFRESH_ALL]
    getAllSources: IpcInvokeMap[IpcChannel.SOURCES_GET_ALL]
    getCatalogExtensions: IpcInvokeMap[IpcChannel.SOURCES_GET_CATALOG_EXTENSIONS]
  }
  plugins: {
    getAll: IpcInvokeMap[IpcChannel.PLUGINS_GET_ALL]
    toggle: IpcInvokeMap[IpcChannel.PLUGINS_TOGGLE]
  }
  db: {
    getExtensions: IpcInvokeMap[IpcChannel.DB_GET_EXTENSIONS]
    addExtension: IpcInvokeMap[IpcChannel.DB_ADD_EXTENSION]
    getExtension: IpcInvokeMap[IpcChannel.DB_GET_EXTENSION]
    removeExtension: IpcInvokeMap[IpcChannel.DB_REMOVE_EXTENSION]
    getLibrary: IpcInvokeMap[IpcChannel.DB_GET_LIBRARY]
    toggleLibrary: IpcInvokeMap[IpcChannel.DB_TOGGLE_LIBRARY]
    getSetting: IpcInvokeMap[IpcChannel.DB_GET_SETTING]
    getSettings: IpcInvokeMap[IpcChannel.DB_GET_SETTINGS]
    setSetting: IpcInvokeMap[IpcChannel.DB_SET_SETTING]
    getProgress: IpcInvokeMap[IpcChannel.DB_GET_PROGRESS]
    updateProgress: IpcInvokeMap[IpcChannel.DB_UPDATE_PROGRESS]
    addHistory: IpcInvokeMap[IpcChannel.DB_ADD_HISTORY]
    getHistory: IpcInvokeMap[IpcChannel.DB_GET_HISTORY]
    deleteHistoryEntry: IpcInvokeMap[IpcChannel.DB_DELETE_HISTORY_ENTRY]
    deleteHistoryByManga: IpcInvokeMap[IpcChannel.DB_DELETE_HISTORY_BY_MANGA]
    clearHistory: IpcInvokeMap[IpcChannel.DB_CLEAR_HISTORY]
    clearLibrary: IpcInvokeMap[IpcChannel.DB_CLEAR_LIBRARY]
    getChapters: IpcInvokeMap[IpcChannel.DB_GET_CHAPTERS]
    saveChapters: IpcInvokeMap[IpcChannel.DB_SAVE_CHAPTERS]
    getMangaCache: IpcInvokeMap[IpcChannel.DB_GET_MANGA_CACHE]
    saveMangaCache: IpcInvokeMap[IpcChannel.DB_SAVE_MANGA_CACHE]
  }
  clearCache: IpcInvokeMap[IpcChannel.CLEAR_CACHE]
  clearCookies: IpcInvokeMap[IpcChannel.CLEAR_COOKIES]
  executeExtension: IpcInvokeMap[IpcChannel.EXECUTE_EXTENSION]
  installExtension: IpcInvokeMap[IpcChannel.EXTENSION_INSTALL]
  openExternal: IpcInvokeMap[IpcChannel.OPEN_EXTERNAL]
  download: {
    start: IpcInvokeMap[IpcChannel.DOWNLOAD_CHAPTER]
    cancel: IpcInvokeMap[IpcChannel.CANCEL_DOWNLOAD]
    getStatus: IpcInvokeMap[IpcChannel.GET_DOWNLOAD_STATUS]
    getMangaDownloads: IpcInvokeMap[IpcChannel.GET_MANGA_DOWNLOADS]
    getAllMangaDownloads: IpcInvokeMap[IpcChannel.DOWNLOAD_GET_ALL_MANGA]
    remove: IpcInvokeMap[IpcChannel.REMOVE_DOWNLOAD]
    clearAll: IpcInvokeMap[IpcChannel.DOWNLOAD_CLEAR_ALL]
  }
  window: {
    minimize: IpcInvokeMap[IpcChannel.WINDOW_MINIMIZE]
    maximize: IpcInvokeMap[IpcChannel.WINDOW_MAXIMIZE]
    restore: IpcInvokeMap[IpcChannel.WINDOW_RESTORE]
    close: IpcInvokeMap[IpcChannel.WINDOW_CLOSE]
    isMaximized: IpcInvokeMap[IpcChannel.WINDOW_IS_MAXIMIZED]
    updateOverlay: IpcInvokeMap[IpcChannel.WINDOW_UPDATE_OVERLAY]
  }
  onAppUpdate: (callback: IpcEventMap[IpcChannel.APP_UPDATE]) => () => void
  onDownloadEvent: (callback: IpcEventMap[IpcChannel.DOWNLOAD_EVENT]) => () => void
  onCfStatus: (callback: IpcEventMap[IpcChannel.CF_STATUS]) => () => void
  onCacheInvalidate: (callback: IpcEventMap['CACHE_INVALIDATE']) => () => void
  installUpdate: IpcInvokeMap[IpcChannel.INSTALL_UPDATE]
  checkForUpdates: IpcInvokeMap[IpcChannel.CHECK_FOR_UPDATE]
  openInternalBrowser: IpcInvokeMap[IpcChannel.OPEN_INTERNAL_BROWSER]
  cfBypass: IpcInvokeMap[IpcChannel.CF_BYPASS]
  cfFetchHtml: IpcInvokeMap[IpcChannel.CF_FETCH_HTML]
  getSystemState: IpcInvokeMap[IpcChannel.GET_SYSTEM_STATE]
  onSystemStateUpdate: (callback: IpcEventMap[IpcChannel.SYSTEM_STATE_UPDATE]) => () => void
  platform: string
  version: string
}

