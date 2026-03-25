import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { IpcChannel, type ElectronApi } from '../main/types/ipc'

// Custom APIs for renderer
const api: ElectronApi = {
  fetchRepo: (url: string) => ipcRenderer.invoke(IpcChannel.FETCH_REPO, url),
  fetchText: (url: string, options?: any) => ipcRenderer.invoke(IpcChannel.FETCH_TEXT, url, options),
  detectTheme: (baseUrl: string) => ipcRenderer.invoke(IpcChannel.DETECT_THEME, baseUrl),
  db: {
    getExtensions: () => ipcRenderer.invoke(IpcChannel.DB_GET_EXTENSIONS),
    addExtension: (args) => ipcRenderer.invoke(IpcChannel.DB_ADD_EXTENSION, args),
    getExtension: (pkg: string) => ipcRenderer.invoke(IpcChannel.DB_GET_EXTENSION, pkg),
    removeExtension: (pkg: string) => ipcRenderer.invoke(IpcChannel.DB_REMOVE_EXTENSION, pkg),
    getLibrary: () => ipcRenderer.invoke(IpcChannel.DB_GET_LIBRARY),
    toggleLibrary: (manga: any) => ipcRenderer.invoke(IpcChannel.DB_TOGGLE_LIBRARY, manga),
    getSetting: (key: string) => ipcRenderer.invoke(IpcChannel.DB_GET_SETTING, key),
    getSettings: () => ipcRenderer.invoke(IpcChannel.DB_GET_SETTINGS),
    setSetting: (key: string, value: string) => ipcRenderer.invoke(IpcChannel.DB_SET_SETTING, { key, value }),
    getProgress: (mangaId: string) => ipcRenderer.invoke(IpcChannel.DB_GET_PROGRESS, mangaId),
    updateProgress: (args) => ipcRenderer.invoke(IpcChannel.DB_UPDATE_PROGRESS, args),
    addHistory: (args) => ipcRenderer.invoke(IpcChannel.DB_ADD_HISTORY, args),
    getHistory: (limit) => ipcRenderer.invoke(IpcChannel.DB_GET_HISTORY, limit),
    deleteHistoryEntry: (id) => ipcRenderer.invoke(IpcChannel.DB_DELETE_HISTORY_ENTRY, id),
    deleteHistoryByManga: (mangaId) => ipcRenderer.invoke(IpcChannel.DB_DELETE_HISTORY_BY_MANGA, mangaId),
    clearHistory: () => ipcRenderer.invoke(IpcChannel.DB_CLEAR_HISTORY),
    getChapters: (mangaId) => ipcRenderer.invoke(IpcChannel.DB_GET_CHAPTERS, mangaId),
    saveChapters: (args) => ipcRenderer.invoke(IpcChannel.DB_SAVE_CHAPTERS, args),
    getMangaCache: (mangaId) => ipcRenderer.invoke(IpcChannel.DB_GET_MANGA_CACHE, mangaId),
    saveMangaCache: (manga) => ipcRenderer.invoke(IpcChannel.DB_SAVE_MANGA_CACHE, manga),
  },
  clearCache: () => ipcRenderer.invoke(IpcChannel.CLEAR_CACHE),
  clearCookies: () => ipcRenderer.invoke(IpcChannel.CLEAR_COOKIES),
  executeExtension: (args: { pkg: string; code: string; contextArgs?: any }) => 
    ipcRenderer.invoke(IpcChannel.EXECUTE_EXTENSION, args),
  installExtension: (ext: any, repoUrl: string) => ipcRenderer.invoke(IpcChannel.EXTENSION_INSTALL, { ext, repoUrl }),
  openExternal: (url: string) => ipcRenderer.invoke(IpcChannel.OPEN_EXTERNAL, url),
  window: {
    minimize: () => ipcRenderer.invoke(IpcChannel.WINDOW_MINIMIZE),
    maximize: () => ipcRenderer.invoke(IpcChannel.WINDOW_MAXIMIZE),
    restore: () => ipcRenderer.invoke(IpcChannel.WINDOW_RESTORE),
    close: () => ipcRenderer.invoke(IpcChannel.WINDOW_CLOSE),
    isMaximized: () => ipcRenderer.invoke(IpcChannel.WINDOW_IS_MAXIMIZED),
    updateOverlay: (options) => ipcRenderer.invoke(IpcChannel.WINDOW_UPDATE_OVERLAY, options),
  },
  download: {
    start: (args) => ipcRenderer.invoke(IpcChannel.DOWNLOAD_CHAPTER, args),
    cancel: (args) => ipcRenderer.invoke(IpcChannel.CANCEL_DOWNLOAD, args),
    getStatus: (args) => ipcRenderer.invoke(IpcChannel.GET_DOWNLOAD_STATUS, args),
    getMangaDownloads: (mangaId) => ipcRenderer.invoke(IpcChannel.GET_MANGA_DOWNLOADS, mangaId),
    getAllMangaDownloads: () => ipcRenderer.invoke(IpcChannel.DOWNLOAD_GET_ALL_MANGA),
  },
  onAppUpdate: (callback) => {
    const subscription = (_event: any, data: any) => callback(data)
    ipcRenderer.on(IpcChannel.APP_UPDATE, subscription)
    return () => ipcRenderer.removeListener(IpcChannel.APP_UPDATE, subscription)
  },
  installUpdate: () => ipcRenderer.invoke(IpcChannel.INSTALL_UPDATE),
  checkForUpdates: () => ipcRenderer.invoke(IpcChannel.CHECK_FOR_UPDATE),
  openInternalBrowser: (url: string) => ipcRenderer.invoke(IpcChannel.OPEN_INTERNAL_BROWSER, url),
  cfBypass: (url: string) => ipcRenderer.invoke(IpcChannel.CF_BYPASS, url),
  cfFetchHtml: (url: string) => ipcRenderer.invoke(IpcChannel.CF_FETCH_HTML, url),
  platform: process.platform,
  version: ipcRenderer.sendSync(IpcChannel.GET_VERSION)
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
