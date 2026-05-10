import { create } from 'zustand'
import { DataService } from '@renderer/shared/api'
import { SettingsSchema, ReadingMode, ReaderShortcuts } from '@common/types'

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
  readerTheme: 'dark', // traditionally the reader has been dark
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

  _init: (settings) => {
    set({
      ...settings,
      autoScrollEnabled: false,
      autoScrollSpeed: 2
    })
  }
}))
