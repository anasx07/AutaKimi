import { create } from 'zustand'

interface CacheEntry<T> {
  data: T
  timestamp: number
}

interface BrowseCacheState {
  // We use Maps for LRU efficiency (insertion order preserved)
  chaptersCache: Map<string, CacheEntry<any[]>>
  pagesCache: Map<string, CacheEntry<string[]>>
  listCache: Map<string, CacheEntry<any[]>>

  // Existing metadata caches (can remain as Records if preferred, but Maps are better for consistency)
  offsetCache: Record<string, number>
  hasMoreCache: Record<string, boolean>
  batchCountCache: Record<string, number>

  // Actions
  setChaptersCache: (mangaId: string, chapters: any[]) => void
  setPagesCache: (chapterId: string, pages: string[]) => void
  setListCache: (feed: string, list: any[]) => void

  getChaptersCache: (mangaId: string) => any[] | null
  getPagesCache: (chapterId: string) => string[] | null
  getListCache: (feed: string) => any[] | null

  setOffsetCache: (feed: string, offset: number) => void
  setHasMoreCache: (feed: string, hasMore: boolean) => void
  setBatchCountCache: (feed: string, batchCount: number) => void

  clearFeedCache: () => void
  invalidateGroup: (group: string, key?: string) => void
}

const BROWSE_TTL = 24 * 60 * 60 * 1000 // 24 hours
const CHAPTERS_TTL = 12 * 60 * 60 * 1000 // 12 hours
const MAX_CHAPTERS = 50
const MAX_PAGES = 30

export const useBrowseCacheStore = create<BrowseCacheState>((set, get) => ({
  chaptersCache: new Map(),
  pagesCache: new Map(),
  listCache: new Map(),
  offsetCache: {},
  hasMoreCache: {},
  batchCountCache: {},

  setChaptersCache: (mangaId, chapters) => {
    const { chaptersCache } = get()
    // LRU: Remove if exists to move to end
    if (chaptersCache.has(mangaId)) chaptersCache.delete(mangaId)

    chaptersCache.set(mangaId, { data: chapters, timestamp: Date.now() })

    // Evict oldest if limit exceeded
    if (chaptersCache.size > MAX_CHAPTERS) {
      const firstKey = chaptersCache.keys().next().value
      if (firstKey) chaptersCache.delete(firstKey)
    }
    set({ chaptersCache: new Map(chaptersCache) })
  },

  getChaptersCache: (mangaId) => {
    const { chaptersCache } = get()
    const entry = chaptersCache.get(mangaId)
    if (!entry) return null

    if (Date.now() - entry.timestamp > CHAPTERS_TTL) {
      chaptersCache.delete(mangaId)
      set({ chaptersCache: new Map(chaptersCache) })
      return null
    }

    // LRU: Refresh position
    chaptersCache.delete(mangaId)
    chaptersCache.set(mangaId, entry)
    set({ chaptersCache: new Map(chaptersCache) })
    return entry.data
  },

  setPagesCache: (chapterId, pages) => {
    const { pagesCache } = get()
    if (pagesCache.has(chapterId)) pagesCache.delete(chapterId)

    pagesCache.set(chapterId, { data: pages, timestamp: Date.now() })

    if (pagesCache.size > MAX_PAGES) {
      const firstKey = pagesCache.keys().next().value
      if (firstKey) pagesCache.delete(firstKey)
    }
    set({ pagesCache: new Map(pagesCache) })
  },

  getPagesCache: (chapterId) => {
    const { pagesCache } = get()
    const entry = pagesCache.get(chapterId)
    if (!entry) return null

    if (Date.now() - entry.timestamp > BROWSE_TTL) {
      pagesCache.delete(chapterId)
      set({ pagesCache: new Map(pagesCache) })
      return null
    }

    pagesCache.delete(chapterId)
    pagesCache.set(chapterId, entry)
    set({ pagesCache: new Map(pagesCache) })
    return entry.data
  },

  setListCache: (feed, list) => {
    const { listCache } = get()
    listCache.set(feed, { data: list, timestamp: Date.now() })
    set({ listCache: new Map(listCache) })
  },

  getListCache: (feed) => {
    const { listCache } = get()
    const entry = listCache.get(feed)
    if (!entry) return null

    if (Date.now() - entry.timestamp > BROWSE_TTL) {
      listCache.delete(feed)
      set({ listCache: new Map(listCache) })
      return null
    }
    return entry.data
  },

  setOffsetCache: (feed, offset) =>
    set((state) => ({ offsetCache: { ...state.offsetCache, [feed]: offset } })),
  setHasMoreCache: (feed, hasMore) =>
    set((state) => ({ hasMoreCache: { ...state.hasMoreCache, [feed]: hasMore } })),
  setBatchCountCache: (feed, batchCount) =>
    set((state) => ({ batchCountCache: { ...state.batchCountCache, [feed]: batchCount } })),

  clearFeedCache: () =>
    set({ listCache: new Map(), offsetCache: {}, hasMoreCache: {}, batchCountCache: {} }),

  invalidateGroup: (group, key) => {
    const state = get()
    switch (group) {
      case 'browse_lists':
        if (key) state.listCache.delete(key)
        else set({ listCache: new Map() })
        break
      case 'chapter_lists':
        if (key) state.chaptersCache.delete(key)
        else set({ chaptersCache: new Map() })
        break
      default:
        break
    }
    set({ ...state })
  }
}))
