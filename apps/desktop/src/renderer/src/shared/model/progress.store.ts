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
    lastPage?: number,
    chapterNumber?: number
  ) => Promise<void>
  markAllChaptersRead: (
    mangaId: string,
    chapterIds: string[],
    isRead: boolean
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

  markAllChaptersRead: async (mangaId, chapterIds, isRead) => {
    try {
      if (DataService.db.updateProgressBatch) {
        await DataService.db.updateProgressBatch({
          mangaId,
          chapterIds,
          isRead,
          lastPage: 0
        })
      } else {
        await Promise.all(
          chapterIds.map((chapterId) =>
            DataService.db.updateProgress({ mangaId, chapterId, isRead, lastPage: 0 })
          )
        )
      }
      set((state) => ({
        readingProgress: {
          ...state.readingProgress,
          [mangaId]: isRead ? [...new Set(chapterIds)] : []
        }
      }))
    } catch (error) {
      console.error('Failed to update bulk progress:', error)
    }
  },

  markChapterRead: async (mangaId, chapterId, isRead, lastPage?: number, chapterNumber?: number) => {
    try {
      await DataService.db.updateProgress({
        mangaId,
        chapterId,
        isRead,
        ...(lastPage !== undefined ? { lastPage } : {}),
        ...(chapterNumber !== undefined ? { chapterNumber } : {})
      })
      set((state) => {
        const current = state.readingProgress[mangaId] || []
        const next = isRead
          ? [...new Set([...current, chapterId])]
          : current.filter((id) => id !== chapterId)

        const currentPageMap = state.pageProgress[mangaId] || {}
        const nextPageMap = { ...currentPageMap }
        if (lastPage !== undefined && lastPage > 0) nextPageMap[chapterId] = lastPage

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
