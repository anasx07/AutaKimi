import { DataService } from '@renderer/shared/api'
import { ISourceAdapter, Manga, Chapter, MangaPage, SourceFilterGroup } from '../types'

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

  getFilters(): SourceFilterGroup[] {
    return [
      {
        id: 'publicationDemographic',
        name: 'Demographic',
        type: 'multiselect',
        options: [
          { id: 'shounen', name: 'Shounen' },
          { id: 'shoujo', name: 'Shoujo' },
          { id: 'seinen', name: 'Seinen' },
          { id: 'josei', name: 'Josei' }
        ]
      },
      {
        id: 'status',
        name: 'Status',
        type: 'multiselect',
        options: [
          { id: 'ongoing', name: 'Ongoing' },
          { id: 'completed', name: 'Completed' },
          { id: 'hiatus', name: 'Hiatus' },
          { id: 'cancelled', name: 'Cancelled' }
        ]
      },
      {
        id: 'contentRating',
        name: 'Content Rating',
        type: 'multiselect',
        options: [
          { id: 'safe', name: 'Safe' },
          { id: 'suggestive', name: 'Suggestive' },
          { id: 'erotica', name: 'Erotica' },
          { id: 'pornographic', name: 'Pornographic' }
        ]
      },
      {
        id: 'includedTags',
        name: 'Popular Tags',
        type: 'multiselect',
        options: [
          { id: '391b042f-d80a-4d30-b458-0722bc63363e', name: 'Action' },
          { id: '4d32cc48-9f00-4cca-9b5a-aef099f08c40', name: 'Comedy' },
          { id: 'b9af3a06-f08a-4c2d-9b40-37412acdbde3', name: 'Drama' },
          { id: 'cdc58593-87dd-415e-bbc0-2ec27bf404cc', name: 'Fantasy' },
          { id: '423e2eaa-a7db-4f83-830a-ae1540fe54db', name: 'Romance' },
          { id: 'e5301a23-ebd9-49df-a0cb-fab75307b1a8', name: 'Slice of Life' },
          { id: 'eabc5bde-9397-43f0-aba4-400f87dd9339', name: 'Supernatural' },
          { id: '0bc0032e-4340-4966-88ef-22df6dbb51ba', name: 'Isekai' }
        ]
      }
    ]
  }

  private applyFiltersToUrl(baseUrl: string, extraArgs?: any): string {
    let url = baseUrl
    if (!extraArgs) return url

    const queryParams: string[] = []

    // Map filters to MangaDex query parameters
    if (extraArgs.publicationDemographic?.length) {
      extraArgs.publicationDemographic.forEach((val: string) => {
        queryParams.push(`publicationDemographic[]=${val}`)
      })
    }
    if (extraArgs.status?.length) {
      extraArgs.status.forEach((val: string) => {
        queryParams.push(`status[]=${val}`)
      })
    }
    if (extraArgs.contentRating?.length) {
      extraArgs.contentRating.forEach((val: string) => {
        queryParams.push(`contentRating[]=${val}`)
      })
    } else {
      // Default safety filters if none selected
      queryParams.push('contentRating[]=safe')
      queryParams.push('contentRating[]=suggestive')
    }
    if (extraArgs.includedTags?.length) {
      extraArgs.includedTags.forEach((val: string) => {
        queryParams.push(`includedTags[]=${val}`)
      })
    }

    if (queryParams.length > 0) {
      url += (url.includes('?') ? '&' : '?') + queryParams.join('&')
    }

    return url
  }

  async fetchPopular(page: number, extraArgs?: any): Promise<MangaPage> {
    const offset = (page - 1) * 20
    const lang = extraArgs?.lang || 'en'
    let url = `${this.baseUrl}/manga?limit=20&offset=${offset}&availableTranslatedLanguage[]=${lang}&includes[]=cover_art`

    url = this.applyFiltersToUrl(url, extraArgs)

    const res: any = await DataService.fetchRepo(url)

    const manga: Manga[] = (res.data || []).map((m: any) => {
      const coverRel = m.relationships?.find((r: any) => r.type === 'cover_art')
      const fileName = coverRel?.attributes?.fileName
      return {
        id: m.id,
        title: m.attributes.title.en || Object.values(m.attributes.title)[0],
        coverUrl: fileName
          ? `autakimi-cache://uploads.mangadex.org/covers/${m.id}/${fileName}.256.jpg`
          : undefined,
        url: `${this.baseUrl}/manga/${m.id}`,
        status: m.attributes.status,
        description: m.attributes.description.en || Object.values(m.attributes.description)[0]
      }
    })

    return { manga, hasNextPage: (res.total || 0) > offset + 20 }
  }

  async fetchLatest(page: number, extraArgs?: any): Promise<MangaPage> {
    const offset = (page - 1) * 20
    const lang = extraArgs?.lang || 'en'
    let url = `${this.baseUrl}/manga?limit=20&offset=${offset}&availableTranslatedLanguage[]=${lang}&includes[]=cover_art&order[latestUploadedChapter]=desc`

    url = this.applyFiltersToUrl(url, extraArgs)

    const res: any = await DataService.fetchRepo(url)

    const manga: Manga[] = (res.data || []).map((m: any) => {
      const coverRel = m.relationships?.find((r: any) => r.type === 'cover_art')
      const fileName = coverRel?.attributes?.fileName
      return {
        id: m.id,
        title: m.attributes.title.en || Object.values(m.attributes.title)[0],
        coverUrl: fileName
          ? `autakimi-cache://uploads.mangadex.org/covers/${m.id}/${fileName}.256.jpg`
          : undefined,
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
    let url = `${this.baseUrl}/manga?title=${encodeURIComponent(query)}&limit=20&offset=${offset}&availableTranslatedLanguage[]=${lang}&includes[]=cover_art`

    url = this.applyFiltersToUrl(url, extraArgs)

    const res: any = await DataService.fetchRepo(url)

    const manga: Manga[] = (res.data || []).map((m: any) => {
      const coverRel = m.relationships?.find((r: any) => r.type === 'cover_art')
      const fileName = coverRel?.attributes?.fileName
      return {
        id: m.id,
        title: m.attributes.title.en || Object.values(m.attributes.title)[0],
        coverUrl: fileName
          ? `autakimi-cache://uploads.mangadex.org/covers/${m.id}/${fileName}.256.jpg`
          : undefined,
        url: `${this.baseUrl}/manga/${m.id}`,
        status: m.attributes.status,
        description: m.attributes.description.en || Object.values(m.attributes.description)[0]
      }
    })

    return { manga, hasNextPage: (res.total || 0) > offset + 20 }
  }

  async fetchMangaDetails(manga: Manga): Promise<Manga> {
    const res: any = await DataService.fetchRepo(
      `${this.baseUrl}/manga/${manga.id}?includes[]=cover_art`
    )
    const m = res.data
    if (!m) return manga

    const coverRel = m.relationships?.find((r: any) => r.type === 'cover_art')
    const fileName = coverRel?.attributes?.fileName

    return {
      ...manga,
      description: m.attributes.description.en || Object.values(m.attributes.description)[0],
      status: m.attributes.status,
      coverUrl: fileName
        ? `https://uploads.mangadex.org/covers/${m.id}/${fileName}.256.jpg`
        : manga.coverUrl
    }
  }

  async fetchChapters(mangaId: string): Promise<Chapter[]> {
    // Note: mangaId here is expected to be a UUID for MangaDex
    const res: any = await DataService.fetchRepo(
      `${this.baseUrl}/manga/${mangaId}/feed?limit=500&translatedLanguage[]=en&order[chapter]=desc`
    )
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
    const res: any = await DataService.fetchRepo(`${this.baseUrl}/at-home/server/${chapterId}`)
    if (!res || !res.chapter) return []

    const host = res.baseUrl
    const hash = res.chapter.hash
    const files = res.chapter.data

    const cleanHost = host.replace(/^https?:\/\//, '')
    return files.map((file: string) => `autakimi-cache://${cleanHost}/data/${hash}/${file}`)
  }
}
