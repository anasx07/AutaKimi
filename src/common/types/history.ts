export interface HistoryEntry {
  id?: number
  mangaId: string
  mangaTitle?: string
  mangaCover?: string
  mangaUrl?: string
  chapterId: string
  chapterTitle?: string
  startedAt: string
  durationSeconds?: number
  pkg?: string
  type?: 'manga' | 'anime'
}
