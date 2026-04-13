import { create } from 'zustand'
import { DataService } from '@renderer/shared/api'
import { HistoryEntry } from '@common/types'

interface HistoryState {
  historyEntries: HistoryEntry[]
  hasMoreHistory: boolean

  // Actions
  loadHistory: (type?: 'manga' | 'anime') => Promise<void>
  loadMoreHistory: (type?: 'manga' | 'anime') => Promise<void>
  addHistoryEntry: (entry: Omit<HistoryEntry, 'id'>) => Promise<void>
  deleteHistoryEntry: (id: number) => Promise<void>
  deleteHistoryByManga: (mangaId: string) => Promise<void>
  clearHistory: (type?: 'manga' | 'anime') => Promise<void>
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  historyEntries: [],
  hasMoreHistory: true,

  loadHistory: async (type) => {
    try {
      const history = await DataService.db.getHistory({ type })
      set({ historyEntries: history, hasMoreHistory: history.length === 50 })
    } catch (e) {
      console.error('Failed to load history:', e)
    }
  },

  loadMoreHistory: async (type) => {
    try {
      const offset = get().historyEntries.length
      const history = await DataService.db.getHistory({ limit: 50, offset, type })
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

  clearHistory: async (type) => {
    try {
      await DataService.db.clearHistory(type)
      if (type) {
        set((state) => ({
          historyEntries: state.historyEntries.filter((e) => e.type !== type)
        }))
      } else {
        set({ historyEntries: [] })
      }
    } catch (e) {
      console.error('Failed to clear history:', e)
    }
  }
}))
