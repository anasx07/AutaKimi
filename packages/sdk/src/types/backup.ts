export interface BackupData {
  version: number
  appVersion: string
  createdAt: string
  library: Array<{
    id: string
    title: string | null
    coverUrl: string | null
    status: string | null
    metadata: string | null
    mediaType: 'manga' | 'anime' | null
  }>
  readingProgress: Array<{
    mangaId: string
    chapterId: string
    isRead: boolean | null
    lastPage: number | null
    updatedAt: string | null
  }>
  readingHistory: Array<{
    mangaId: string
    mangaTitle: string | null
    mangaCover: string | null
    mangaUrl: string | null
    chapterId: string
    chapterTitle: string | null
    startedAt: string
    durationSeconds: number | null
    pkg: string | null
    mediaType: 'manga' | 'anime' | null
  }>
  sourceRepositories: string[]
  trackers?: Array<{
    mangaId: string
    provider: 'anilist' | 'mal'
    remoteId: string
    score: number | null
    status: string | null
    lastSyncedChapter: number | null
    updatedAt: string | null
  }>
}
