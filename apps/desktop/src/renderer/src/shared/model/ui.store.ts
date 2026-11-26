import { create } from 'zustand'
import { TabType, ViewMode } from '@common/types'
import { SettingsSchema } from '@common/types'

export type ToastType = 'error' | 'success' | 'warn' | 'info'

export interface Toast {
  id: string
  title?: string
  message: string
  type: ToastType
  duration?: number
}

export interface UIState {
  activeTab: TabType
  toasts: Toast[]
  updateStatus: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error'
  updateVersion: string | null
  updateProgress: { percent: number } | null
  updateError: string | null
  updateDismissed: boolean
  updateCheckManual: boolean
  isWindowFullscreen: boolean
  isCfBypassing: boolean
  cfDomain: string | null
  viewMode: ViewMode
  // Actions
  setActiveTab: (tab: TabType) => void
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
  setUpdateStatus: (status: UIState['updateStatus']) => void
  setUpdateVersion: (version: string | null) => void
  setUpdateProgress: (progress: { percent: number }) => void
  setUpdateError: (error: string | null) => void
  setUpdateDismissed: (dismissed: boolean) => void
  setUpdateCheckManual: (manual: boolean) => void
  setIsWindowFullscreen: (fullscreen: boolean) => void
  setIsCfBypassing: (val: boolean, domain?: string | null) => void
  setViewMode: (mode: ViewMode) => void
  _init: (settings: SettingsSchema['ui']) => void
}

export const useUIStore = create<UIState>((set) => ({
  activeTab: 'library',
  toasts: [],
  updateStatus: 'idle',
  updateVersion: null,
  updateProgress: null,
  updateError: null,
  updateDismissed: false,
  updateCheckManual: false,
  isWindowFullscreen: false,
  isCfBypassing: false,
  cfDomain: null,
  viewMode: 'grid',

  setActiveTab: (activeTab) => set({ activeTab }),

  addToast: (toast) => {
    const id = Math.random().toString(36).substring(2, 9)
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }]
    }))

    if (toast.duration !== 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id)
        }))
      }, toast.duration || 3000)
    }
  },

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id)
    })),

  setUpdateStatus: (updateStatus) => set({ updateStatus }),
  setUpdateVersion: (updateVersion) => set({ updateVersion }),
  setUpdateProgress: (updateProgress) => set({ updateProgress }),
  setUpdateError: (updateError) => set({ updateError }),
  setUpdateDismissed: (updateDismissed) => set({ updateDismissed }),
  setUpdateCheckManual: (updateCheckManual) => set({ updateCheckManual }),
  setIsWindowFullscreen: (isWindowFullscreen) => set({ isWindowFullscreen }),

  setIsCfBypassing: (isCfBypassing, cfDomain = null) => set({ isCfBypassing, cfDomain }),

  setViewMode: (viewMode) => set({ viewMode }),

  _init: (settings) => {
    set({
      viewMode: settings?.viewMode || 'grid'
    })
  }
}))
