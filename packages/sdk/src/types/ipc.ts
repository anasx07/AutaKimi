import { Result } from "./result";
import { FetchOptions, FetchResult } from "./network";
import { Manga } from "./manga";
import { DownloadEntry } from "./download";
import { StateUpdateEvent, SystemState } from "./state";
import { Extension } from "./extension";
import { Chapter } from "./chapter";
import { HistoryEntry } from "./history";
import { Tracker, TrackerProvider, AniListUser, AniListMedia } from "./tracker";
import type {
  DiscordPresenceMediaInput,
  DiscordRpcStatus,
} from "../utils/discordPresence";
import type {
  EpisodeSkipTimes,
  SkipTimesRequest,
} from "../services/skipTimes.service";

export type IpcResult<T> = Result<T>;

/**
 * Centralized IPC channel definitions to avoid magic strings.
 */
export enum IpcChannel {
  INIT = "init",
  FETCH_REPO = "fetch-repo",
  FETCH_TEXT = "fetch-text",
  DETECT_THEME = "detect-theme",
  EXTENSION_INSTALL = "extension:install",

  DB_GET_EXTENSIONS = "db:get-extensions",
  DB_ADD_EXTENSION = "db:add-extension",
  DB_GET_EXTENSION = "db:get-extension",
  DB_REMOVE_EXTENSION = "db:remove-extension",

  DB_GET_LIBRARY = "db:get-library",
  DB_TOGGLE_LIBRARY = "db:toggle-library",
  DB_CLEAR_LIBRARY = "db:clear-library",

  DB_GET_SETTING = "db:get-setting",
  DB_GET_SETTINGS = "db:get-settings",
  DB_SET_SETTING = "db:set-setting",

  DB_GET_PROGRESS = "db:get-progress",
  DB_UPDATE_PROGRESS = "db:update-progress",
  DB_UPDATE_PROGRESS_BATCH = "db:update-progress-batch",

  DB_ADD_HISTORY = "db:add-history",
  DB_UPDATE_HISTORY_DURATION = "db:update-history-duration",
  DB_GET_HISTORY = "db:get-history",
  DB_DELETE_HISTORY_ENTRY = "db:delete-history-entry",
  DB_DELETE_HISTORY_BY_MANGA = "db:delete-history-by-manga",
  DB_CLEAR_HISTORY = "db:clear-history",

  DB_GET_CHAPTERS = "db:get-chapters",
  DB_SAVE_CHAPTERS = "db:save-chapters",

  DB_GET_MANGA_CACHE = "db:get-manga-cache",
  DB_SAVE_MANGA_CACHE = "db:save-manga-cache",

  EXECUTE_EXTENSION = "execute-extension",
  CANCEL_EXTENSION_EXECUTION = "execute-extension:cancel",
  CLEAR_CACHE = "clear-cache",
  CLEAR_COOKIES = "clear-cookies",
  OPEN_EXTERNAL = "open-external",

  // Window Controls
  WINDOW_MINIMIZE = "window:minimize",
  WINDOW_MAXIMIZE = "window:maximize",
  WINDOW_RESTORE = "window:restore",
  WINDOW_CLOSE = "window:close",
  WINDOW_IS_MAXIMIZED = "window:is-maximized",
  WINDOW_SET_FULLSCREEN = "window:set-fullscreen",
  WINDOW_IS_FULLSCREEN = "window:is-fullscreen",
  WINDOW_FULLSCREEN_CHANGE = "window:fullscreen-change",
  WINDOW_UPDATE_OVERLAY = "window:update-overlay",

  // Downloads
  DOWNLOAD_CHAPTER = "download:chapter",
  CANCEL_DOWNLOAD = "download:cancel",
  GET_DOWNLOAD_STATUS = "download:status",
  GET_MANGA_DOWNLOADS = "download:manga-list",
  DOWNLOAD_GET_ALL_MANGA = "download:get-all-manga",
  REMOVE_DOWNLOAD = "download:remove",
  DOWNLOAD_CLEAR_ALL = "download:clear-all",
  DOWNLOAD_EVENT = "download:event",
  GET_SYSTEM_STATE = "system:get-state",
  SYSTEM_STATE_UPDATE = "system:state-update",

