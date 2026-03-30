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
  updateProgress: { percent: number } | null
  updateError: string | null
  isCfBypassing: boolean
  cfDomain: string | null
  viewMode: ViewMode
  // Actions
  setActiveTab: (tab: TabType) => void
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
  setUpdateStatus: (status: UIState['updateStatus']) => void
  setUpdateProgress: (progress: { percent: number }) => void
  setUpdateError: (error: string | null) => void
  setIsCfBypassing: (val: boolean, domain?: string | null) => void
  setViewMode: (mode: ViewMode) => void
  _init: (settings: SettingsSchema['ui']) => void
}

export const useUIStore = create<UIState>((set) => ({
  activeTab: 'library',
  toasts: [],
  updateStatus: 'idle',
  updateProgress: null,
  updateError: null,
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
  setUpdateProgress: (updateProgress) => set({ updateProgress }),
  setUpdateError: (updateError) => set({ updateError }),

  setIsCfBypassing: (isCfBypassing, cfDomain = null) => set({ isCfBypassing, cfDomain }),

  setViewMode: (viewMode) => set({ viewMode }),

  _init: (settings) => {
    set({
      viewMode: settings?.viewMode || 'grid'
    })
  }
}))
