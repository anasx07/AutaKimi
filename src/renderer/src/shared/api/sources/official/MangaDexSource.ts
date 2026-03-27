import { DataService } from '@renderer/shared/api'
import { ISourceAdapter, Manga, Chapter, MangaPage } from '../types'

export class MangaDexSource implements ISourceAdapter {
  id: string = 'official.mangadex'
  name: string = 'MangaDex (Official)'
  mediaType: 'manga' | 'anime' = 'manga'
  version: string = '1.0.0'
  theme: string = 'official'
  baseUrl: string = 'https://api.mangadex.org'
  lang: string = 'all'
  nsfw: boolean = false
  icon: string = ''

  async fetchPopular(page: number, extraArgs?: any): Promise<MangaPage> {
    const offset = (page - 1) * 20
    const lang = extraArgs?.lang || 'en'
    const res = await DataService.fetchRepo(`${this.baseUrl}/manga?limit=20&offset=${offset}&availableTranslatedLanguage[]=${lang}&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive`)
    
    const manga: Manga[] = (res.data || []).map((m: any) => {
      const coverRel = m.relationships?.find((r: any) => r.type === 'cover_art')
      const fileName = coverRel?.attributes?.fileName
      return {
        id: m.id,
        title: m.attributes.title.en || Object.values(m.attributes.title)[0],
        coverUrl: fileName ? `https://uploads.mangadex.org/covers/${m.id}/${fileName}.256.jpg` : undefined,
        url: `${this.baseUrl}/manga/${m.id}`,
        status: m.attributes.status,
        description: m.attributes.description.en || Object.values(m.attributes.description)[0]
      }
    })

    return { manga, hasNextPage: (res.total || 0) > offset + 20 }
  }

  async searchManga(query: string, page: number, extraArgs?: any): Promise<MangaPage> {
    const offset = (page - 1) * 20
    const lang = extraArgs?.lang || 'en'
    const res = await DataService.fetchRepo(`${this.baseUrl}/manga?title=${encodeURIComponent(query)}&limit=20&offset=${offset}&availableTranslatedLanguage[]=${lang}&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica`)
    
    const manga: Manga[] = (res.data || []).map((m: any) => {
      const coverRel = m.relationships?.find((r: any) => r.type === 'cover_art')
      const fileName = coverRel?.attributes?.fileName
      return {
        id: m.id,
        title: m.attributes.title.en || Object.values(m.attributes.title)[0],
        coverUrl: fileName ? `https://uploads.mangadex.org/covers/${m.id}/${fileName}.256.jpg` : undefined,
        url: `${this.baseUrl}/manga/${m.id}`,
        status: m.attributes.status,
        description: m.attributes.description.en || Object.values(m.attributes.description)[0]
      }
    })

    return { manga, hasNextPage: (res.total || 0) > offset + 20 }
  }

  async fetchMangaDetails(manga: Manga): Promise<Manga> {
    const res = await DataService.fetchRepo(`${this.baseUrl}/manga/${manga.id}?includes[]=cover_art`)
    const m = res.data
    if (!m) return manga

    const coverRel = m.relationships?.find((r: any) => r.type === 'cover_art')
    const fileName = coverRel?.attributes?.fileName

    return {
      ...manga,
      description: m.attributes.description.en || Object.values(m.attributes.description)[0],
      status: m.attributes.status,
      coverUrl: fileName ? `https://uploads.mangadex.org/covers/${m.id}/${fileName}.256.jpg` : manga.coverUrl
    }
  }

  async fetchChapters(mangaId: string): Promise<Chapter[]> {
    // Note: mangaId here is expected to be a UUID for MangaDex
    const res = await DataService.fetchRepo(`${this.baseUrl}/manga/${mangaId}/feed?limit=500&translatedLanguage[]=en&order[chapter]=desc`)
    if (!res || !res.data) return []

    return res.data.map((c: any) => ({
      id: c.id,
      title: c.attributes?.title || `Chapter ${c.attributes?.chapter}`,
      url: `${this.baseUrl}/chapter/${c.id}`,
      date: c.attributes?.createdAt,
      number: parseFloat(c.attributes?.chapter || '0')
    }))
  }

  async fetchPages(chapterId: string): Promise<string[]> {
    const res = await DataService.fetchRepo(`${this.baseUrl}/at-home/server/${chapterId}`)
    if (!res || !res.chapter) return []

    const host = res.baseUrl
    const hash = res.chapter.hash
    const files = res.chapter.data

    const cleanHost = host.replace(/^https?:\/\//, '')
    return files.map((file: string) => 
      `autakimi-cache://${cleanHost}/data/${hash}/${file}`
    )
  }
}
