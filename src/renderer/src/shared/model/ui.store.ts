import { create } from 'zustand'
import { DataService } from '@renderer/shared/api'

export type TabType = 'library' | 'history' | 'browse' | 'my-extensions' | 'downloads' | 'settings' | 'about'
export type ThemeType = 'light' | 'dark' | 'system'
export type ColorThemeType = 'default' | 'dabi' | 'itachi' | 'goku' | 'all-might'

interface UIState {
  activeTab: TabType
  theme: ThemeType
  colorTheme: ColorThemeType
  displayMode: 'grid' | 'list'
  showNsfw: boolean
  selectedLangs: string[]
  globalError: string | null
  updateStatus: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error'
  updateProgress: any | null
  updateError: string | null

  // Actions
  setActiveTab: (tab: TabType) => void
  setTheme: (theme: ThemeType) => Promise<void>
  setColorTheme: (colorTheme: ColorThemeType) => Promise<void>
  setDisplayMode: (mode: 'grid' | 'list') => Promise<void>
  setShowNsfw: (val: boolean) => Promise<void>
  setSelectedLangs: (langs: string[]) => Promise<void>
  setGlobalError: (error: string | null) => void
  setUpdateStatus: (status: UIState['updateStatus']) => void
  setUpdateProgress: (progress: any) => void
  setUpdateError: (error: string | null) => void
  
  // Internal initialization
  _initFromSettings: (settings: Record<string, string>) => void
}

export const useUIStore = create<UIState>((set) => ({
  activeTab: 'browse',
  theme: 'system',
  colorTheme: 'default',
  displayMode: 'grid',
  showNsfw: false,
  selectedLangs: ['all'],
  globalError: null,
  updateStatus: 'idle',
  updateProgress: null,
  updateError: null,

  setActiveTab: (tab) => set({ activeTab: tab }),
  
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
      document.documentElement.classList.remove('theme-dabi', 'theme-itachi', 'theme-goku', 'theme-all-might')
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

  setGlobalError: (err) => set({ globalError: err }),
  setUpdateStatus: (status) => set({ updateStatus: status }),
  setUpdateProgress: (progress) => set({ updateProgress: progress }),
  setUpdateError: (err) => set({ updateError: err }),

  _initFromSettings: (settings) => {
    set({
      selectedLangs: settings.selectedLangs ? JSON.parse(settings.selectedLangs) : ['all'],
      showNsfw: settings.showNsfw === 'true',
      displayMode: (settings.displayMode as 'grid' | 'list') || 'grid',
      theme: (settings.theme as any) || 'system',
      colorTheme: (settings.colorTheme as any) || 'default',
    })
    
    // Apply theme to DOM
    const theme = (settings.theme as any) || 'system'
    const colorTheme = (settings.colorTheme as any) || 'default'
    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    if (isDark) document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
    
    document.documentElement.classList.remove('theme-dabi', 'theme-itachi', 'theme-goku', 'theme-all-might')
    if (colorTheme !== 'default') document.documentElement.classList.add(`theme-${colorTheme}`)
  }
}))
