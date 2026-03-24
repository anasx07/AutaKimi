import { create } from 'zustand'
import { DataService } from '@renderer/shared/api'

interface ReaderState {
  defaultChapterSort: 'asc' | 'desc'
  readerMode: 'vertical' | 'paged'
  readerDirection: 'ltr' | 'rtl'
  autoMarkRead: boolean
  preloadPages: number

  // Actions
  setDefaultChapterSort: (val: 'asc' | 'desc') => Promise<void>
  setReaderMode: (val: 'vertical' | 'paged') => Promise<void>
  setReaderDirection: (val: 'ltr' | 'rtl') => Promise<void>
  setAutoMarkRead: (val: boolean) => Promise<void>
  setPreloadPages: (val: number) => Promise<void>
  
  // Init
  _init: (settings: Record<string, string>) => void
}

export const useReaderStore = create<ReaderState>((set) => ({
  defaultChapterSort: 'desc',
  readerMode: 'vertical',
  readerDirection: 'ltr',
  autoMarkRead: true,
  preloadPages: 3,

  setDefaultChapterSort: async (val) => {
    await DataService.db.setSetting('default_chapter_sort', val)
    set({ defaultChapterSort: val })
  },

  setReaderMode: async (val) => {
    await DataService.db.setSetting('reader_mode', val)
    set({ readerMode: val })
  },

  setReaderDirection: async (val) => {
    await DataService.db.setSetting('reader_direction', val)
    set({ readerDirection: val })
  },

  setAutoMarkRead: async (val) => {
    await DataService.db.setSetting('auto_mark_read', val ? 'true' : 'false')
    set({ autoMarkRead: val })
  },

  setPreloadPages: async (val) => {
    await DataService.db.setSetting('preload_pages', val.toString())
    set({ preloadPages: val })
  },

  _init: (settings) => {
    set({
      defaultChapterSort: (settings.default_chapter_sort as 'asc' | 'desc') || 'desc',
      readerMode: (settings.reader_mode as 'vertical' | 'paged') || 'vertical',
      readerDirection: (settings.reader_direction as 'ltr' | 'rtl') || 'ltr',
      autoMarkRead: settings.auto_mark_read === 'false' ? false : true,
      preloadPages: parseInt(settings.preload_pages || '3'),
    })
  }
}))
