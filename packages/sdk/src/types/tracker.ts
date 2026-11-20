export type TrackerProvider = 'anilist' | 'mal'

export interface Tracker {
  mangaId: string
  provider: TrackerProvider
  remoteId: string
  score?: number
  status?: string // 'CURRENT' | 'PLANNING' | 'COMPLETED' | 'DROPPED' | 'PAUSED' | 'REPEATING'
  lastSyncedChapter?: number
  updatedAt?: string
}

export interface AniListUser {
  id: number
  name: string
  avatar?: {
    large?: string
    medium?: string
  }
}

export interface AniListMedia {
  id: number
  title: {
    romaji?: string
    english?: string
    native?: string
  }
  coverImage?: {
    large?: string
    medium?: string
  }
  type?: 'ANIME' | 'MANGA'
  format?: string
  status?: string
  episodes?: number
  chapters?: number
  mediaListEntry?: {
    id: number
    status?: string
    score?: number
    progress?: number
  }
}
