import { create } from 'zustand'
import { DataService } from '@renderer/shared/api'
import { ThemeType, ColorThemeType } from './ui.store'

interface SettingsState {
  bypassCloudflare: boolean
  userAgent: string
  timeoutInterval: string
  enableLog: boolean
  downloadConcurrency: number
  minimizeToTray: boolean

  // UI Settings added
  theme: ThemeType
  colorTheme: ColorThemeType
  displayMode: 'grid' | 'list'
  showNsfw: boolean
  selectedLangs: string[]
  autoNextAnime: boolean
  autoSwitchServer: boolean
  pinnedAnimeSources: string[]

  // Actions
  setBypassCloudflare: (val: boolean) => Promise<void>
  setUserAgent: (val: string) => Promise<void>
  setTimeoutInterval: (val: string) => Promise<void>
  setEnableLog: (val: boolean) => Promise<void>
  setDownloadConcurrency: (val: number) => Promise<void>
  setMinimizeToTray: (val: boolean) => Promise<void>
  setAutoNextAnime: (val: boolean) => Promise<void>
  setAutoSwitchServer: (val: boolean) => Promise<void>
  
  // UI Actions added
  setTheme: (theme: ThemeType) => Promise<void>
  setColorTheme: (colorTheme: ColorThemeType) => Promise<void>
  setDisplayMode: (mode: 'grid' | 'list') => Promise<void>
  setShowNsfw: (val: boolean) => Promise<void>
  setSelectedLangs: (langs: string[]) => Promise<void>
  togglePinnedAnimeSource: (pkg: string) => Promise<void>
  
  // Init
  _init: (settings: Record<string, string>) => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
  bypassCloudflare: true,
  userAgent: '',
  timeoutInterval: '30000',
  enableLog: false,
  downloadConcurrency: 3,
  minimizeToTray: true,

  
  // UI Settings Defaults
  theme: 'system',
  colorTheme: 'default',
  displayMode: 'grid',
  showNsfw: false,
  selectedLangs: ['all'],
  autoNextAnime: true,
  autoSwitchServer: true,
  pinnedAnimeSources: [],

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
      const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      if (isDark) document.documentElement.classList.add('dark')
      else document.documentElement.classList.remove('dark')
    } catch (e) {
      console.error('Failed to save theme:', e)
    }
  },

  setColorTheme: async (colorTheme) => {
    try {
      await DataService.db.setSetting('colorTheme', colorTheme)
      set({ colorTheme })
      document.documentElement.classList.forEach(className => {
        if (className.startsWith('theme-')) document.documentElement.classList.remove(className)
      })
      if (colorTheme !== 'default') document.documentElement.classList.add(`theme-${colorTheme}`)
    } catch (e) {
      console.error('Failed to save color theme:', e)
    }
  },

  setDisplayMode: async (mode) => {
    try {
      await DataService.db.setSetting('displayMode', mode)
      set({ displayMode: mode })
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

  togglePinnedAnimeSource: async (pkg) => {
    try {
      set((state) => {
        const isPinned = state.pinnedAnimeSources.includes(pkg)
        const newList = isPinned
          ? state.pinnedAnimeSources.filter((p) => p !== pkg)
          : [...state.pinnedAnimeSources, pkg]

        DataService.db.setSetting('pinnedAnimeSources', JSON.stringify(newList))
        return { pinnedAnimeSources: newList }
      })
    } catch (e) {
      console.error('Failed to toggle pinned source:', e)
    }
  },

  _init: (settings) => {
    const theme = (settings.theme as ThemeType) || 'system'
    const colorTheme = (settings.colorTheme as ColorThemeType) || 'default'
    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

    if (isDark) document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')

    document.documentElement.classList.forEach(className => {
      if (className.startsWith('theme-')) document.documentElement.classList.remove(className)
    })
    if (colorTheme !== 'default') document.documentElement.classList.add(`theme-${colorTheme}`)

    set({
      bypassCloudflare: settings.bypass_cloudflare === 'false' ? false : true,
      userAgent: settings.user_agent || '',
      timeoutInterval: settings.timeout_interval || '30000',
      enableLog: settings.enable_log === 'true',
      downloadConcurrency: settings.download_concurrency ? parseInt(settings.download_concurrency) : 3,

      // UI Settings Init
      selectedLangs: settings.selectedLangs ? JSON.parse(settings.selectedLangs) : ['all'],
      showNsfw: settings.showNsfw === 'true',
      displayMode: (settings.displayMode as 'grid' | 'list') || 'grid',
      theme,
      colorTheme,
      minimizeToTray: settings.minimize_to_tray !== 'false', // Default true
      autoNextAnime: settings.autoNextAnime !== 'false',    // Default true
      autoSwitchServer: settings.autoSwitchServer !== 'false', // Default true
      pinnedAnimeSources: settings.pinnedAnimeSources ? JSON.parse(settings.pinnedAnimeSources) : [],
    })
  }
}))
