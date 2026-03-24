import { create } from 'zustand'
import { DataService } from '@renderer/shared/api'
import { NormalizedManga } from '@common/utils/mangaNormalizer'
import { Chapter } from '@renderer/shared/api/sources/types'
import { useExtensionStore, ExtensionMetadata } from './extension.store'
import { useReaderStore } from './reader.store'
import { useHistoryStore } from './history.store'
import { useSettingsStore } from './settings.store'

interface LibraryState {
  library: NormalizedManga[]
  selectedManga: NormalizedManga | null
  activeChapter: Chapter | null
  
  // Actions
  loadFromDb: () => Promise<void>
  toggleLibrary: (manga: NormalizedManga) => Promise<void>
  setSelectedManga: (manga: NormalizedManga | null) => void
  setActiveChapter: (chapter: Chapter | null) => void
}

export const useLibraryStore = create<LibraryState>((set) => ({
  library: [],
  selectedManga: null,
  activeChapter: null,

  loadFromDb: async () => {
    try {
      const [installed, libraryItems, settingsMap] = await Promise.all([
        DataService.db.getExtensions(),
        DataService.db.getLibrary(),
        DataService.db.getSettings()
      ])

      set({
        library: (libraryItems as NormalizedManga[]) || [],
      })

      // Initialize specialized stores
      useExtensionStore.getState()._init(installed as ExtensionMetadata[], settingsMap as Record<string, string>)
      useReaderStore.getState()._init(settingsMap as Record<string, string>)
      useSettingsStore.getState()._init(settingsMap as Record<string, string>)
      
      // Load history
      useHistoryStore.getState().loadHistory()
    } catch (error) {
      console.error('Failed to load DB:', error)
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
    if (manga && (manga as any).pkg) {
      useExtensionStore.getState().setActiveExtension((manga as any).pkg)
    }
    return next
  }),

  setActiveChapter: (chapter: Chapter | null) => set({ activeChapter: chapter }),
}))

