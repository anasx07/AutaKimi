import { Manga } from '../types/manga'
export type { Manga as NormalizedManga }
export type { Manga }

export interface Chapter {
  id: string
  attributes: {
    chapter: string
    title: string
    createdAt: string
    description?: string
  }
}

export const normalizeManga = (manga: any, preferredLang?: string, includeRaw = true): Manga => {
  if (!manga) {
    return {
      id: '',
      title: 'Unknown',
      coverUrl: null,
      description: '',
      status: 'Unknown'
    }
  }

  // 1. Extract Title — guard against empty string sources
  let title = ''
  // Check common title fields (Madara, MangaDex, etc.)
  const possibleTitle =
    manga.title ||
    manga.name ||
    manga.manga_name ||
    manga.mangaTitle ||
    manga.series_title ||
    manga.label ||
    manga.alt_title ||
    manga.title_en ||
    manga.title_ar

  if (possibleTitle && String(possibleTitle).trim()) {
    title = String(possibleTitle).trim()
  } else if (manga.attributes?.title) {
    if (typeof manga.attributes.title === 'string') {
      title = manga.attributes.title
    } else {
      title =
        (preferredLang && manga.attributes.title[preferredLang]) ||
        manga.attributes.title.en ||
        (Object.values(manga.attributes.title)[0] as string) ||
        ''
    }
  }

  // Fallback: derive from URL slug (e.g. 'fast-break' → 'Fast Break')
  // Only if the slug doesn't look like a numeric ID or a hash
  if (!title) {
    try {
      const source = String(manga.url || manga.manga_url || manga.id || '')
      const slug = source.split('/').filter(Boolean).pop() || ''

      // If slug is purely numeric or looks like a short-ish hash (e.g. numeric or hex), use 'Untitled'
      const isNumeric = /^\d+$/.test(slug)
      const isHash = /^[a-zA-Z0-9]{8,16}$/.test(slug) && !slug.includes('-') && !slug.includes('_')

      if (slug && !isNumeric && !isHash) {
        title = slug
          .replace(/-/g, ' ')
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (c: string) => c.toUpperCase())
      } else {
        title = 'Untitled'
      }
    } catch {
      title = 'Untitled'
    }
  }

  // 2. Extract Cover
  let coverUrl = manga.coverUrl || manga.cover_url || manga.thumbnail_url || manga.cover || null
  if (!coverUrl && manga.relationships) {
    const coverRel = manga.relationships.find((r: any) => r.type === 'cover_art')
    if (coverRel && coverRel.attributes?.fileName) {
      coverUrl = `https://uploads.mangadex.org/covers/${manga.id}/${coverRel.attributes.fileName}.256.jpg`
    }
  }

  // 3. Extract Description
  let description =
    manga.description || manga.attributes?.description || ''
  if (typeof description === 'object' && description !== null) {
    description =
      (preferredLang && description[preferredLang]) ||
      description.en ||
      Object.values(description)[0] ||
      ''
  }

  // 4. Extract Status, Author, Artist, Genres
  const status = manga.status || manga.attributes?.status || 'Unknown'
  const author = manga.author || manga.author_name || manga.attributes?.author || undefined
  const artist = manga.artist || manga.artist_name || manga.attributes?.artist || undefined
  const genres = manga.genres || manga.attributes?.genres || undefined

  return {
    id: manga.id,
    title: String(title),
    coverUrl,
    description: String(description),
    status,
    author,
    artist,
    genres,
    url: manga.url || manga.manga_url || undefined,
    pkg: manga.pkg || undefined,
    mediaType: manga.mediaType || manga.attributes?.mediaType || undefined,
    _raw: includeRaw ? manga : undefined
  }
}
