import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannel, type ElectronApi, type IpcInvokeMap, type IpcEventMap } from '../main/types/ipc'
import type { FetchOptions } from '@common/types/network'

const invoke = <K extends keyof IpcInvokeMap>(
  channel: K,
  ...args: Parameters<IpcInvokeMap[K]>
): ReturnType<IpcInvokeMap[K]> => ipcRenderer.invoke(channel, ...args) as any

const on = <K extends keyof IpcEventMap>(
  channel: K,
  callback: IpcEventMap[K]
) => {
  const subscription = (_event: any, data: any) => (callback as any)(data)
  ipcRenderer.on(channel as string, subscription)
  return () => ipcRenderer.removeListener(channel as string, subscription)
}

// Custom APIs for renderer
const api: ElectronApi = {
  init: () => invoke(IpcChannel.INIT),
  fetchRepo: (url: string) => invoke(IpcChannel.FETCH_REPO, url),
  fetchText: (url: string, options?: FetchOptions) => invoke(IpcChannel.FETCH_TEXT, url, options),
  detectTheme: (baseUrl: string) => invoke(IpcChannel.DETECT_THEME, baseUrl),
  sync: {
    startServer: () => invoke(IpcChannel.SYNC_START_SERVER),
    stopServer: () => invoke(IpcChannel.SYNC_STOP_SERVER),
    getStatus: () => invoke(IpcChannel.SYNC_GET_STATUS),
    getPairingPayload: (args) => invoke(IpcChannel.SYNC_GET_PAIRING_PAYLOAD, args)
  },
  sources: {
    getRepos: () => invoke(IpcChannel.SOURCES_GET_REPOS),
    addRepo: (url: string) => invoke(IpcChannel.SOURCES_ADD_REPO, url),
    removeRepo: (url: string) => invoke(IpcChannel.SOURCES_REMOVE_REPO, url),
    refreshAll: () => invoke(IpcChannel.SOURCES_REFRESH_ALL),
    getAllSources: () => invoke(IpcChannel.SOURCES_GET_ALL),
    getCatalogExtensions: (lang?: string) => invoke(IpcChannel.SOURCES_GET_CATALOG_EXTENSIONS, lang),
    selectDirectory: () => invoke(IpcChannel.SOURCES_SELECT_DIRECTORY)
  },
  plugins: {
    getAll: () => invoke(IpcChannel.PLUGINS_GET_ALL),
    toggle: (id: string, enabled: boolean) => invoke(IpcChannel.PLUGINS_TOGGLE, id, enabled),
    install: (plugin: any) => invoke(IpcChannel.PLUGINS_INSTALL, plugin),
    uninstall: (id: string) => invoke(IpcChannel.PLUGINS_UNINSTALL, id)
  },
  db: {
    getExtensions: () => invoke(IpcChannel.DB_GET_EXTENSIONS),
    addExtension: (args) => invoke(IpcChannel.DB_ADD_EXTENSION, args),
    getExtension: (pkg: string) => invoke(IpcChannel.DB_GET_EXTENSION, pkg),
    removeExtension: (pkg: string) => invoke(IpcChannel.DB_REMOVE_EXTENSION, pkg),
    getLibrary: (args) => invoke(IpcChannel.DB_GET_LIBRARY, args),
    toggleLibrary: (manga) => invoke(IpcChannel.DB_TOGGLE_LIBRARY, manga),
    getSetting: (key: string) => invoke(IpcChannel.DB_GET_SETTING, key),
    getSettings: () => invoke(IpcChannel.DB_GET_SETTINGS),
    setSetting: (key, value) => invoke(IpcChannel.DB_SET_SETTING, key, value),
    getProgress: (mangaId: string) => invoke(IpcChannel.DB_GET_PROGRESS, mangaId),
    updateProgress: (args) => invoke(IpcChannel.DB_UPDATE_PROGRESS, args),
    updateProgressBatch: (args) => invoke(IpcChannel.DB_UPDATE_PROGRESS_BATCH, args),
    addHistory: (args) => invoke(IpcChannel.DB_ADD_HISTORY, args),
    updateHistoryDuration: (args) => invoke(IpcChannel.DB_UPDATE_HISTORY_DURATION, args),
    getHistory: (limit) => invoke(IpcChannel.DB_GET_HISTORY, limit),
    deleteHistoryEntry: (id) => invoke(IpcChannel.DB_DELETE_HISTORY_ENTRY, id),
    deleteHistoryByManga: (mangaId) => invoke(IpcChannel.DB_DELETE_HISTORY_BY_MANGA, mangaId),
    clearHistory: (type) => invoke(IpcChannel.DB_CLEAR_HISTORY, type),
    clearLibrary: (type) => invoke(IpcChannel.DB_CLEAR_LIBRARY, type),
    getChapters: (mangaId) => invoke(IpcChannel.DB_GET_CHAPTERS, mangaId),
    saveChapters: (args) => invoke(IpcChannel.DB_SAVE_CHAPTERS, args),
    getMangaCache: (mangaId) => invoke(IpcChannel.DB_GET_MANGA_CACHE, mangaId),
    saveMangaCache: (manga) => invoke(IpcChannel.DB_SAVE_MANGA_CACHE, manga)
  },
  clearCache: () => invoke(IpcChannel.CLEAR_CACHE),
  clearCookies: () => invoke(IpcChannel.CLEAR_COOKIES),
  executeExtension: (args) => invoke(IpcChannel.EXECUTE_EXTENSION, args),
  cancelExtensionExecution: (taskId) => invoke(IpcChannel.CANCEL_EXTENSION_EXECUTION, taskId),
  installExtension: (ext, repoUrl) => invoke(IpcChannel.EXTENSION_INSTALL, ext, repoUrl),
  openExternal: (url: string) => invoke(IpcChannel.OPEN_EXTERNAL, url),
  window: {
    minimize: () => invoke(IpcChannel.WINDOW_MINIMIZE),
    maximize: () => invoke(IpcChannel.WINDOW_MAXIMIZE),
    restore: () => invoke(IpcChannel.WINDOW_RESTORE),
    close: () => invoke(IpcChannel.WINDOW_CLOSE),
    isMaximized: () => invoke(IpcChannel.WINDOW_IS_MAXIMIZED),
    updateOverlay: (options) => invoke(IpcChannel.WINDOW_UPDATE_OVERLAY, options),
    openExternal: (url: string) => invoke(IpcChannel.OPEN_EXTERNAL, url),
    openInternalBrowser: (url: string) => invoke(IpcChannel.OPEN_INTERNAL_BROWSER, url)
  },
  download: {
    start: (args) => invoke(IpcChannel.DOWNLOAD_CHAPTER, args),
    cancel: (args) => invoke(IpcChannel.CANCEL_DOWNLOAD, args),
    getStatus: (args) => invoke(IpcChannel.GET_DOWNLOAD_STATUS, args),
    getMangaDownloads: (mangaId) => invoke(IpcChannel.GET_MANGA_DOWNLOADS, mangaId),
    getAllMangaDownloads: (type) => invoke(IpcChannel.DOWNLOAD_GET_ALL_MANGA, type),
    remove: (args) => invoke(IpcChannel.REMOVE_DOWNLOAD, args),
    clearAll: (type) => invoke(IpcChannel.DOWNLOAD_CLEAR_ALL, type)
  },
  onAppUpdate: (callback) => on(IpcChannel.APP_UPDATE, callback),
  onDownloadEvent: (callback) => on(IpcChannel.DOWNLOAD_EVENT, callback),
  onCfStatus: (callback) => on(IpcChannel.CF_STATUS, callback),
  onCacheInvalidate: (callback) => on('CACHE_INVALIDATE', callback),
  installUpdate: () => invoke(IpcChannel.INSTALL_UPDATE),
  checkForUpdates: () => invoke(IpcChannel.CHECK_FOR_UPDATE),
  openInternalBrowser: (url: string) => invoke(IpcChannel.OPEN_INTERNAL_BROWSER, url),
  cfBypass: (url, silent) => invoke(IpcChannel.CF_BYPASS, url, silent),
  cfFetchHtml: (url, silent) => invoke(IpcChannel.CF_FETCH_HTML, url, silent),
  setStreamHeaders: (args) => invoke(IpcChannel.SET_STREAM_HEADERS, args),
  probeStream: (args) => invoke(IpcChannel.PROBE_STREAM, args),
  getSystemState: () => invoke(IpcChannel.GET_SYSTEM_STATE),
  onSystemStateUpdate: (callback) => on(IpcChannel.SYSTEM_STATE_UPDATE, callback),
  trackers: {
    getByManga: (mangaId) => invoke(IpcChannel.DB_GET_TRACKERS, mangaId),
    save: (tracker) => invoke(IpcChannel.DB_SAVE_TRACKER, tracker),
    delete: (args) => invoke(IpcChannel.DB_DELETE_TRACKER, args),
    authAniList: () => invoke(IpcChannel.TRACKER_AUTH_ANILIST),
    getUserAniList: () => invoke(IpcChannel.TRACKER_GET_USER_ANILIST),
    setTokenAniList: (token) => invoke(IpcChannel.TRACKER_SET_TOKEN_ANILIST, token),
    logoutAniList: () => invoke(IpcChannel.TRACKER_LOGOUT_ANILIST),
    searchAniList: (args) => invoke(IpcChannel.TRACKER_SEARCH_ANILIST, args),
    getMediaAniList: (mediaId) => invoke(IpcChannel.TRACKER_GET_MEDIA_ANILIST, mediaId),
    updateAniList: (args) => invoke(IpcChannel.TRACKER_UPDATE_ANILIST, args)
  },
  backup: {
    export: () => invoke(IpcChannel.BACKUP_EXPORT),
    import: () => invoke(IpcChannel.BACKUP_IMPORT)
  },
  platform: process.platform,
  version: ipcRenderer.sendSync(IpcChannel.GET_VERSION)
}


// Expose APIs to the renderer via contextBridge.
try {
  contextBridge.exposeInMainWorld('api', api)
} catch (error) {
  console.error('[Preload] Failed to expose API via contextBridge:', error)
}
