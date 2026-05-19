import { Manga, Chapter, FetchOptions } from './index'

export interface MangaPage {
  manga: Manga[]
  hasNextPage: boolean
}

export interface SourceFilterOption {
  id: string
  name: string
}

export interface SourceFilterGroup {
  id: string
  name: string
  type: 'multiselect' | 'select' | 'toggle'
  options: SourceFilterOption[]
}

export interface StreamingServer {
  name: string
  url: string
}

export interface ISourceAdapter {
  id: string // Internal ID for the source
  name: string
  mediaType: 'manga' | 'anime'
  version: string // Added versioning support
  theme: string // Added theme identification
  baseUrl: string
  lang: string
  nsfw: boolean
  icon: string // Added icon identification

  getFilters?(): SourceFilterGroup[]
  fetchPopular(page: number, extraArgs?: FetchOptions): Promise<MangaPage>
  fetchLatest(page: number, extraArgs?: FetchOptions): Promise<MangaPage>
  getFeedLabels?(): Record<string, string>
  isSupported?: boolean
  searchManga(query: string, page: number, extraArgs?: FetchOptions): Promise<MangaPage>
  fetchMangaDetails(manga: Manga): Promise<Manga>
  fetchChapters(mangaUrl: string): Promise<Chapter[]>
  fetchPages(chapterUrl: string): Promise<string[] | StreamingServer[] | any>
}
