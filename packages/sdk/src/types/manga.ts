export interface PartialManga {
  id: string
  title: string
  coverUrl?: string | null
  description?: string
  status?: string
  author?: string
  artist?: string
  genres?: string[]
  url?: string
  pkg?: string
  mediaType?: 'manga' | 'anime'
  _raw?: any
}

export interface Manga extends Omit<PartialManga, 'url' | 'pkg'> {
  url: string
  pkg: string
}
