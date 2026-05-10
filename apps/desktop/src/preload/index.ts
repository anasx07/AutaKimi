import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannel, type ElectronApi } from '../main/types/ipc'
import type { FetchOptions } from '@common/types/network'
import type { Manga } from '@common/types/manga'
import type { Extension } from '@common/types/extension'

// Custom APIs for renderer
const api: ElectronApi = {
  init: async () => ({ ok: true, value: undefined }),
  fetchRepo: (url: string) => ipcRenderer.invoke(IpcChannel.FETCH_REPO, url),
  fetchText: (url: string, options?: FetchOptions) =>
    ipcRenderer.invoke(IpcChannel.FETCH_TEXT, url, options),
  detectTheme: (baseUrl: string) => ipcRenderer.invoke(IpcChannel.DETECT_THEME, baseUrl),
  sync: {
    startServer: () => ipcRenderer.invoke(IpcChannel.SYNC_START_SERVER),
    stopServer: () => ipcRenderer.invoke(IpcChannel.SYNC_STOP_SERVER),
    getStatus: () => ipcRenderer.invoke(IpcChannel.SYNC_GET_STATUS),
    getPairingPayload: (args) => ipcRenderer.invoke(IpcChannel.SYNC_GET_PAIRING_PAYLOAD, args)
  },
  sources: {
    getRepos: () => ipcRenderer.invoke(IpcChannel.SOURCES_GET_REPOS),
    addRepo: (url: string) => ipcRenderer.invoke(IpcChannel.SOURCES_ADD_REPO, url),
    removeRepo: (url: string) => ipcRenderer.invoke(IpcChannel.SOURCES_REMOVE_REPO, url),
    refreshAll: () => ipcRenderer.invoke(IpcChannel.SOURCES_REFRESH_ALL)
  },
  db: {
    getExtensions: () => ipcRenderer.invoke(IpcChannel.DB_GET_EXTENSIONS),
    addExtension: (args) => ipcRenderer.invoke(IpcChannel.DB_ADD_EXTENSION, args),
    getExtension: (pkg: string) => ipcRenderer.invoke(IpcChannel.DB_GET_EXTENSION, pkg),
    removeExtension: (pkg: string) => ipcRenderer.invoke(IpcChannel.DB_REMOVE_EXTENSION, pkg),
    getLibrary: (args) => ipcRenderer.invoke(IpcChannel.DB_GET_LIBRARY, args),
    toggleLibrary: (manga: Manga) => ipcRenderer.invoke(IpcChannel.DB_TOGGLE_LIBRARY, manga),
    getSetting: (key: string) => ipcRenderer.invoke(IpcChannel.DB_GET_SETTING, key),
    getSettings: () => ipcRenderer.invoke(IpcChannel.DB_GET_SETTINGS),
    setSetting: (key: string, value: string) =>
      ipcRenderer.invoke(IpcChannel.DB_SET_SETTING, { key, value }),
    getProgress: (mangaId: string) => ipcRenderer.invoke(IpcChannel.DB_GET_PROGRESS, mangaId),
    updateProgress: (args) => ipcRenderer.invoke(IpcChannel.DB_UPDATE_PROGRESS, args),
    addHistory: (args) => ipcRenderer.invoke(IpcChannel.DB_ADD_HISTORY, args),
    getHistory: (limit) => ipcRenderer.invoke(IpcChannel.DB_GET_HISTORY, limit),
    deleteHistoryEntry: (id) => ipcRenderer.invoke(IpcChannel.DB_DELETE_HISTORY_ENTRY, id),
    deleteHistoryByManga: (mangaId) =>
      ipcRenderer.invoke(IpcChannel.DB_DELETE_HISTORY_BY_MANGA, mangaId),
    clearHistory: (type) => ipcRenderer.invoke(IpcChannel.DB_CLEAR_HISTORY, type),
    getChapters: (mangaId) => ipcRenderer.invoke(IpcChannel.DB_GET_CHAPTERS, mangaId),
    saveChapters: (args) => ipcRenderer.invoke(IpcChannel.DB_SAVE_CHAPTERS, args),
    getMangaCache: (mangaId) => ipcRenderer.invoke(IpcChannel.DB_GET_MANGA_CACHE, mangaId),
    saveMangaCache: (manga) => ipcRenderer.invoke(IpcChannel.DB_SAVE_MANGA_CACHE, manga),
    clearLibrary: (type) => ipcRenderer.invoke(IpcChannel.DB_CLEAR_LIBRARY, type)
  },
  clearCache: () => ipcRenderer.invoke(IpcChannel.CLEAR_CACHE),
  clearCookies: () => ipcRenderer.invoke(IpcChannel.CLEAR_COOKIES),
  executeExtension: (args: { pkg: string; code: string; contextArgs?: Record<string, unknown> }) =>
    ipcRenderer.invoke(IpcChannel.EXECUTE_EXTENSION, args),
  installExtension: (ext: Extension, repoUrl: string) =>
    ipcRenderer.invoke(IpcChannel.EXTENSION_INSTALL, { ext, repoUrl }),
  openExternal: (url: string) => ipcRenderer.invoke(IpcChannel.OPEN_EXTERNAL, url),
  window: {
    minimize: () => ipcRenderer.invoke(IpcChannel.WINDOW_MINIMIZE),
    maximize: () => ipcRenderer.invoke(IpcChannel.WINDOW_MAXIMIZE),
    restore: () => ipcRenderer.invoke(IpcChannel.WINDOW_RESTORE),
    close: () => ipcRenderer.invoke(IpcChannel.WINDOW_CLOSE),
    isMaximized: () => ipcRenderer.invoke(IpcChannel.WINDOW_IS_MAXIMIZED),
    updateOverlay: (options) => ipcRenderer.invoke(IpcChannel.WINDOW_UPDATE_OVERLAY, options)
  },
  download: {
    start: (args) => ipcRenderer.invoke(IpcChannel.DOWNLOAD_CHAPTER, args),
    cancel: (args) => ipcRenderer.invoke(IpcChannel.CANCEL_DOWNLOAD, args),
    getStatus: (args) => ipcRenderer.invoke(IpcChannel.GET_DOWNLOAD_STATUS, args),
    getMangaDownloads: (mangaId) => ipcRenderer.invoke(IpcChannel.GET_MANGA_DOWNLOADS, mangaId),
    getAllMangaDownloads: (type) => ipcRenderer.invoke(IpcChannel.DOWNLOAD_GET_ALL_MANGA, type),
    remove: (args) => ipcRenderer.invoke(IpcChannel.REMOVE_DOWNLOAD, args),
    clearAll: (type) => ipcRenderer.invoke(IpcChannel.DOWNLOAD_CLEAR_ALL, type)
  },
  onAppUpdate: (callback) => {
    const subscription = (_event: any, data: any) => callback(data)
    ipcRenderer.on(IpcChannel.APP_UPDATE, subscription)
    return () => ipcRenderer.removeListener(IpcChannel.APP_UPDATE, subscription)
  },
  onDownloadEvent: (callback) => {
    const subscription = (_event: any, data: any) => callback(data)
    ipcRenderer.on(IpcChannel.DOWNLOAD_EVENT, subscription)
    return () => ipcRenderer.removeListener(IpcChannel.DOWNLOAD_EVENT, subscription)
  },
  onCfStatus: (callback) => {
    const subscription = (_event: any, data: any) => callback(data)
    ipcRenderer.on(IpcChannel.CF_STATUS, subscription)
    return () => ipcRenderer.removeListener(IpcChannel.CF_STATUS, subscription)
  },
  onCacheInvalidate: (callback) => {
    const subscription = (_event: any, data: any) => callback(data)
    ipcRenderer.on('CACHE_INVALIDATE', subscription)
    return () => ipcRenderer.removeListener('CACHE_INVALIDATE', subscription)
  },
  installUpdate: () => ipcRenderer.invoke(IpcChannel.INSTALL_UPDATE),
  checkForUpdates: () => ipcRenderer.invoke(IpcChannel.CHECK_FOR_UPDATE),
  openInternalBrowser: (url: string) => ipcRenderer.invoke(IpcChannel.OPEN_INTERNAL_BROWSER, url),
  cfBypass: (url: string) => ipcRenderer.invoke(IpcChannel.CF_BYPASS, url),
  cfFetchHtml: (url: string) => ipcRenderer.invoke(IpcChannel.CF_FETCH_HTML, url),
  getSystemState: () => ipcRenderer.invoke(IpcChannel.GET_SYSTEM_STATE),
  onSystemStateUpdate: (callback) => {
    const subscription = (_event: any, data: any) => callback(data)
    ipcRenderer.on(IpcChannel.SYSTEM_STATE_UPDATE, subscription)
    return () => ipcRenderer.removeListener(IpcChannel.SYSTEM_STATE_UPDATE, subscription)
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
