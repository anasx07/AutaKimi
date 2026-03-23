import { create } from 'zustand'
import { DataService } from '@renderer/shared/api'
import { NormalizedManga } from '@common/utils/mangaNormalizer'
import { Chapter } from '@renderer/shared/api/sources/types'
import { useUIStore } from './ui.store'

export interface HistoryEntry {
  id: number
  mangaId: string
  mangaTitle?: string
  mangaCover?: string
  mangaUrl?: string
  chapterId: string
  chapterTitle?: string
  startedAt: string
  durationSeconds: number
  pkg?: string
}

export interface ExtensionMetadata {
  pkg: string
  name: string
  lang: string
  icon: string
  baseUrl: string
  version: string
}

interface LibraryState {
  installedExtensions: ExtensionMetadata[]
  activeExtension: string | null
  library: NormalizedManga[]
  selectedManga: NormalizedManga | null
  activeChapter: Chapter | null
  readingProgress: Record<string, string[]>
  pageProgress: Record<string, Record<string, number>>
  extensionSortBy: 'name' | 'installed' | 'update'
  extensionSortOrder: 'asc' | 'desc'
  domainOverrides: Record<string, string>
  historyEntries: HistoryEntry[]
  hasMoreHistory: boolean
  
  // Reader Settings
  defaultChapterSort: 'asc' | 'desc'
  readerMode: 'vertical' | 'paged'
  readerDirection: 'ltr' | 'rtl'
  autoMarkRead: boolean
  preloadPages: number

  // Cache
  chaptersCache: Record<string, any[]>
  pagesCache: Record<string, string[]>
  listCache: Record<string, any[]>
  offsetCache: Record<string, number>
  hasMoreCache: Record<string, boolean>
  batchCountCache: Record<string, number>

  // Actions
  loadFromDb: () => Promise<void>
  loadHistory: () => Promise<void>
  loadMoreHistory: () => Promise<void>
  addHistoryEntry: (entry: Omit<HistoryEntry, 'id'>) => Promise<void>
  deleteHistoryEntry: (id: number) => Promise<void>
  deleteHistoryByManga: (mangaId: string) => Promise<void>
  clearHistory: () => Promise<void>
  installExtension: (pkg: string) => Promise<void>
  uninstallExtension: (pkg: string) => Promise<void>
  setActiveExtension: (pkg: string | null) => void
  setDomainOverride: (pkg: string, domain: string | null) => Promise<void>
  toggleLibrary: (manga: NormalizedManga) => Promise<void>
  setSelectedManga: (manga: NormalizedManga | null) => void
  setActiveChapter: (chapter: Chapter | null) => void
  loadProgress: (mangaId: string) => Promise<void>
  markChapterRead: (mangaId: string, chapterId: string, isRead: boolean, lastPage?: number) => Promise<void>
  
  // Settings Actions
  setDefaultChapterSort: (val: 'asc' | 'desc') => Promise<void>
  setReaderMode: (val: 'vertical' | 'paged') => Promise<void>
  setReaderDirection: (val: 'ltr' | 'rtl') => Promise<void>
  setAutoMarkRead: (val: boolean) => Promise<void>
  setPreloadPages: (val: number) => Promise<void>
  setExtensionSortBy: (val: 'name' | 'installed' | 'update') => Promise<void>
  setExtensionSortOrder: (val: 'asc' | 'desc') => Promise<void>

  // Cache Actions
  setChaptersCache: (mangaId: string, chapters: any[]) => void
  setPagesCache: (chapterId: string, pages: string[]) => void
  setListCache: (feed: string, list: any[]) => void
  setOffsetCache: (feed: string, offset: number) => void
  setHasMoreCache: (feed: string, hasMore: boolean) => void
  setBatchCountCache: (feed: string, batchCount: number) => void
  clearFeedCache: () => void
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  installedExtensions: [],
  activeExtension: null,
  library: [],
  selectedManga: null,
  activeChapter: null,
  readingProgress: {},
  pageProgress: {},
  extensionSortBy: 'name',
  extensionSortOrder: 'asc',
  domainOverrides: {},
  historyEntries: [],
  hasMoreHistory: true,

