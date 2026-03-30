import { create } from 'zustand'
import { DataService } from '@renderer/shared/api'

interface ProgressState {
  readingProgress: Record<string, string[]> // mangaId -> chapterIds[]
  pageProgress: Record<string, Record<string, number>> // mangaId -> { chapterId -> lastPage }

  // Actions
  loadProgress: (mangaId: string) => Promise<void>
  markChapterRead: (
    mangaId: string,
    chapterId: string,
    isRead: boolean,
    lastPage?: number
  ) => Promise<void>
}

export const useProgressStore = create<ProgressState>((set) => ({
  readingProgress: {},
  pageProgress: {},

  loadProgress: async (mangaId) => {
    try {
      const rows = await DataService.db.getProgress(mangaId)
      const readIds = rows.filter((r) => !!r.isRead).map((r) => r.chapterId)
      const pagesMap: Record<string, number> = {}
      rows.forEach((r) => {
        if (r.lastPage > 0) pagesMap[r.chapterId] = r.lastPage
      })

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
          : current.filter((id) => id !== chapterId)

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
  }
}))
