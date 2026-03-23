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
}

/**
 * Formal interface for the `window.api` bridge.
 */
export interface ElectronApi {
  fetchRepo: (url: string) => Promise<any>;
  fetchText: (url: string, options?: any) => Promise<string | null>;
  detectTheme: (baseUrl: string) => Promise<string>;
  db: {
    getExtensions: () => Promise<any[]>;
    addExtension: (args: { pkg: string; code?: string; name?: string; baseUrl?: string; lang?: string; icon?: string }) => Promise<{ success?: boolean; error?: string }>;
    getExtension: (pkg: string) => Promise<any | null>;
    removeExtension: (pkg: string) => Promise<boolean>;
    getLibrary: () => Promise<any[]>;
    toggleLibrary: (manga: any) => Promise<boolean>;
    getSetting: (key: string) => Promise<string | null>;
    getSettings: () => Promise<Record<string, string>>;
    setSetting: (key: string, value: string) => Promise<{ success?: boolean; error?: string }>;
    getProgress: (mangaId: string) => Promise<{ chapterId: string, isRead: boolean, lastPage: number }[]>;
    updateProgress: (args: { mangaId: string; chapterId: string; isRead: boolean; lastPage?: number }) => Promise<{ success?: boolean; error?: string }>;
    addHistory: (args: { mangaId: string; mangaTitle?: string; mangaCover?: string; mangaUrl?: string; chapterId: string; chapterTitle?: string; startedAt: string; durationSeconds?: number; pkg?: string }) => Promise<{ success?: boolean; error?: string }>;
    getHistory: (args?: { limit?: number; offset?: number } | number) => Promise<any[]>;
    deleteHistoryEntry: (id: number) => Promise<{ success?: boolean; error?: string }>;
    deleteHistoryByManga: (mangaId: string) => Promise<{ success?: boolean; error?: string }>;
    clearHistory: () => Promise<{ success?: boolean; error?: string }>;
    getChapters: (mangaId: string) => Promise<any[]>;
    saveChapters: (args: { mangaId: string; chapters: any[] }) => Promise<{ success?: boolean; error?: string }>;
    getMangaCache: (mangaId: string) => Promise<any | null>;
    saveMangaCache: (manga: any) => Promise<{ success?: boolean; error?: string }>;
  };
  clearCache: () => Promise<{ success?: boolean; error?: string }>;
  clearCookies: () => Promise<{ success?: boolean; error?: string }>;
  executeExtension: (args: { pkg: string; code: string; contextArgs?: any }) => Promise<any>;
  installExtension: (ext: any, repoUrl: string) => Promise<{ success?: boolean; error?: string }>;
  openExternal: (url: string) => Promise<void>;
  download: {
    start: (args: { mangaId: string; chapterId: string; pageUrls: string[] }) => Promise<{ ok: boolean; error?: string }>;
    cancel: (args: { mangaId: string; chapterId: string }) => Promise<{ ok: boolean; error?: string }>;
    getStatus: (args: { mangaId: string; chapterId: string }) => Promise<{ ok: boolean; value: any; error?: string }>;
    getMangaDownloads: (mangaId: string) => Promise<{ ok: boolean; value: any[]; error?: string }>;
    getAllMangaDownloads: () => Promise<{ ok: boolean; value: any[]; error?: string }>;
  };
  platform: string;
  window: {
    minimize: () => Promise<void>;
    maximize: () => Promise<void>;
    restore: () => Promise<void>;
    close: () => Promise<void>;
    isMaximized: () => Promise<boolean>;
    updateOverlay: (options: { color: string, symbolColor: string }) => Promise<void>;
  };
}
