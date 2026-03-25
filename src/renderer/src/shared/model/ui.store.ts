import { create } from 'zustand'

export type TabType = 'library' | 'history' | 'browse' | 'my-extensions' | 'downloads' | 'anime' | 'settings' | 'about'
export type ThemeType = 'light' | 'dark' | 'system'
export type ColorThemeType = 'default' | 'dabi' | 'itachi' | 'goku' | 'all-might' | 'gojo' | 'sung-jinwoo' | 'nanami' | 'slayer' | 'zoro' | 'naruto'

interface UIState {
  activeTab: TabType
  globalError: string | null
  updateStatus: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error'
  updateProgress: any | null
  updateError: string | null
  isCfBypassing: boolean
  cfDomain: string | null

  // Actions
  setActiveTab: (tab: TabType) => void
  setGlobalError: (error: string | null) => void
  setUpdateStatus: (status: UIState['updateStatus']) => void
  setUpdateProgress: (progress: any) => void
  setUpdateError: (error: string | null) => void
  setIsCfBypassing: (val: boolean, domain?: string | null) => void
}

export const useUIStore = create<UIState>((set) => {
  // Set up listeners
  if (window.api) {
    window.api.onCfStatus(({ status, domain }) => {
      set({ 
        isCfBypassing: status === 'started',
        cfDomain: status === 'started' ? (domain || null) : null
      })
    })
  }

  return {
    activeTab: 'browse',
    globalError: null,
    updateStatus: 'idle',
    updateProgress: null,
    updateError: null,
    isCfBypassing: false,
    cfDomain: null,

    setActiveTab: (tab) => set({ activeTab: tab }),
    setGlobalError: (err) => set({ globalError: err }),
    setUpdateStatus: (status) => set({ updateStatus: status }),
    setUpdateProgress: (progress) => set({ updateProgress: progress }),
    setUpdateError: (err) => set({ updateError: err }),
    setIsCfBypassing: (val, domain = null) => set({ isCfBypassing: val, cfDomain: domain }),
  }
})
