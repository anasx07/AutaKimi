import { create } from 'zustand'

interface BrowseCacheState {
  chaptersCache: Record<string, any[]>
  pagesCache: Record<string, string[]>
  listCache: Record<string, any[]>
  offsetCache: Record<string, number>
  hasMoreCache: Record<string, boolean>
  batchCountCache: Record<string, number>

  // Actions
  setChaptersCache: (mangaId: string, chapters: any[]) => void
  setPagesCache: (chapterId: string, pages: string[]) => void
  setListCache: (feed: string, list: any[]) => void
  setOffsetCache: (feed: string, offset: number) => void
  setHasMoreCache: (feed: string, hasMore: boolean) => void
  setBatchCountCache: (feed: string, batchCount: number) => void
  clearFeedCache: () => void
}

export const useBrowseCacheStore = create<BrowseCacheState>((set) => ({
  chaptersCache: {},
  pagesCache: {},
  listCache: {},
  offsetCache: {},
  hasMoreCache: {},
  batchCountCache: {},

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