  // App Updates
  APP_UPDATE = "app:update",
  INSTALL_UPDATE = "app:install-update",
  CHECK_FOR_UPDATE = "app:check-for-update",
  GET_VERSION = "app:get-version",
  OPEN_INTERNAL_BROWSER = "open-internal-browser",
  CF_BYPASS = "cf:bypass",
  CF_FETCH_HTML = "cf:fetch-html",
  CF_STATUS = "cf:status",

  // Synchronization
  SYNC_START_SERVER = "sync:start-server",
  SYNC_STOP_SERVER = "sync:stop-server",
  SYNC_GET_STATUS = "sync:get-status",
  SYNC_GET_PAIRING_PAYLOAD = "sync:get-pairing-payload",

  // Source Repositories
  SOURCES_GET_REPOS = "sources:get-repos",
  SOURCES_ADD_REPO = "sources:add-repo",
  SOURCES_REMOVE_REPO = "sources:remove-repo",
  SOURCES_REFRESH_ALL = "sources:refresh-all",
  SOURCES_GET_ALL = "sources:get-all",
  SOURCES_GET_CATALOG_EXTENSIONS = "sources:get-catalog-extensions",
  SOURCES_SELECT_DIRECTORY = "sources:select-directory",

  // Plugins
  PLUGINS_GET_ALL = "plugins:get-all",
  PLUGINS_TOGGLE = "plugins:toggle",
  PLUGINS_INSTALL = "plugins:install",
  PLUGINS_UNINSTALL = "plugins:uninstall",

  // Streaming
  SET_STREAM_HEADERS = "stream:set-headers",
  PROBE_STREAM = "stream:probe",

  // Trackers
  DB_GET_TRACKERS = "db:get-trackers",
  DB_SAVE_TRACKER = "db:save-tracker",
  DB_DELETE_TRACKER = "db:delete-tracker",
  TRACKER_AUTH_ANILIST = "tracker:auth-anilist",
  TRACKER_GET_USER_ANILIST = "tracker:get-user-anilist",
  TRACKER_SET_TOKEN_ANILIST = "tracker:set-token-anilist",
  TRACKER_LOGOUT_ANILIST = "tracker:logout-anilist",
  TRACKER_SEARCH_ANILIST = "tracker:search-anilist",
  TRACKER_GET_MEDIA_ANILIST = "tracker:get-media-anilist",
  TRACKER_UPDATE_ANILIST = "tracker:update-anilist",
  TRACKER_PROCESS_QUEUE = "tracker:process-queue",
  TRACKER_GET_SKIP_TIMES = "tracker:get-skip-times",

  // Backup
  BACKUP_EXPORT = "backup:export",
  BACKUP_IMPORT = "backup:import",

  // Discord Rich Presence
  DISCORD_RPC_SET_ACTIVITY = "discord:set-activity",
  DISCORD_RPC_CLEAR = "discord:clear",
  DISCORD_RPC_GET_STATUS = "discord:get-status",
}

/**
 * Mapping of IPC channels to their function signatures for `ipcRenderer.invoke` / `ipcMain.handle`.
 */
