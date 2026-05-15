import { contextBridge, ipcRenderer, webFrame } from 'electron'
import { IpcChannel, type ElectronApi, type IpcInvokeMap, type IpcEventMap } from '../main/types/ipc'
import type { FetchOptions } from '@common/types/network'

const invoke = <K extends keyof IpcInvokeMap>(
  channel: K,
  ...args: Parameters<IpcInvokeMap[K]>
): ReturnType<IpcInvokeMap[K]> => ipcRenderer.invoke(channel, ...args) as any

const on = <K extends keyof IpcEventMap>(channel: string, callback: (...args: any[]) => void) => {
  const subscription = (_event: any, data: any) => callback(data)
  ipcRenderer.on(channel, subscription)
  return () => ipcRenderer.removeListener(channel, subscription)
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
    getCatalogExtensions: () => invoke(IpcChannel.SOURCES_GET_CATALOG_EXTENSIONS)
  },
  plugins: {
    getAll: () => invoke(IpcChannel.PLUGINS_GET_ALL),
    toggle: (id: string, enabled: boolean) => invoke(IpcChannel.PLUGINS_TOGGLE, id, enabled)
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
    addHistory: (args) => invoke(IpcChannel.DB_ADD_HISTORY, args),
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
  installExtension: (ext, repoUrl) => invoke(IpcChannel.EXTENSION_INSTALL, ext, repoUrl),
  openExternal: (url: string) => invoke(IpcChannel.OPEN_EXTERNAL, url),
  window: {
    minimize: () => invoke(IpcChannel.WINDOW_MINIMIZE),
    maximize: () => invoke(IpcChannel.WINDOW_MAXIMIZE),
    restore: () => invoke(IpcChannel.WINDOW_RESTORE),
    close: () => invoke(IpcChannel.WINDOW_CLOSE),
    isMaximized: () => invoke(IpcChannel.WINDOW_IS_MAXIMIZED),
    updateOverlay: (options) => invoke(IpcChannel.WINDOW_UPDATE_OVERLAY, options)
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
  getSystemState: () => invoke(IpcChannel.GET_SYSTEM_STATE),
  onSystemStateUpdate: (callback) => on(IpcChannel.SYSTEM_STATE_UPDATE, callback),
  platform: process.platform,
  version: ipcRenderer.sendSync(IpcChannel.GET_VERSION)
}


// Expose APIs to the renderer via contextBridge.
try {
  contextBridge.exposeInMainWorld('api', api)
} catch (error) {
  console.error('[Preload] Failed to expose API via contextBridge:', error)
}

// ============================================================================
// Cloudflare Stealth & Security Bypass (Executes immediately in Main World)
// ============================================================================
webFrame.executeJavaScript(`
  try {
    const w = window;
    const n = navigator;

    // 1. Bypass TrustedTypes/TrustedHTML requirement
    if (w.trustedTypes && w.trustedTypes.createPolicy) {
      if (!w.trustedTypes.defaultPolicy) {
        w.trustedTypes.createPolicy('default', {
          createHTML: s => s,
          createScript: s => s,
          createScriptURL: s => s
        });
      }
    }

    // 2. Hide automation (Must be false, not undefined, to match retail browsers)
    Object.defineProperty(n, 'webdriver', { get: () => false });

    // 3. Mimic retail Chrome UserAgentData dynamically based on the actual engine version
    if (n.userAgentData) {
      const match = n.userAgent.match(/Chrome\\/([0-9]+)\\./);
      const version = match ? match[1] : '120';

      Object.defineProperty(n, 'userAgentData', {
        get: () => ({
          brands: [
            { brand: 'Google Chrome', version: version },
            { brand: 'Chromium', version: version },
            { brand: 'Not:A-Brand', version: '24' }
          ],
          mobile: false,
          platform: 'Windows'
        })
      });
    }

    // 4. Mimic languages, vendor, and platform
    Object.defineProperty(n, 'languages', { get: () => ['en-US', 'en'] });
    Object.defineProperty(n, 'vendor', { get: () => 'Google Inc.' });
    Object.defineProperty(n, 'platform', { get: () => 'Win32' });

    // 5. Mimic hardware specs
    Object.defineProperty(n, 'deviceMemory', { get: () => 8 });
    Object.defineProperty(n, 'hardwareConcurrency', { get: () => 8 });

    // 6. Shim chrome object
    w.chrome = {
      runtime: {},
      loadTimes: function () {},
      csi: function () {},
      app: {}
    };

    // 7. Shim plugins
    const mockPlugins = [
      { name: 'PDF Viewer', filename: 'internal-pdf-viewer' },
      { name: 'Chrome PDF Viewer', filename: 'internal-pdf-viewer' },
      { name: 'Chromium PDF Viewer', filename: 'internal-pdf-viewer' },
      { name: 'Microsoft Edge PDF Viewer', filename: 'internal-pdf-viewer' },
      { name: 'WebKit built-in PDF', filename: 'internal-pdf-viewer' }
    ];
    Object.defineProperty(n, 'plugins', { get: () => mockPlugins });
    Object.defineProperty(n, 'mimeTypes', { get: () => ({ length: 0 }) });

    // 8. Ensure window dimensions look realistic
    if (w.outerWidth === 0) w.outerWidth = w.innerWidth || 1024;
    if (w.outerHeight === 0) w.outerHeight = w.innerHeight || 768;

    // 9. Shim Notification permissions
    const originalQuery = n.permissions.query;
    n.permissions.query = function (parameters) {
      return parameters.name === 'notifications'
        ? Promise.resolve({ state: Notification.permission })
        : originalQuery.call(this, parameters);
    };

    // 10. Inject TrustedTypes policy into dynamically created iframes (about:srcdoc)
    const originalSetAttribute = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function(name, value) {
      if (this.tagName === 'IFRAME' && name === 'srcdoc') {
        const injection = '<script>if(window.trustedTypes && window.trustedTypes.createPolicy && !window.trustedTypes.defaultPolicy) { window.trustedTypes.createPolicy("default", { createHTML: s => s, createScript: s => s, createScriptURL: s => s }); }<\\/script>';
        value = injection + value;
      }
      return originalSetAttribute.call(this, name, value);
    };
  } catch (e) {
    console.error('Stealth injection failed:', e);
  }
`);
