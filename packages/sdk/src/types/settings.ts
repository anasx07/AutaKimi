import { ThemeType, ColorThemeType, ViewMode } from './ui'
import { ReadingMode, ReaderShortcuts } from './reader'

export interface SettingsSchema {
  app: {
    theme: ThemeType
    colorTheme: ColorThemeType
    minimizeToTray: boolean
    showNsfw: boolean
    selectedLangs: string[]
    autoNextAnime: boolean
    autoSwitchServer: boolean
  }
  reader: {
    defaultChapterSort: 'asc' | 'desc'
    readingMode: ReadingMode
    autoMarkRead: boolean
    preloadPages: number
    dragToScroll: boolean
    readerTheme: 'match-app' | 'light' | 'dark' | 'system'
    autoScrollShortcuts: ReaderShortcuts
  }
  extensions: {
    pinnedExtensions: string[]
    extensionSortBy: 'name' | 'installed' | 'update' | 'supported'
    extensionSortOrder: 'asc' | 'desc'
    pinnedAnimeSources: string[]
    domainOverrides: Record<string, string>
    pluginsEnabled: string[]
  }
  network: {
    bypassCloudflare: boolean
    userAgent: string
    timeoutInterval: string
    enableLog: boolean
  }
  download: {
    downloadConcurrency: number
  }
  ui: {
    viewMode: ViewMode
  }
}

/**
 * Default settings fallback
 */
export const DEFAULT_SETTINGS: SettingsSchema = {
  app: {
    theme: 'system',
    colorTheme: 'default',
    minimizeToTray: true,
    showNsfw: false,
    selectedLangs: ['all'],
    autoNextAnime: true,
    autoSwitchServer: true
  },
  reader: {
    defaultChapterSort: 'asc',
    readingMode: 'continuous-vertical',
    autoMarkRead: true,
    preloadPages: 3,
    dragToScroll: true,
    readerTheme: 'dark',
    autoScrollShortcuts: {
      pause: 'Space',
      toggle: 'Enter',
      boost: 'ArrowRight',
      slow: 'ArrowLeft',
      reverse: 'ArrowUp'
    }
  },
  extensions: {
    pinnedExtensions: [],
    extensionSortBy: 'supported',
    extensionSortOrder: 'asc',
    pinnedAnimeSources: [],
    domainOverrides: {},
    pluginsEnabled: []
  },
  network: {
    bypassCloudflare: true,
    userAgent: '',
    timeoutInterval: '30000',
    enableLog: false
  },
  download: {
    downloadConcurrency: 3
  },
  ui: {
    viewMode: 'grid'
  }
}

/**
 * Map of snake_case database keys to camelCase SettingsSchema flat paths
 */
export const SETTINGS_KEY_MAP: Record<string, keyof SettingsSchema | string> = {
  // App
  theme: 'app.theme',
  colorTheme: 'app.colorTheme',
  minimize_to_tray: 'app.minimizeToTray',
  showNsfw: 'app.showNsfw',
  selectedLangs: 'app.selectedLangs',
  autoNextAnime: 'app.autoNextAnime',
  autoSwitchServer: 'app.autoSwitchServer',

  // Reader
  default_chapter_sort: 'reader.defaultChapterSort',
  reading_mode_v2: 'reader.readingMode',
  auto_mark_read: 'reader.autoMarkRead',
  preload_pages: 'reader.preloadPages',
  drag_to_scroll: 'reader.dragToScroll',
  reader_theme: 'reader.readerTheme',
  reader_shortcut_pause: 'reader.autoScrollShortcuts.pause',
  reader_shortcut_toggle: 'reader.autoScrollShortcuts.toggle',
  reader_shortcut_boost: 'reader.autoScrollShortcuts.boost',
  reader_shortcut_slow: 'reader.autoScrollShortcuts.slow',
  reader_shortcut_reverse: 'reader.autoScrollShortcuts.reverse',

  // Extensions
  pinned_extensions: 'extensions.pinnedExtensions',
  extension_sort_by: 'extensions.extensionSortBy',
  extension_sort_order: 'extensions.extensionSortOrder',
  pinnedAnimeSources: 'extensions.pinnedAnimeSources',
  pluginsEnabled: 'extensions.pluginsEnabled',

  // Network
  bypass_cloudflare: 'network.bypassCloudflare',
  user_agent: 'network.userAgent',
  timeout_interval: 'network.timeoutInterval',
  enable_log: 'network.enableLog',

  // Download
  download_concurrency: 'download.downloadConcurrency',

  // UI
  displayMode: 'ui.viewMode'
}