export type IpcInvokeMap = {
  [IpcChannel.INIT]: () => Promise<IpcResult<void>>;
  [IpcChannel.FETCH_REPO]: (url: string) => Promise<IpcResult<any>>;
  [IpcChannel.FETCH_TEXT]: (
    url: string,
    options?: FetchOptions,
  ) => Promise<IpcResult<FetchResult>>;
  [IpcChannel.DETECT_THEME]: (baseUrl: string) => Promise<IpcResult<string>>;

  [IpcChannel.SYNC_START_SERVER]: () => Promise<
    IpcResult<{ success: boolean; port: number; ip: string }>
  >;
  [IpcChannel.SYNC_STOP_SERVER]: () => Promise<IpcResult<void>>;
  [IpcChannel.SYNC_GET_STATUS]: () => Promise<
    IpcResult<{
      isRunning: boolean;
      port: number;
      ip: string;
      deviceId: string;
    }>
  >;
  [IpcChannel.SYNC_GET_PAIRING_PAYLOAD]: (args: {
    ip: string;
    port: number;
  }) => Promise<IpcResult<string>>;

  [IpcChannel.SOURCES_GET_REPOS]: () => Promise<IpcResult<string[]>>;
  [IpcChannel.SOURCES_ADD_REPO]: (
    url: string,
  ) => Promise<IpcResult<{ success: boolean; count: number; error?: string }>>;
  [IpcChannel.SOURCES_REMOVE_REPO]: (url: string) => Promise<IpcResult<void>>;
  [IpcChannel.SOURCES_REFRESH_ALL]: () => Promise<
    IpcResult<{ totalCount: number }>
  >;
  [IpcChannel.SOURCES_GET_ALL]: () => Promise<IpcResult<any[]>>;
  [IpcChannel.SOURCES_GET_CATALOG_EXTENSIONS]: (
    lang?: string,
  ) => Promise<IpcResult<Extension[]>>;
  [IpcChannel.SOURCES_SELECT_DIRECTORY]: () => Promise<
    IpcResult<string | null>
  >;

  [IpcChannel.PLUGINS_GET_ALL]: () => Promise<IpcResult<any[]>>;
  [IpcChannel.PLUGINS_TOGGLE]: (
    id: string,
    enabled: boolean,
  ) => Promise<IpcResult<void>>;
  [IpcChannel.PLUGINS_INSTALL]: (plugin: any) => Promise<IpcResult<void>>;
  [IpcChannel.PLUGINS_UNINSTALL]: (id: string) => Promise<IpcResult<void>>;

  [IpcChannel.DB_GET_EXTENSIONS]: () => Promise<IpcResult<Extension[]>>;
  [IpcChannel.DB_ADD_EXTENSION]: (args: {
    pkg: string;
    code?: string;
    name?: string;
    baseUrl?: string;
    lang?: string;
    icon?: string;
    nsfw?: boolean;
  }) => Promise<IpcResult<{ success?: boolean; error?: string }>>;
  [IpcChannel.DB_GET_EXTENSION]: (
    pkg: string,
  ) => Promise<IpcResult<Extension | null>>;
  [IpcChannel.DB_REMOVE_EXTENSION]: (
    pkg: string,
  ) => Promise<IpcResult<boolean>>;
  [IpcChannel.DB_GET_LIBRARY]: (args?: {
    limit?: number;
    offset?: number;
    type?: string;
  }) => Promise<IpcResult<Manga[]>>;
  [IpcChannel.DB_TOGGLE_LIBRARY]: (manga: Manga) => Promise<IpcResult<boolean>>;
  [IpcChannel.DB_GET_SETTING]: (
    key: string,
  ) => Promise<IpcResult<string | null>>;
  [IpcChannel.DB_GET_SETTINGS]: () => Promise<
    IpcResult<Record<string, string>>
  >;
  [IpcChannel.DB_SET_SETTING]: (
    key: string,
    value: string,
  ) => Promise<IpcResult<{ success?: boolean; error?: string }>>;
  [IpcChannel.DB_GET_PROGRESS]: (
    mangaId: string,
  ) => Promise<
    IpcResult<{ chapterId: string; isRead: boolean; lastPage: number }[]>
  >;
  [IpcChannel.DB_UPDATE_PROGRESS]: (args: {
    mangaId: string;
    chapterId: string;
    isRead: boolean;
    lastPage?: number;
    chapterNumber?: number;
  }) => Promise<IpcResult<{ success?: boolean; error?: string }>>;
  [IpcChannel.DB_UPDATE_PROGRESS_BATCH]: (args: {
    mangaId: string;
    chapterIds: string[];
    isRead: boolean;
    lastPage?: number;
  }) => Promise<IpcResult<{ success?: boolean; error?: string }>>;
  [IpcChannel.DB_ADD_HISTORY]: (args: {
    mangaId: string;
    mangaTitle?: string;
    mangaCover?: string;
    mangaUrl?: string;
    chapterId: string;
    chapterTitle?: string;
    startedAt: string;
    durationSeconds?: number;
    pkg?: string;
    type?: "manga" | "anime";
  }) => Promise<IpcResult<{ success?: boolean; error?: string }>>;
  [IpcChannel.DB_UPDATE_HISTORY_DURATION]: (args: {
    mangaId: string;
    chapterId: string;
    durationSeconds: number;
  }) => Promise<IpcResult<{ success?: boolean; error?: string }>>;
  [IpcChannel.DB_GET_HISTORY]: (
    args?: { limit?: number; offset?: number; type?: string } | number,
  ) => Promise<IpcResult<HistoryEntry[]>>;
  [IpcChannel.DB_DELETE_HISTORY_ENTRY]: (
    id: number,
  ) => Promise<IpcResult<{ success?: boolean; error?: string }>>;
  [IpcChannel.DB_DELETE_HISTORY_BY_MANGA]: (
    mangaId: string,
  ) => Promise<IpcResult<{ success?: boolean; error?: string }>>;
  [IpcChannel.DB_CLEAR_HISTORY]: (
    type?: string,
  ) => Promise<IpcResult<{ success?: boolean; error?: string }>>;
  [IpcChannel.DB_CLEAR_LIBRARY]: (
    type?: string,
  ) => Promise<IpcResult<{ success?: boolean; error?: string }>>;
  [IpcChannel.DB_GET_CHAPTERS]: (
    mangaId: string,
  ) => Promise<IpcResult<Chapter[]>>;
  [IpcChannel.DB_SAVE_CHAPTERS]: (args: {
    mangaId: string;
    chapters: Chapter[];
  }) => Promise<IpcResult<{ success?: boolean; error?: string }>>;
  [IpcChannel.DB_GET_MANGA_CACHE]: (
    mangaId: string,
  ) => Promise<IpcResult<Manga | null>>;
  [IpcChannel.DB_SAVE_MANGA_CACHE]: (
    manga: Manga,
  ) => Promise<IpcResult<{ success?: boolean; error?: string }>>;

  [IpcChannel.EXECUTE_EXTENSION]: (args: {
    pkg: string;
    code: string;
    contextArgs?: Record<string, unknown>;
    taskId?: string;
  }) => Promise<IpcResult<any>>;
  [IpcChannel.CANCEL_EXTENSION_EXECUTION]: (
    taskId: string,
  ) => Promise<IpcResult<boolean>>;
  [IpcChannel.EXTENSION_INSTALL]: (
    ext: Extension,
    repoUrl: string,
  ) => Promise<IpcResult<{ success?: boolean; error?: string }>>;

  [IpcChannel.CLEAR_CACHE]: () => Promise<
    IpcResult<{ success?: boolean; error?: string }>
  >;
  [IpcChannel.CLEAR_COOKIES]: () => Promise<
    IpcResult<{ success?: boolean; error?: string }>
  >;
  [IpcChannel.OPEN_EXTERNAL]: (url: string) => Promise<IpcResult<void>>;
  [IpcChannel.OPEN_INTERNAL_BROWSER]: (url: string) => Promise<IpcResult<void>>;

  [IpcChannel.WINDOW_MINIMIZE]: () => Promise<IpcResult<void>>;
  [IpcChannel.WINDOW_MAXIMIZE]: () => Promise<IpcResult<void>>;
  [IpcChannel.WINDOW_RESTORE]: () => Promise<IpcResult<void>>;
  [IpcChannel.WINDOW_CLOSE]: () => Promise<IpcResult<void>>;
  [IpcChannel.WINDOW_IS_MAXIMIZED]: () => Promise<IpcResult<boolean>>;
  [IpcChannel.WINDOW_SET_FULLSCREEN]: (
    flag: boolean,
  ) => Promise<IpcResult<void>>;
  [IpcChannel.WINDOW_IS_FULLSCREEN]: () => Promise<IpcResult<boolean>>;
  [IpcChannel.WINDOW_UPDATE_OVERLAY]: (options: {
    color: string;
    symbolColor: string;
  }) => Promise<IpcResult<void>>;

  [IpcChannel.DOWNLOAD_CHAPTER]: (args: {
    mangaId: string;
    chapterId: string;
    pageUrls: string[];
    type: "manga" | "anime";
    mangaTitle?: string;
    extensionName?: string;
    chapterTitle?: string;
  }) => Promise<IpcResult<boolean>>;
  [IpcChannel.CANCEL_DOWNLOAD]: (args: {
    mangaId: string;
    chapterId: string;
  }) => Promise<IpcResult<boolean>>;
  [IpcChannel.GET_DOWNLOAD_STATUS]: (args: {
    mangaId: string;
    chapterId: string;
  }) => Promise<IpcResult<DownloadEntry | undefined>>;
  [IpcChannel.GET_MANGA_DOWNLOADS]: (
    mangaId: string,
  ) => Promise<IpcResult<DownloadEntry[]>>;
  [IpcChannel.DOWNLOAD_GET_ALL_MANGA]: (
    type?: string,
  ) => Promise<IpcResult<DownloadEntry[]>>;
  [IpcChannel.REMOVE_DOWNLOAD]: (args: {
    mangaId: string;
    chapterId: string;
  }) => Promise<IpcResult<boolean>>;
  [IpcChannel.DOWNLOAD_CLEAR_ALL]: (
    type?: string,
  ) => Promise<IpcResult<boolean>>;

  [IpcChannel.INSTALL_UPDATE]: () => Promise<IpcResult<void>>;
  [IpcChannel.CHECK_FOR_UPDATE]: () => Promise<IpcResult<void>>;
  [IpcChannel.GET_VERSION]: () => string; // SendSync usually returns a value directly, but let's see

  [IpcChannel.CF_BYPASS]: (
    url: string,
    silent?: boolean,
  ) => Promise<IpcResult<boolean>>;
  [IpcChannel.CF_FETCH_HTML]: (
    url: string,
    silent?: boolean,
  ) => Promise<IpcResult<string | null>>;
  [IpcChannel.GET_SYSTEM_STATE]: () => Promise<IpcResult<SystemState>>;
  [IpcChannel.SET_STREAM_HEADERS]: (args: {
    url: string;
    headers: Record<string, string>;
  }) => Promise<IpcResult<boolean>>;
  [IpcChannel.PROBE_STREAM]: (args: {
    url: string;
    headers?: Record<string, string>;
    timeoutMs?: number;
  }) => Promise<
    IpcResult<{
      alive: boolean;
      status: number;
      pingMs: number;
      error?: string;
    }>
  >;

  [IpcChannel.DB_GET_TRACKERS]: (
    mangaId: string,
  ) => Promise<IpcResult<Tracker[]>>;
  [IpcChannel.DB_SAVE_TRACKER]: (
    tracker: Tracker,
  ) => Promise<IpcResult<{ success?: boolean; error?: string }>>;
  [IpcChannel.DB_DELETE_TRACKER]: (args: {
    mangaId: string;
    provider: TrackerProvider;
  }) => Promise<IpcResult<{ success?: boolean; error?: string }>>;
  [IpcChannel.TRACKER_AUTH_ANILIST]: () => Promise<
    IpcResult<{ token: string; user: AniListUser }>
  >;
  [IpcChannel.TRACKER_GET_USER_ANILIST]: () => Promise<
    IpcResult<AniListUser | null>
  >;
  [IpcChannel.TRACKER_SET_TOKEN_ANILIST]: (
    token: string,
  ) => Promise<IpcResult<AniListUser>>;
  [IpcChannel.TRACKER_LOGOUT_ANILIST]: () => Promise<IpcResult<void>>;
  [IpcChannel.TRACKER_SEARCH_ANILIST]: (args: {
    query: string;
    type?: "ANIME" | "MANGA";
  }) => Promise<IpcResult<AniListMedia[]>>;
  [IpcChannel.TRACKER_GET_MEDIA_ANILIST]: (
    mediaId: number,
  ) => Promise<IpcResult<AniListMedia | null>>;
  [IpcChannel.TRACKER_UPDATE_ANILIST]: (args: {
    mediaId: number;
    status?: string;
    progress?: number;
    score?: number;
  }) => Promise<IpcResult<any>>;
  [IpcChannel.TRACKER_PROCESS_QUEUE]: () => Promise<
    IpcResult<{ processed: number; succeeded: number; failed: number }>
  >;
  [IpcChannel.TRACKER_GET_SKIP_TIMES]: (
    args: SkipTimesRequest,
  ) => Promise<IpcResult<EpisodeSkipTimes | null>>;

  [IpcChannel.BACKUP_EXPORT]: () => Promise<
    IpcResult<{
      success: boolean;
      canceled?: boolean;
      filePath?: string;
      counts?: any;
      error?: string;
    }>
  >;
  [IpcChannel.BACKUP_IMPORT]: () => Promise<
    IpcResult<{
      success: boolean;
      canceled?: boolean;
      counts?: any;
      error?: string;
    }>
  >;
  [IpcChannel.DISCORD_RPC_SET_ACTIVITY]: (
    input: DiscordPresenceMediaInput,
  ) => Promise<IpcResult<DiscordRpcStatus>>;
  [IpcChannel.DISCORD_RPC_CLEAR]: () => Promise<IpcResult<DiscordRpcStatus>>;
  [IpcChannel.DISCORD_RPC_GET_STATUS]: () => Promise<
    IpcResult<DiscordRpcStatus>
  >;
};

