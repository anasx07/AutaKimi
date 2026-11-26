export interface MediaSeason {
  id: string
  title: string
  url: string
  coverUrl?: string | null
  isCurrent?: boolean
}

export interface PartialManga {
  id: string
  title: string
  coverUrl?: string | null
  description?: string
  status?: string
  author?: string
  artist?: string
  genres?: string[]
  seasons?: MediaSeason[]
  url?: string
  pkg?: string
  mediaType?: 'manga' | 'anime'
  _raw?: any
}

export interface Manga extends Omit<PartialManga, 'url' | 'pkg'> {
  url: string
  pkg: string
}
