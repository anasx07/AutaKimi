import { create } from 'zustand'
import { Chapter } from '@renderer/shared/api/sources/types'

export interface DownloadQueueItem {
  mangaId: string
  chapter: Chapter
  extension: string
}

interface DownloadState {
  downloadQueue: DownloadQueueItem[]
  isFetchingPages: boolean

  addToDownloadQueue: (items: DownloadQueueItem[]) => void
  removeFromDownloadQueue: (chapterId: string) => void
  setIsFetchingPages: (val: boolean) => void
}

export const useDownloadStore = create<DownloadState>((set) => ({
  downloadQueue: [],
  isFetchingPages: false,

  addToDownloadQueue: (items) => set((state) => {
    const existingIds = state.downloadQueue.map(i => i.chapter.id)
    const uniqueItems = items.filter(i => !existingIds.includes(i.chapter.id))
    return { downloadQueue: [...state.downloadQueue, ...uniqueItems] }
  }),

  removeFromDownloadQueue: (chapterId) => set((state) => ({
    downloadQueue: state.downloadQueue.filter(i => i.chapter.id !== chapterId)
  })),

  setIsFetchingPages: (val) => set({ isFetchingPages: val }),
}))
