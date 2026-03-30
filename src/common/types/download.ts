export interface DownloadEntry {
  mangaId: string
  chapterId: string
  totalPages: number | null
  cachedPages: number | null
  status: 'pending' | 'downloading' | 'completed' | 'error' | 'paused' | string | null
  pageUrls: string | null // JSON string
  error: string | null
  updatedAt: string | null
  mediaType: 'manga' | 'anime' | null
}

export interface DownloadedMedia {
  id: string
  title: string
  coverUrl: string | null
  url: string | null
  mediaType: 'manga' | 'anime' | null
}
