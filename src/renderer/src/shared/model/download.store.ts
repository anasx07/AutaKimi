import { create } from 'zustand'
import { Chapter } from '@renderer/shared/api/sources/types'

export interface DownloadQueueItem {
  mangaId: string
  mangaTitle: string
  chapter: Chapter
  extension: string
  extensionName?: string
  type: 'manga' | 'anime'
}

export interface ActiveTask {
  mangaId: string
  chapterId: string
  status: 'downloading' | 'completed' | 'error' | 'paused'
  cached: number
  total: number
  error?: string
}

interface DownloadState {
  downloadQueue: DownloadQueueItem[]
  activeTasks: Record<string, ActiveTask>
  isFetchingPages: boolean

  addToDownloadQueue: (items: DownloadQueueItem[]) => void
  removeFromDownloadQueue: (chapterId: string) => void
  setIsFetchingPages: (val: boolean) => void
  updateActiveTask: (task: Partial<ActiveTask> & { mangaId: string; chapterId: string }) => void
  removeActiveTask: (mangaId: string, chapterId: string) => void
  clearFinishedTasks: () => void
  clearDownloadQueue: () => void
}

export const useDownloadStore = create<DownloadState>((set) => ({
  downloadQueue: [],
  activeTasks: {},
  isFetchingPages: false,

  addToDownloadQueue: (items) =>
    set((state) => {
      const existingIds = state.downloadQueue.map((i) => i.chapter.id)
      const uniqueItems = items.filter((i) => !existingIds.includes(i.chapter.id))
      return { downloadQueue: [...state.downloadQueue, ...uniqueItems] }
    }),

  removeFromDownloadQueue: (chapterId) =>
    set((state) => ({
      downloadQueue: state.downloadQueue.filter((i) => i.chapter.id !== chapterId)
    })),

  setIsFetchingPages: (val) => set({ isFetchingPages: val }),

  updateActiveTask: (task) =>
    set((state) => {
      const key = `${task.mangaId}:${task.chapterId}`
      const existing = state.activeTasks[key] || {
        mangaId: task.mangaId,
        chapterId: task.chapterId,
        status: 'downloading',
        cached: 0,
        total: 0
      }
      const updated = { ...existing, ...task }

      // Log for debugging
      if (task.status === 'completed' || task.status === 'error') {
        console.log(`[useDownloadStore] Task ${task.status}:`, key)
      }

      return {
        activeTasks: {
          ...state.activeTasks,
          [key]: updated
        }
      }
    }),

  removeActiveTask: (mangaId, chapterId) =>
    set((state) => {
      const key = `${mangaId}:${chapterId}`
      const newTasks = { ...state.activeTasks }
      delete newTasks[key]
      return { activeTasks: newTasks }
    }),

  clearFinishedTasks: () =>
    set((state) => {
      const newTasks = { ...state.activeTasks }
      Object.keys(newTasks).forEach((key) => {
        if (newTasks[key].status === 'completed' || newTasks[key].status === 'error') {
          delete newTasks[key]
        }
      })
      return { activeTasks: newTasks }
    }),

  clearDownloadQueue: () => set({ downloadQueue: [] })
}))
