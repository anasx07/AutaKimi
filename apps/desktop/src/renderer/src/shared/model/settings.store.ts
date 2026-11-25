import { create } from 'zustand'
import { DataService } from '@renderer/shared/api'
import {
  SettingsSchema,
  ThemeType,
  ColorThemeType,
  ViewMode,
  CustomThemeConfig,
  DEFAULT_CUSTOM_THEME
} from '@common/types'
import {
  applyCustomThemeVariables,
  clearCustomThemeVariables
} from '@renderer/shared/lib/colorUtils'

type SettingsState = SettingsSchema['app'] &
  SettingsSchema['network'] &
  SettingsSchema['download'] & {
    displayMode: ViewMode
    devMode: boolean
    // Actions
    setBypassCloudflare: (val: boolean) => Promise<void>
    setUserAgent: (val: string) => Promise<void>
    setTimeoutInterval: (val: string) => Promise<void>
    setEnableLog: (val: boolean) => Promise<void>
    setDownloadConcurrency: (val: number) => Promise<void>
    setAutoNextAnime: (val: boolean) => Promise<void>
    setAutoSwitchServer: (val: boolean) => Promise<void>
    setAutoOsPipOnBlur: (val: boolean) => Promise<void>
    setDevMode: (val: boolean) => Promise<void>

    // UI Actions (App category)
    setTheme: (theme: ThemeType) => Promise<void>
    setColorTheme: (colorTheme: ColorThemeType) => Promise<void>
    customThemeConfig: CustomThemeConfig
    setCustomThemeConfig: (config: Partial<CustomThemeConfig>) => Promise<void>
    setDisplayMode: (mode: ViewMode) => Promise<void>
    setShowNsfw: (val: boolean) => Promise<void>
    setSelectedLangs: (langs: string[]) => Promise<void>
    browseMediaType: 'manga' | 'anime'
    browseSection: 'sources' | 'extensions' | 'repositories'
    setBrowseMediaType: (val: 'manga' | 'anime') => Promise<void>
    setBrowseSection: (val: 'sources' | 'extensions' | 'repositories') => Promise<void>
    libraryMediaType: 'manga' | 'anime'
    downloadsMediaType: 'manga' | 'anime'
    historyMediaType: 'manga' | 'anime'
    setLibraryMediaType: (val: 'manga' | 'anime') => Promise<void>
    setDownloadsMediaType: (val: 'manga' | 'anime') => Promise<void>
    setHistoryMediaType: (val: 'manga' | 'anime') => Promise<void>
    lockMediaTabs: boolean
    setLockMediaTabs: (val: boolean) => Promise<void>

    // Init
    _init: (settings: SettingsSchema) => void
  }

/**
 * Shared utility to apply theme and color theme classes to the document
 * Guarded against non-browser environments (React Native, SSR)
 */
