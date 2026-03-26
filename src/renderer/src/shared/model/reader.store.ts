import { create } from 'zustand'
import { DataService } from '@renderer/shared/api'

export interface ReaderShortcuts {
  pause: string
  toggle: string
  boost: string
  slow: string
  reverse: string
}

export type ReadingMode = 
  | 'paged-ltr' 
  | 'paged-rtl' 
  | 'paged-vertical' 
  | 'continuous-ltr' 
  | 'continuous-rtl' 
  | 'continuous-vertical' 
  | 'webtoon'

interface ReaderState {
  defaultChapterSort: 'asc' | 'desc'
  readingMode: ReadingMode
  autoMarkRead: boolean
  preloadPages: number
  dragToScroll: boolean
  autoScrollEnabled: boolean
  autoScrollSpeed: number
  autoScrollShortcuts: ReaderShortcuts

  // Actions
  setDefaultChapterSort: (val: 'asc' | 'desc') => Promise<void>
  setReadingMode: (val: ReadingMode) => Promise<void>
  setAutoMarkRead: (val: boolean) => Promise<void>
  setPreloadPages: (val: number) => Promise<void>
  setDragToScroll: (val: boolean) => Promise<void>
  setAutoScrollEnabled: (val: boolean) => void
  setAutoScrollSpeed: (val: number) => void
  setShortcut: (action: keyof ReaderShortcuts, key: string) => Promise<void>
  
  // Init
  _init: (settings: Record<string, string>) => void
}

export const useReaderStore = create<ReaderState>((set) => ({
  defaultChapterSort: 'asc',
  readingMode: 'continuous-vertical',
  autoMarkRead: true,
  preloadPages: 3,
  dragToScroll: true,
  autoScrollEnabled: false,
  autoScrollSpeed: 2,
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

  _init: (settings) => {
    // Migration logic from old reader_mode/reader_direction
    let initialMode: ReadingMode = 'webtoon'
    
    if (settings.reading_mode_v2) {
      initialMode = settings.reading_mode_v2 as ReadingMode
    } else if (settings.reader_mode) {
      const oldMode = settings.reader_mode
      const oldDir = settings.reader_direction || 'ltr'
      
      if (oldMode === 'vertical') initialMode = 'continuous-vertical'
      else if (oldMode === 'paged') {
        initialMode = oldDir === 'rtl' ? 'paged-rtl' : 'paged-ltr'
      }
    }

    const shortcuts: ReaderShortcuts = {
      pause: settings.reader_shortcut_pause || 'Space',
      toggle: settings.reader_shortcut_toggle || 'Enter',
      boost: settings.reader_shortcut_boost || 'ArrowRight',
      slow: settings.reader_shortcut_slow || 'ArrowLeft',
      reverse: settings.reader_shortcut_reverse || 'ArrowUp',
    }

    set({
      defaultChapterSort: (settings.default_chapter_sort as 'asc' | 'desc') || 'asc',
      readingMode: initialMode,
      autoMarkRead: settings.auto_mark_read === 'true',
      preloadPages: parseInt(settings.preload_pages || '3'),
      dragToScroll: settings.drag_to_scroll === 'true',
      autoScrollShortcuts: shortcuts
    })
  }
}))
