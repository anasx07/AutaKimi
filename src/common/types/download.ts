export interface DownloadEntry {
  mangaId: string;
  chapterId: string;
  totalPages?: number;
  cachedPages?: number;
  status: 'pending' | 'downloading' | 'completed' | 'error' | 'paused';
  pageUrls?: string; // JSON string
  error?: string;
  updatedAt?: string;
  type?: 'manga' | 'anime';
}