  defaultChapterSort: 'desc',
  readerMode: 'vertical',
  readerDirection: 'ltr',
  autoMarkRead: true,
  preloadPages: 3,

  chaptersCache: {},
  pagesCache: {},
  listCache: {},
  offsetCache: {},
  hasMoreCache: {},
  batchCountCache: {},

  loadFromDb: async () => {
    try {
      const [installed, libraryItems, settingsMap] = await Promise.all([
        DataService.db.getExtensions(),
        DataService.db.getLibrary(),
        DataService.db.getSettings()
      ])

      const overrides: Record<string, string> = {}
      if (installed) {
        for (const ext of installed as ExtensionMetadata[]) {
          const domain = settingsMap[`domain_override_${ext.pkg}`]
          if (domain) overrides[ext.pkg] = domain
        }
      }

      set({
        installedExtensions: (installed as ExtensionMetadata[]) || [],
        library: libraryItems || [],
        domainOverrides: overrides,
        defaultChapterSort: (settingsMap.default_chapter_sort as 'asc' | 'desc') || 'desc',
        readerMode: (settingsMap.reader_mode as 'vertical' | 'paged') || 'vertical',
        readerDirection: (settingsMap.reader_direction as 'ltr' | 'rtl') || 'ltr',
        autoMarkRead: settingsMap.auto_mark_read === 'false' ? false : true,
        preloadPages: parseInt(settingsMap.preload_pages || '3'),
        extensionSortBy: (settingsMap.extension_sort_by as any) || 'name',
        extensionSortOrder: (settingsMap.extension_sort_order as any) || 'asc',
      })

      // Initialize UI Store from same settings
      useUIStore.getState()._initFromSettings(settingsMap)

      get().loadHistory()
    } catch (error) {
      console.error('Failed to load DB:', error)
    }
  },

  loadHistory: async () => {
    try {
      const history = await DataService.db.getHistory()
      set({ historyEntries: history, hasMoreHistory: history.length === 50 })
    } catch (e) {
      console.error('Failed to load history:', e)
    }
  },

  loadMoreHistory: async () => {
    try {
      const offset = get().historyEntries.length
      const history = await DataService.db.getHistory({ limit: 50, offset })
      if (history && history.length > 0) {
        set((state) => ({
          historyEntries: [...state.historyEntries, ...history],
          hasMoreHistory: history.length === 50
        }))
      } else {
        set({ hasMoreHistory: false })
      }
    } catch (e) {
      console.error('Failed to load more history:', e)
    }
  },

  addHistoryEntry: async (entry) => {
    try {
      await DataService.db.addHistory(entry)
      get().loadHistory()
    } catch (e) {
      console.error('Failed to add history:', e)
    }
  },

  deleteHistoryEntry: async (id) => {
    try {
      await DataService.db.deleteHistoryEntry(id)
      set((state) => ({
        historyEntries: state.historyEntries.filter((e) => e.id !== id)
      }))
    } catch (e) {
      console.error('Failed to delete history entry:', e)
    }
  },

  deleteHistoryByManga: async (mangaId) => {
    try {
      await DataService.db.deleteHistoryByManga(mangaId)
      set((state) => ({
        historyEntries: state.historyEntries.filter((e) => e.mangaId !== mangaId)
      }))
    } catch (e) {
      console.error('Failed to delete history by manga:', e)
    }
  },

  clearHistory: async () => {
    try {
      await DataService.db.clearHistory()
      set({ historyEntries: [] })
    } catch (e) {
      console.error('Failed to clear history:', e)
    }
  },

  installExtension: async () => {
    await get().loadFromDb()
  },

  uninstallExtension: async (pkg) => {
    await DataService.db.removeExtension(pkg)
    set((state) => ({ installedExtensions: state.installedExtensions.filter((e) => e.pkg !== pkg) }))
  },

  setActiveExtension: (pkg) => set({ activeExtension: pkg }),

