import { create } from 'zustand'
import { DataService } from '@renderer/shared/api'

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

interface HistoryState {
  historyEntries: HistoryEntry[]
  hasMoreHistory: boolean

  // Actions
  loadHistory: () => Promise<void>
  loadMoreHistory: () => Promise<void>
  addHistoryEntry: (entry: Omit<HistoryEntry, 'id'>) => Promise<void>
  deleteHistoryEntry: (id: number) => Promise<void>
  deleteHistoryByManga: (mangaId: string) => Promise<void>
  clearHistory: () => Promise<void>
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  historyEntries: [],
  hasMoreHistory: true,

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
}))
