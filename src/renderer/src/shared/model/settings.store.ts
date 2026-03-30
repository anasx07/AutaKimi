import { create } from 'zustand'
import { DataService } from '@renderer/shared/api'
import { SettingsSchema, ThemeType, ColorThemeType, ViewMode } from '@common/types'

type SettingsState = SettingsSchema['app'] &
  SettingsSchema['network'] &
  SettingsSchema['download'] & {
    displayMode: ViewMode
    // Actions
    setBypassCloudflare: (val: boolean) => Promise<void>
    setUserAgent: (val: string) => Promise<void>
    setTimeoutInterval: (val: string) => Promise<void>
    setEnableLog: (val: boolean) => Promise<void>
    setDownloadConcurrency: (val: number) => Promise<void>
    setMinimizeToTray: (val: boolean) => Promise<void>
    setAutoNextAnime: (val: boolean) => Promise<void>
    setAutoSwitchServer: (val: boolean) => Promise<void>

    // UI Actions (App category)
    setTheme: (theme: ThemeType) => Promise<void>
    setColorTheme: (colorTheme: ColorThemeType) => Promise<void>
    setDisplayMode: (mode: ViewMode) => Promise<void>
    setShowNsfw: (val: boolean) => Promise<void>
    setSelectedLangs: (langs: string[]) => Promise<void>

    // Init
    _init: (settings: SettingsSchema) => void
  }

/**
 * Shared utility to apply theme and color theme classes to the document
 */
const applyTheme = (theme: ThemeType, colorTheme: ColorThemeType) => {
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
  minimizeToTray: true,
  showNsfw: false,
  selectedLangs: ['all'],
  autoNextAnime: true,
  autoSwitchServer: true,

  // Network
  bypassCloudflare: true,
  userAgent: '',
  timeoutInterval: '30000',
  enableLog: false,

  // Download
  downloadConcurrency: 3,

  // We add displayMode for compatibility with existing UI (mapped to ui.viewMode in DB)
  displayMode: 'grid',

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

  setMinimizeToTray: async (val) => {
    await DataService.db.setSetting('minimize_to_tray', val.toString())
    set({ minimizeToTray: val })
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

  setTheme: async (theme) => {
    try {
      await DataService.db.setSetting('theme', theme)
      set({ theme })
      applyTheme(theme, get().colorTheme)
    } catch (e) {
      console.error('Failed to save theme:', e)
    }
  },

  setColorTheme: async (colorTheme) => {
    try {
      await DataService.db.setSetting('colorTheme', colorTheme)
      set({ colorTheme })
      applyTheme(get().theme, colorTheme)
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

  _init: (settings) => {
    const { theme, colorTheme } = settings.app

    // Apply theme and color theme logic via extracted utility
    applyTheme(theme, colorTheme)

    set({
      ...settings.app,
      ...settings.network,
      ...settings.download,
      displayMode: settings.ui.viewMode
    })
  }
}))
