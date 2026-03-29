import { create } from 'zustand'
import { DataService } from '@renderer/shared/api'
import { NormalizedManga } from '@common/utils/mangaNormalizer'
import { Chapter } from '@renderer/shared/api/sources/types'
import { useExtensionStore } from './extension.store'

interface LibraryState {
  library: NormalizedManga[]
  /** 
   * The manga or anime currently selected for viewing. 
   * This is used as the 'Selection Intent' and initial metadata source. 
   * Detailed info should be fetched and managed via React Query (useMangaDetails).
   */
  selectedManga: NormalizedManga | null
  /** The chapter or episode currently being read/watched. */
  activeChapter: Chapter | null
  
  // Actions
  _init: (library: NormalizedManga[]) => void
  loadFromDb: () => Promise<void>
  toggleLibrary: (manga: NormalizedManga) => Promise<void>
  setSelectedManga: (manga: NormalizedManga | null) => void
  setActiveChapter: (chapter: Chapter | null) => void
}

export const useLibraryStore = create<LibraryState>((set) => ({
  library: [],
  selectedManga: null,
  activeChapter: null,

  _init: (library) => {
    set({ library: library || [] })
  },

  loadFromDb: async () => {
    try {
      const items = await DataService.db.getLibrary()
      set({ library: (items as NormalizedManga[]) || [] })
    } catch (e) {
      console.error('Failed to reload library:', e)
    }
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
    if (manga && manga.pkg) {
      useExtensionStore.getState().setActiveExtension(manga.pkg)
    }
    return next
  }),

  setActiveChapter: (chapter: Chapter | null) => set({ activeChapter: chapter }),
}))
