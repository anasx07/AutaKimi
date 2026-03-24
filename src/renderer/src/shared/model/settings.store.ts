import { create } from 'zustand'
import { DataService } from '@renderer/shared/api'

interface SettingsState {
  bypassCloudflare: boolean
  userAgent: string
  timeoutInterval: string
  enableLog: boolean

  // Actions
  setBypassCloudflare: (val: boolean) => Promise<void>
  setUserAgent: (val: string) => Promise<void>
  setTimeoutInterval: (val: string) => Promise<void>
  setEnableLog: (val: boolean) => Promise<void>
  
  // Init
  _init: (settings: Record<string, string>) => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
  bypassCloudflare: true,
  userAgent: '',
  timeoutInterval: '30000',
  enableLog: false,

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

  _init: (settings) => {
    set({
      bypassCloudflare: settings.bypass_cloudflare === 'false' ? false : true,
      userAgent: settings.user_agent || '',
      timeoutInterval: settings.timeout_interval || '30000',
      enableLog: settings.enable_log === 'true',
    })
  }
}))