  setDomainOverride: async (pkg, domain) => {
    await DataService.db.setSetting(`domain_override_${pkg}`, domain || '')
    set((state) => ({
      domainOverrides: { ...state.domainOverrides, [pkg]: domain || '' }
    }))
  },

  toggleLibrary: async (manga: NormalizedManga) => {
    try {
      await DataService.db.toggleLibrary(manga)
      set((state) => {
        const exists = state.library.find((m) => m.id === manga.id)
        const updated = exists
          ? state.library.filter((m) => m.id !== manga.id)
          : [...state.library, manga]
        return { library: updated }
      })
    } catch (e) {
      console.error('Failed to toggle library in DB:', e)
    }
  },

  setSelectedManga: (manga: NormalizedManga | null) => set(() => {
    const next: Partial<LibraryState> = { selectedManga: manga }
    if (manga && (manga as any).pkg) {
      next.activeExtension = (manga as any).pkg
    }
    return next
  }),

  setActiveChapter: (chapter: Chapter | null) => set({ activeChapter: chapter }),

  loadProgress: async (mangaId) => {
    try {
      const rows = await DataService.db.getProgress(mangaId) as any[]
      const readIds = rows.filter(r => !!r.isRead).map(r => r.chapterId)
      const pagesMap: Record<string, number> = {}
      rows.forEach(r => { if (r.lastPage > 0) pagesMap[r.chapterId] = r.lastPage })

      set((state) => ({
        readingProgress: { ...state.readingProgress, [mangaId]: readIds },
        pageProgress: { ...state.pageProgress, [mangaId]: pagesMap }
      }))
    } catch (error) {
      console.error('Failed to load progress:', error)
    }
  },

  markChapterRead: async (mangaId, chapterId, isRead, lastPage = 0) => {
    try {
      await DataService.db.updateProgress({ mangaId, chapterId, isRead, lastPage })
      set((state) => {
        const current = state.readingProgress[mangaId] || []
        const next = isRead
          ? [...new Set([...current, chapterId])]
          : current.filter(id => id !== chapterId)

        const currentPageMap = state.pageProgress[mangaId] || {}
        const nextPageMap = { ...currentPageMap }
        if (lastPage > 0) nextPageMap[chapterId] = lastPage

        return {
          readingProgress: { ...state.readingProgress, [mangaId]: next },
          pageProgress: { ...state.pageProgress, [mangaId]: nextPageMap }
        }
      })
    } catch (error) {
      console.error('Failed to update progress:', error)
    }
  },

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

  setExtensionSortBy: async (val) => {
    await DataService.db.setSetting('extension_sort_by', val)
    set({ extensionSortBy: val })
  },

  setExtensionSortOrder: async (val) => {
    await DataService.db.setSetting('extension_sort_order', val)
    set({ extensionSortOrder: val })
  },

  setChaptersCache: (mangaId, chapters) => set((state) => {
    const next = { ...state.chaptersCache, [mangaId]: chapters }
    const keys = Object.keys(next)
    if (keys.length > 50) delete next[keys[0]]
    return { chaptersCache: next }
  }),

  setPagesCache: (chapterId, pages) => set((state) => {
    const next = { ...state.pagesCache, [chapterId]: pages }
    const keys = Object.keys(next)
    if (keys.length > 30) delete next[keys[0]]
    return { pagesCache: next }
  }),

  setListCache: (feed, list) => set((state) => ({ listCache: { ...state.listCache, [feed]: list } })),
  setOffsetCache: (feed, offset) => set((state) => ({ offsetCache: { ...state.offsetCache, [feed]: offset } })),
  setHasMoreCache: (feed, hasMore) => set((state) => ({ hasMoreCache: { ...state.hasMoreCache, [feed]: hasMore } })),
  setBatchCountCache: (feed, batchCount) => set((state) => ({ batchCountCache: { ...state.batchCountCache, [feed]: batchCount } })),
  clearFeedCache: () => set({ listCache: {}, offsetCache: {}, hasMoreCache: {}, batchCountCache: {} }),
}))