const applyTheme = (
  theme: ThemeType,
  colorTheme: ColorThemeType,
  customConfig?: CustomThemeConfig
) => {
  if (typeof document === 'undefined' || typeof window === 'undefined') return

  // Persist to localStorage for zero-flicker boot in index.html
  try {
    localStorage.setItem('theme', theme)
    localStorage.setItem('colorTheme', colorTheme)
  } catch {}

  if (colorTheme === 'custom') {
    applyCustomThemeVariables(customConfig || DEFAULT_CUSTOM_THEME)
    return
  }

  // Clear any active custom CSS variable overrides
  clearCustomThemeVariables()

  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  if (isDark) document.documentElement.classList.add('dark')
  else document.documentElement.classList.remove('dark')

  document.documentElement.classList.forEach((className) => {
    if (className.startsWith('theme-')) document.documentElement.classList.remove(className)
  })

  if (colorTheme !== 'default') {
    document.documentElement.classList.add(`theme-${colorTheme}`)
  }
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  // App
  theme: 'system',
  colorTheme: 'default',
  customThemeConfig: DEFAULT_CUSTOM_THEME,
  showNsfw: false,
  selectedLangs: ['all'],
  browseMediaType: 'manga',
  browseSection: 'sources',
  libraryMediaType: 'manga',
  downloadsMediaType: 'manga',
  historyMediaType: 'manga',
  lockMediaTabs: false,
  autoNextAnime: true,
  autoSwitchServer: true,
  autoOsPipOnBlur: false,
  devMode: false,

  // Network
  bypassCloudflare: true,
  userAgent: '',
  timeoutInterval: '30000',
  enableLog: false,

  // Download
  downloadConcurrency: 3,

  // We add displayMode for compatibility with existing UI (mapped to ui.viewMode in DB)
  displayMode: 'grid',

  setCustomThemeConfig: async (partial) => {
    try {
      const current = get().customThemeConfig || DEFAULT_CUSTOM_THEME
      const updated = { ...current, ...partial }
      await DataService.db.setSetting('custom_theme_config', JSON.stringify(updated))
      set({ customThemeConfig: updated })
      if (get().colorTheme === 'custom') {
        applyCustomThemeVariables(updated)
      }
    } catch (e) {
      console.error('Failed to save customThemeConfig:', e)
    }
  },

  setBypassCloudflare: async (val) => {
    await DataService.db.setSetting('bypass_cloudflare', val.toString())
    set({ bypassCloudflare: val })
  },

  setUserAgent: async (val) => {
    await DataService.db.setSetting('user_agent', val)
    set({ userAgent: val })
  },

  setTimeoutInterval: async (val) => {
    await DataService.db.setSetting('timeout_interval', val)
    set({ timeoutInterval: val })
  },

  setEnableLog: async (val) => {
    await DataService.db.setSetting('enable_log', val.toString())
    set({ enableLog: val })
  },

  setDownloadConcurrency: async (val) => {
    const clamped = Math.max(1, Math.min(5, val))
    await DataService.db.setSetting('download_concurrency', clamped.toString())
    set({ downloadConcurrency: clamped })
  },

  setAutoNextAnime: async (val) => {
    try {
      await DataService.db.setSetting('autoNextAnime', val ? 'true' : 'false')
      set({ autoNextAnime: val })
    } catch (e) {
      console.error('Failed to save autoNextAnime:', e)
    }
  },

  setAutoSwitchServer: async (val) => {
    try {
      await DataService.db.setSetting('autoSwitchServer', val ? 'true' : 'false')
      set({ autoSwitchServer: val })
    } catch (e) {
      console.error('Failed to save autoSwitchServer:', e)
    }
  },

  setAutoOsPipOnBlur: async (val) => {
    try {
      await DataService.db.setSetting('autoOsPipOnBlur', val ? 'true' : 'false')
      set({ autoOsPipOnBlur: val })
    } catch (e) {
      console.error('Failed to save autoOsPipOnBlur:', e)
    }
  },

  setDevMode: async (val) => {
    try {
      await DataService.db.setSetting('devMode', val ? 'true' : 'false')
      set({ devMode: val })
    } catch (e) {
      console.error('Failed to save devMode:', e)
    }
  },

  setTheme: async (theme) => {
    try {
      await DataService.db.setSetting('theme', theme)
      set({ theme })
      applyTheme(theme, get().colorTheme, get().customThemeConfig)
    } catch (e) {
      console.error('Failed to save theme:', e)
    }
  },

  setColorTheme: async (colorTheme) => {
    try {
      await DataService.db.setSetting('colorTheme', colorTheme)
      set({ colorTheme })
      applyTheme(get().theme, colorTheme, get().customThemeConfig)
    } catch (e) {
      console.error('Failed to save color theme:', e)
    }
  },

  setDisplayMode: async (mode) => {
    try {
      await DataService.db.setSetting('displayMode', mode)
      set({ displayMode: mode } as any)
    } catch (e) {
      console.error('Failed to save displayMode:', e)
    }
  },

  setShowNsfw: async (val) => {
    try {
      await DataService.db.setSetting('showNsfw', val ? 'true' : 'false')
      set({ showNsfw: val })
    } catch (e) {
      console.error('Failed to save showNsfw:', e)
    }
  },

  setSelectedLangs: async (langs) => {
    try {
      await DataService.db.setSetting('selectedLangs', JSON.stringify(langs))
      set({ selectedLangs: langs })
    } catch (e) {
      console.error('Failed to save selectedLangs:', e)
    }
  },

  setBrowseMediaType: async (val) => {
    try {
      await DataService.db.setSetting('browse_media_type', val)
      if (get().lockMediaTabs) {
        await Promise.all([
          DataService.db.setSetting('library_media_type', val),
          DataService.db.setSetting('downloads_media_type', val),
          DataService.db.setSetting('history_media_type', val)
        ])
        set({
          browseMediaType: val,
          libraryMediaType: val,
          downloadsMediaType: val,
          historyMediaType: val
        })
      } else {
        set({ browseMediaType: val })
      }
    } catch (e) {
      console.error('Failed to save browseMediaType:', e)
    }
  },

  setBrowseSection: async (val) => {
    try {
      await DataService.db.setSetting('browse_section', val)
      set({ browseSection: val })
    } catch (e) {
      console.error('Failed to save browseSection:', e)
    }
  },

  setLibraryMediaType: async (val) => {
    try {
      await DataService.db.setSetting('library_media_type', val)
      if (get().lockMediaTabs) {
        await Promise.all([
          DataService.db.setSetting('browse_media_type', val),
          DataService.db.setSetting('downloads_media_type', val),
          DataService.db.setSetting('history_media_type', val)
        ])
        set({
          libraryMediaType: val,
          browseMediaType: val,
          downloadsMediaType: val,
          historyMediaType: val
        })
      } else {
        set({ libraryMediaType: val })
      }
    } catch (e) {
      console.error('Failed to save libraryMediaType:', e)
    }
  },

  setDownloadsMediaType: async (val) => {
    try {
      await DataService.db.setSetting('downloads_media_type', val)
      if (get().lockMediaTabs) {
        await Promise.all([
          DataService.db.setSetting('browse_media_type', val),
          DataService.db.setSetting('library_media_type', val),
          DataService.db.setSetting('history_media_type', val)
        ])
        set({
          downloadsMediaType: val,
          browseMediaType: val,
          libraryMediaType: val,
          historyMediaType: val
        })
      } else {
        set({ downloadsMediaType: val })
      }
    } catch (e) {
      console.error('Failed to save downloadsMediaType:', e)
    }
  },

  setHistoryMediaType: async (val) => {
    try {
      await DataService.db.setSetting('history_media_type', val)
      if (get().lockMediaTabs) {
        await Promise.all([
          DataService.db.setSetting('browse_media_type', val),
          DataService.db.setSetting('library_media_type', val),
          DataService.db.setSetting('downloads_media_type', val)
        ])
        set({
          historyMediaType: val,
          browseMediaType: val,
          libraryMediaType: val,
          downloadsMediaType: val
        })
      } else {
        set({ historyMediaType: val })
      }
    } catch (e) {
      console.error('Failed to save historyMediaType:', e)
    }
  },

  setLockMediaTabs: async (val) => {
    try {
      await DataService.db.setSetting('lock_media_tabs', val ? 'true' : 'false')
      if (val) {
        const current = get().browseMediaType
        await Promise.all([
          DataService.db.setSetting('library_media_type', current),
          DataService.db.setSetting('downloads_media_type', current),
          DataService.db.setSetting('history_media_type', current)
        ])
        set({
          lockMediaTabs: val,
          libraryMediaType: current,
          downloadsMediaType: current,
          historyMediaType: current
        })
      } else {
        set({ lockMediaTabs: val })
      }
    } catch (e) {
      console.error('Failed to save lockMediaTabs:', e)
    }
  },

  _init: (settings) => {
    const { theme, colorTheme, customThemeConfig } = settings.app

    // Apply theme and color theme logic via extracted utility
    applyTheme(theme, colorTheme, customThemeConfig)

    set({
      ...settings.app,
      customThemeConfig: customThemeConfig || DEFAULT_CUSTOM_THEME,
      ...settings.network,
      ...settings.download,
      displayMode: settings.ui.viewMode
    })
  }
}))
