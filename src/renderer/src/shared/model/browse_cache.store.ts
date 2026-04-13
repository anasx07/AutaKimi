import { create } from 'zustand'

interface CacheEntry<T> {
  data: T
  timestamp: number
}

class LRUCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map()
  private maxEntries: number
  private ttl: number

  constructor(maxEntries: number, ttl: number) {
    this.maxEntries = maxEntries
    this.ttl = ttl
  }

  get(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key)
      return null
    }

    // Refresh LRU position
    this.cache.delete(key)
    this.cache.set(key, entry)
    return entry.data
  }

  set(key: string, data: T) {
    if (this.cache.has(key)) this.cache.delete(key)

    this.cache.set(key, { data, timestamp: Date.now() })

    if (this.cache.size > this.maxEntries) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) this.cache.delete(firstKey)
    }
  }

  delete(key: string) {
    this.cache.delete(key)
  }

  clear() {
    this.cache.clear()
  }

  // Allow iteration/access if needed for reactivity
  getEntries() {
    return this.cache
  }
}

const BROWSE_TTL = 24 * 60 * 60 * 1000 // 24 hours
const CHAPTERS_TTL = 12 * 60 * 60 * 1000 // 12 hours
const MAX_CHAPTERS = 50
const MAX_PAGES = 30

const chaptersCache = new LRUCache<any[]>(MAX_CHAPTERS, CHAPTERS_TTL)
const pagesCache = new LRUCache<string[]>(MAX_PAGES, BROWSE_TTL)
const listCache = new LRUCache<any[]>(100, BROWSE_TTL) // Added a reasonable limit for lists

interface BrowseCacheState {
  // Metadata caches
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

  // We expose the cache maps directly for compatibility with hooks that use .get()
  // but we update them manually. Note: Hooks subscribing to these will only
  // re-render when set({ cacheVersion: ... }) is called.
  chaptersCache: Map<string, CacheEntry<any[]>>
  pagesCache: Map<string, CacheEntry<string[]>>
  listCache: Map<string, CacheEntry<any[]>>

  setOffsetCache: (feed: string, offset: number) => void
  setHasMoreCache: (feed: string, hasMore: boolean) => void
  setBatchCountCache: (feed: string, batchCount: number) => void

  clearFeedCache: () => void
  invalidateGroup: (group: string, key?: string) => void
}

export const useBrowseCacheStore = create<BrowseCacheState>((set, get) => ({
  offsetCache: {},
  hasMoreCache: {},
  batchCountCache: {},

  // Exposed for getter compatibility in hooks — initial snapshot
  chaptersCache: new Map(chaptersCache.getEntries()),
  pagesCache: new Map(pagesCache.getEntries()),
  listCache: new Map(listCache.getEntries()),

  setChaptersCache: (mangaId, chapters) => {
    chaptersCache.set(mangaId, chapters)
    set({ chaptersCache: new Map(chaptersCache.getEntries()) })
  },

  getChaptersCache: (mangaId) => {
    return chaptersCache.get(mangaId)
  },

  setPagesCache: (chapterId, pages) => {
    pagesCache.set(chapterId, pages)
    set({ pagesCache: new Map(pagesCache.getEntries()) })
  },

  getPagesCache: (chapterId) => {
    return pagesCache.get(chapterId)
  },

  setListCache: (feed, list) => {
    listCache.set(feed, list)
    set({ listCache: new Map(listCache.getEntries()) })
  },

  getListCache: (feed) => {
    return listCache.get(feed)
  },

  setOffsetCache: (feed, offset) =>
    set((state) => ({ offsetCache: { ...state.offsetCache, [feed]: offset } })),
  setHasMoreCache: (feed, hasMore) =>
    set((state) => ({ hasMoreCache: { ...state.hasMoreCache, [feed]: hasMore } })),
  setBatchCountCache: (feed, batchCount) =>
    set((state) => ({ batchCountCache: { ...state.batchCountCache, [feed]: batchCount } })),

  clearFeedCache: () => {
    listCache.clear()
    set({
      listCache: new Map(),
      offsetCache: {},
      hasMoreCache: {},
      batchCountCache: {}
    })
  },

  invalidateGroup: (group, key) => {
    switch (group) {
      case 'browse_lists':
        if (key) listCache.delete(key)
        else listCache.clear()
        set({ listCache: new Map(listCache.getEntries()) })
        break
      case 'chapter_lists':
        if (key) chaptersCache.delete(key)
        else chaptersCache.clear()
        set({ chaptersCache: new Map(chaptersCache.getEntries()) })
        break
      default:
        break
    }
  }
}))