/**
 * Mapping of IPC channels to their event payloads for `ipcRenderer.on`.
 */
export type IpcEventMap = {
  [IpcChannel.APP_UPDATE]: (data: {
    status: string;
    version?: string;
    manual?: boolean;
    progress?: {
      percent: number;
      bytesPerSecond: number;
      total: number;
      transferred: number;
    };
    error?: string;
  }) => void;
  [IpcChannel.WINDOW_FULLSCREEN_CHANGE]: (isFullScreen: boolean) => void;
  [IpcChannel.DOWNLOAD_EVENT]: (data: {
    type: "start" | "progress" | "completed" | "error" | "canceled";
    mangaId: string;
    chapterId: string;
    cached?: number;
    total?: number;
    error?: string;
  }) => void;
  [IpcChannel.CF_STATUS]: (data: {
    status: "started" | "completed" | "failed";
    domain?: string;
  }) => void;
  ["CACHE_INVALIDATE"]: (data: { group: string; key?: string }) => void;
  [IpcChannel.SYSTEM_STATE_UPDATE]: (data: StateUpdateEvent) => void;
};

/**
 * Formal interface for the `window.api` bridge.
 * Methods return IpcResult<T> to be handled via callIpc.
 */
export interface ElectronApi {
  init: IpcInvokeMap[IpcChannel.INIT];
  fetchRepo: IpcInvokeMap[IpcChannel.FETCH_REPO];
  fetchText: IpcInvokeMap[IpcChannel.FETCH_TEXT];
  detectTheme: IpcInvokeMap[IpcChannel.DETECT_THEME];
  sync: {
    startServer: IpcInvokeMap[IpcChannel.SYNC_START_SERVER];
    stopServer: IpcInvokeMap[IpcChannel.SYNC_STOP_SERVER];
    getStatus: IpcInvokeMap[IpcChannel.SYNC_GET_STATUS];
    getPairingPayload: IpcInvokeMap[IpcChannel.SYNC_GET_PAIRING_PAYLOAD];
  };
  sources: {
    getRepos: IpcInvokeMap[IpcChannel.SOURCES_GET_REPOS];
    addRepo: IpcInvokeMap[IpcChannel.SOURCES_ADD_REPO];
    removeRepo: IpcInvokeMap[IpcChannel.SOURCES_REMOVE_REPO];
    refreshAll: IpcInvokeMap[IpcChannel.SOURCES_REFRESH_ALL];
    getAllSources: IpcInvokeMap[IpcChannel.SOURCES_GET_ALL];
    getCatalogExtensions: IpcInvokeMap[IpcChannel.SOURCES_GET_CATALOG_EXTENSIONS];
    selectDirectory: IpcInvokeMap[IpcChannel.SOURCES_SELECT_DIRECTORY];
  };
  plugins: {
    getAll: IpcInvokeMap[IpcChannel.PLUGINS_GET_ALL];
    toggle: IpcInvokeMap[IpcChannel.PLUGINS_TOGGLE];
    install: IpcInvokeMap[IpcChannel.PLUGINS_INSTALL];
    uninstall: IpcInvokeMap[IpcChannel.PLUGINS_UNINSTALL];
  };
  db: {
    getExtensions: IpcInvokeMap[IpcChannel.DB_GET_EXTENSIONS];
    addExtension: IpcInvokeMap[IpcChannel.DB_ADD_EXTENSION];
    getExtension: IpcInvokeMap[IpcChannel.DB_GET_EXTENSION];
    removeExtension: IpcInvokeMap[IpcChannel.DB_REMOVE_EXTENSION];
    getLibrary: IpcInvokeMap[IpcChannel.DB_GET_LIBRARY];
    toggleLibrary: IpcInvokeMap[IpcChannel.DB_TOGGLE_LIBRARY];
    getSetting: IpcInvokeMap[IpcChannel.DB_GET_SETTING];
    getSettings: IpcInvokeMap[IpcChannel.DB_GET_SETTINGS];
    setSetting: IpcInvokeMap[IpcChannel.DB_SET_SETTING];
    getProgress: IpcInvokeMap[IpcChannel.DB_GET_PROGRESS];
    updateProgress: IpcInvokeMap[IpcChannel.DB_UPDATE_PROGRESS];
    updateProgressBatch: IpcInvokeMap[IpcChannel.DB_UPDATE_PROGRESS_BATCH];
    addHistory: IpcInvokeMap[IpcChannel.DB_ADD_HISTORY];
    updateHistoryDuration: IpcInvokeMap[IpcChannel.DB_UPDATE_HISTORY_DURATION];
    getHistory: IpcInvokeMap[IpcChannel.DB_GET_HISTORY];
    deleteHistoryEntry: IpcInvokeMap[IpcChannel.DB_DELETE_HISTORY_ENTRY];
    deleteHistoryByManga: IpcInvokeMap[IpcChannel.DB_DELETE_HISTORY_BY_MANGA];
    clearHistory: IpcInvokeMap[IpcChannel.DB_CLEAR_HISTORY];
    clearLibrary: IpcInvokeMap[IpcChannel.DB_CLEAR_LIBRARY];
    getChapters: IpcInvokeMap[IpcChannel.DB_GET_CHAPTERS];
    saveChapters: IpcInvokeMap[IpcChannel.DB_SAVE_CHAPTERS];
    getMangaCache: IpcInvokeMap[IpcChannel.DB_GET_MANGA_CACHE];
    saveMangaCache: IpcInvokeMap[IpcChannel.DB_SAVE_MANGA_CACHE];
  };
  clearCache: IpcInvokeMap[IpcChannel.CLEAR_CACHE];
  clearCookies: IpcInvokeMap[IpcChannel.CLEAR_COOKIES];
  executeExtension: IpcInvokeMap[IpcChannel.EXECUTE_EXTENSION];
  cancelExtensionExecution: IpcInvokeMap[IpcChannel.CANCEL_EXTENSION_EXECUTION];
  installExtension: IpcInvokeMap[IpcChannel.EXTENSION_INSTALL];
  openExternal: IpcInvokeMap[IpcChannel.OPEN_EXTERNAL];
  download: {
    start: IpcInvokeMap[IpcChannel.DOWNLOAD_CHAPTER];
    cancel: IpcInvokeMap[IpcChannel.CANCEL_DOWNLOAD];
    getStatus: IpcInvokeMap[IpcChannel.GET_DOWNLOAD_STATUS];
    getMangaDownloads: IpcInvokeMap[IpcChannel.GET_MANGA_DOWNLOADS];
    getAllMangaDownloads: IpcInvokeMap[IpcChannel.DOWNLOAD_GET_ALL_MANGA];
    remove: IpcInvokeMap[IpcChannel.REMOVE_DOWNLOAD];
    clearAll: IpcInvokeMap[IpcChannel.DOWNLOAD_CLEAR_ALL];
  };
  window: {
    minimize: IpcInvokeMap[IpcChannel.WINDOW_MINIMIZE];
    maximize: IpcInvokeMap[IpcChannel.WINDOW_MAXIMIZE];
    restore: IpcInvokeMap[IpcChannel.WINDOW_RESTORE];
    close: IpcInvokeMap[IpcChannel.WINDOW_CLOSE];
    isMaximized: IpcInvokeMap[IpcChannel.WINDOW_IS_MAXIMIZED];
    setFullScreen: IpcInvokeMap[IpcChannel.WINDOW_SET_FULLSCREEN];
    isFullScreen: IpcInvokeMap[IpcChannel.WINDOW_IS_FULLSCREEN];
    onFullScreenChange: (
      callback: IpcEventMap[IpcChannel.WINDOW_FULLSCREEN_CHANGE],
    ) => () => void;
    updateOverlay: IpcInvokeMap[IpcChannel.WINDOW_UPDATE_OVERLAY];
    openExternal: IpcInvokeMap[IpcChannel.OPEN_EXTERNAL];
    openInternalBrowser: IpcInvokeMap[IpcChannel.OPEN_INTERNAL_BROWSER];
  };
  onAppUpdate: (callback: IpcEventMap[IpcChannel.APP_UPDATE]) => () => void;
  onDownloadEvent: (
    callback: IpcEventMap[IpcChannel.DOWNLOAD_EVENT],
  ) => () => void;
  onCfStatus: (callback: IpcEventMap[IpcChannel.CF_STATUS]) => () => void;
  onCacheInvalidate: (callback: IpcEventMap["CACHE_INVALIDATE"]) => () => void;
  installUpdate: IpcInvokeMap[IpcChannel.INSTALL_UPDATE];
  checkForUpdates: IpcInvokeMap[IpcChannel.CHECK_FOR_UPDATE];
  openInternalBrowser: IpcInvokeMap[IpcChannel.OPEN_INTERNAL_BROWSER];
  cfBypass: IpcInvokeMap[IpcChannel.CF_BYPASS];
  cfFetchHtml: IpcInvokeMap[IpcChannel.CF_FETCH_HTML];
  setStreamHeaders: IpcInvokeMap[IpcChannel.SET_STREAM_HEADERS];
  probeStream: IpcInvokeMap[IpcChannel.PROBE_STREAM];
  getSystemState: IpcInvokeMap[IpcChannel.GET_SYSTEM_STATE];
  onSystemStateUpdate: (
    callback: IpcEventMap[IpcChannel.SYSTEM_STATE_UPDATE],
  ) => () => void;
  trackers: {
    getByManga: IpcInvokeMap[IpcChannel.DB_GET_TRACKERS];
    save: IpcInvokeMap[IpcChannel.DB_SAVE_TRACKER];
    delete: IpcInvokeMap[IpcChannel.DB_DELETE_TRACKER];
    authAniList: IpcInvokeMap[IpcChannel.TRACKER_AUTH_ANILIST];
    getUserAniList: IpcInvokeMap[IpcChannel.TRACKER_GET_USER_ANILIST];
    setTokenAniList: IpcInvokeMap[IpcChannel.TRACKER_SET_TOKEN_ANILIST];
    logoutAniList: IpcInvokeMap[IpcChannel.TRACKER_LOGOUT_ANILIST];
    searchAniList: IpcInvokeMap[IpcChannel.TRACKER_SEARCH_ANILIST];
    getMediaAniList: IpcInvokeMap[IpcChannel.TRACKER_GET_MEDIA_ANILIST];
    updateAniList: IpcInvokeMap[IpcChannel.TRACKER_UPDATE_ANILIST];
    processQueue: IpcInvokeMap[IpcChannel.TRACKER_PROCESS_QUEUE];
    getSkipTimes: IpcInvokeMap[IpcChannel.TRACKER_GET_SKIP_TIMES];
  };
  backup: {
    export: IpcInvokeMap[IpcChannel.BACKUP_EXPORT];
    import: IpcInvokeMap[IpcChannel.BACKUP_IMPORT];
  };
  discord: {
    setActivity: IpcInvokeMap[IpcChannel.DISCORD_RPC_SET_ACTIVITY];
    clear: IpcInvokeMap[IpcChannel.DISCORD_RPC_CLEAR];
    getStatus: IpcInvokeMap[IpcChannel.DISCORD_RPC_GET_STATUS];
  };
  platform: string;
  version: string;
}
