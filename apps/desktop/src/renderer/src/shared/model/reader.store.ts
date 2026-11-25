import { create } from 'zustand'
import { DataService } from '@renderer/shared/api'
import { SettingsSchema, ReadingMode, ReaderShortcuts, EyeCareTintPreset } from '@common/types'
import {
  clampEyeCareValue,
  EYE_CARE_PRESETS,
  MAX_EYE_CARE_DIMMING,
  MAX_EYE_CARE_WARMTH
} from '@common/utils/eyeCare'

type ReaderState = SettingsSchema['reader'] & {
  // Runtime state (not persisted in schema category directly)
  autoScrollEnabled: boolean
  autoScrollSpeed: number

  // Actions
  setDefaultChapterSort: (val: 'asc' | 'desc') => Promise<void>
  setReadingMode: (val: ReadingMode) => Promise<void>
  setAutoMarkRead: (val: boolean) => Promise<void>
  setPreloadPages: (val: number) => Promise<void>
  setDragToScroll: (val: boolean) => Promise<void>
  setAutoScrollEnabled: (val: boolean) => void
  setAutoScrollSpeed: (val: number) => void
  setShortcut: (action: keyof ReaderShortcuts, key: string) => Promise<void>
  setReaderTheme: (val: 'match-app' | 'light' | 'dark' | 'system') => Promise<void>
  setCropBorders: (val: boolean) => Promise<void>
  setEyeCareEnabled: (val: boolean) => Promise<void>
  setEyeCareTint: (val: EyeCareTintPreset) => Promise<void>
  setEyeCareWarmth: (val: number) => Promise<void>
  setEyeCareDimming: (val: number) => Promise<void>
  applyEyeCarePreset: (preset: EyeCareTintPreset) => Promise<void>

  // Init
  _init: (settings: SettingsSchema['reader']) => void
}

export const useReaderStore = create<ReaderState>((set) => ({
  defaultChapterSort: 'asc',
  readingMode: 'webtoon',
  autoMarkRead: true,
  preloadPages: 3,
  dragToScroll: true,
  autoScrollEnabled: false,
  autoScrollSpeed: 2,
  cropBorders: false,
  readerTheme: 'dark', // traditionally the reader has been dark
  eyeCareEnabled: false,
  eyeCareTint: 'sepia',
  eyeCareWarmth: 45,
  eyeCareDimming: 30,
  autoScrollShortcuts: {
    pause: 'Space',
    toggle: 'Enter',
    boost: 'ArrowRight',
    slow: 'ArrowLeft',
    reverse: 'ArrowUp'
  },

  setDefaultChapterSort: async (val) => {
    await DataService.db.setSetting('default_chapter_sort', val)
    set({ defaultChapterSort: val })
  },

  setReadingMode: async (val) => {
    await DataService.db.setSetting('reading_mode_v2', val)
    set({ readingMode: val })
  },

  setAutoMarkRead: async (val) => {
    await DataService.db.setSetting('auto_mark_read', val ? 'true' : 'false')
    set({ autoMarkRead: val })
  },

  setPreloadPages: async (val) => {
    await DataService.db.setSetting('preload_pages', val.toString())
    set({ preloadPages: val })
  },

  setDragToScroll: async (val) => {
    await DataService.db.setSetting('drag_to_scroll', val ? 'true' : 'false')
    set({ dragToScroll: val })
  },

  setAutoScrollEnabled: (val) => set({ autoScrollEnabled: val }),
  setAutoScrollSpeed: (val) => set({ autoScrollSpeed: val }),

  setShortcut: async (action, key) => {
    set((state) => {
      const nextShortcuts = { ...state.autoScrollShortcuts, [action]: key }
      // Persist
      DataService.db.setSetting(`reader_shortcut_${action}`, key)
      return { autoScrollShortcuts: nextShortcuts }
    })
  },

  setReaderTheme: async (val) => {
    await DataService.db.setSetting('reader_theme', val)
    set({ readerTheme: val })
  },

  setCropBorders: async (val) => {
    await DataService.db.setSetting('crop_borders', val ? 'true' : 'false')
    set({ cropBorders: val })
  },

  setEyeCareEnabled: async (val) => {
    set({ eyeCareEnabled: val })
    await DataService.db.setSetting('eye_care_enabled', val ? 'true' : 'false')
  },

  setEyeCareTint: async (val) => {
    set({ eyeCareTint: val })
    await DataService.db.setSetting('eye_care_tint', val)
  },

  setEyeCareWarmth: async (val) => {
    const clamped = clampEyeCareValue(val, 0, MAX_EYE_CARE_WARMTH)
    set({ eyeCareWarmth: clamped })
    await DataService.db.setSetting('eye_care_warmth', clamped.toString())
  },

  setEyeCareDimming: async (val) => {
    const clamped = clampEyeCareValue(val, 0, MAX_EYE_CARE_DIMMING)
    set({ eyeCareDimming: clamped })
    await DataService.db.setSetting('eye_care_dimming', clamped.toString())
  },

  applyEyeCarePreset: async (preset) => {
    const meta = EYE_CARE_PRESETS[preset]
    set({
      eyeCareEnabled: true,
      eyeCareTint: preset,
      eyeCareWarmth: meta.defaultWarmth,
      eyeCareDimming: meta.defaultDimming
    })
    await Promise.all([
      DataService.db.setSetting('eye_care_enabled', 'true'),
      DataService.db.setSetting('eye_care_tint', preset),
      DataService.db.setSetting('eye_care_warmth', meta.defaultWarmth.toString()),
      DataService.db.setSetting('eye_care_dimming', meta.defaultDimming.toString())
    ])
  },

  _init: (settings) => {
    set({
      ...settings,
      cropBorders: settings?.cropBorders ?? false,
      eyeCareEnabled: settings?.eyeCareEnabled ?? false,
      eyeCareTint: settings?.eyeCareTint ?? 'sepia',
      eyeCareWarmth: clampEyeCareValue(settings?.eyeCareWarmth ?? 45, 0, MAX_EYE_CARE_WARMTH),
      eyeCareDimming: clampEyeCareValue(settings?.eyeCareDimming ?? 30, 0, MAX_EYE_CARE_DIMMING),
      autoScrollEnabled: false,
      autoScrollSpeed: 2
    })
  }
}))
