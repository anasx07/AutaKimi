import { DataService } from '@renderer/shared/api'
import { ISourceAdapter, Manga, Chapter, MangaPage } from '../types'

export class MangaSwat implements ISourceAdapter {
  public id = 'ma.autakimi.extension.ar.mangaswat'
  public name = 'MangaSwat'
  public mediaType: 'manga' | 'anime' = 'manga'
  public version = '0.0.1'
  public theme = 'custom-api'
  public baseUrl = 'https://meshmanga.com'
  public get apiUrl() {
    // If domain is overridden from the default meshmanga, assume API also moved
    if (this.baseUrl !== 'https://meshmanga.com') {
      return `${this.baseUrl}/v2/api/v2`
    }
    return 'https://appswat.com/v2/api/v2'
  }
  public lang = 'ar'
  public icon = 'ma.autakimi.extension.ar.mangaswat'
  public nsfw = false

  private async fetchApi(endpoint: string): Promise<any> {
    const url = endpoint.startsWith('http') ? endpoint : `${this.apiUrl}${endpoint}`
    const headers: Record<string, string> = {
      'User-Agent': 'ktor-client',
      'Accept': 'application/json, text/plain, */*',
      'Origin': this.baseUrl,
      'Referer': `${this.baseUrl}/`
    }

    const res: any = await DataService.fetchText(url, { headers })
    if (!res || !res.ok) {
      console.warn(`[MangaSwat] API Error: ${res?.status} for ${url}`)
      return null
    }

    try {
      return JSON.parse(res.data)
    } catch (e) {
      console.error(`[MangaSwat] Failed to parse JSON for ${url}`, e)
      return null
    }
  }

  private extractName(val: any) {
    if (!val) return ''
    if (typeof val === 'object') return val.name || val.title || ''
    return String(val)
  }

  async fetchPopular(page: number): Promise<MangaPage> {
    const data = await this.fetchApi(`/chapters/?order_by=-views_count&page_size=40&page=${page}`)
    if (!data || !data.results) return { manga: [], hasNextPage: false }

    const seen = new Set<string>()
    const manga: Manga[] = []

    for (const item of data.results) {
      const s = item.serie
      if (s && !seen.has(String(s.id))) {
        seen.add(String(s.id))
        const statStr = this.extractName(s.status) || 'Ongoing'
        const dateStr = item.created_at_humanized || ''
        
        manga.push({
          id: String(s.id),
          title: s.title,
          coverUrl: s.poster?.medium || s.poster?.thumbnail,
          url: `${this.baseUrl}/series/${s.id}`,
          status: dateStr ? `${statStr} • ${dateStr}` : statStr
        })
      }
    }

    return { manga, hasNextPage: !!data.next }
  }

  async fetchLatest(page: number): Promise<MangaPage> {
    const data = await this.fetchApi(`/chapters/?order_by=-created_at&page_size=40&page=${page}`)
    if (!data || !data.results) return { manga: [], hasNextPage: false }

    const seen = new Set<string>()
    const manga: Manga[] = []

    for (const item of data.results) {
      const s = item.serie
      if (s && !seen.has(String(s.id))) {
        seen.add(String(s.id))
        const statStr = this.extractName(s.status) || 'Ongoing'
        const dateStr = item.created_at_humanized || ''
        
        manga.push({
          id: String(s.id),
          title: s.title,
          coverUrl: s.poster?.medium || s.poster?.thumbnail,
          url: `${this.baseUrl}/series/${s.id}`,
          status: dateStr ? `${statStr} • ${dateStr}` : statStr
        })
      }
    }

    return { manga, hasNextPage: !!data.next }
  }

  async searchManga(query: string, page: number): Promise<MangaPage> {
    const data = await this.fetchApi(`/series/?search=${encodeURIComponent(query)}&page=${page}`)
    if (!data || !data.results) return { manga: [], hasNextPage: false }

    const mangaPromises = data.results.map(async (item: any) => {
      const chaptersData = await this.fetchApi(`/chapters/?serie=${item.id}&page_size=1`)
      const latestChapter = chaptersData?.results?.[0]
      const dateStr = latestChapter?.created_at_humanized || ''
      const statStr = this.extractName(item.status) || 'Unknown'

      return {
        id: String(item.id),
        title: item.title,
        coverUrl: item.poster?.medium || item.poster?.thumbnail,
        url: `${this.baseUrl}/series/${item.slug}`,
        status: dateStr ? `${statStr} • ${dateStr}` : statStr
      }
    })

    const manga = await Promise.all(mangaPromises)
    return { manga, hasNextPage: !!data.next }
  }

  async fetchMangaDetails(manga: Manga): Promise<Manga> {
    const id = /^\d+$/.test(manga.id) ? manga.id : (manga.url || '').split('/').filter(Boolean).pop()
    const data = await this.fetchApi(`/series/${id}/`)
    if (!data) return manga

    return {
      ...manga,
      id: String(data.id),
      description: data.story,
      author: this.extractName(data.author),
      artist: this.extractName(data.artist || data.author),
      status: this.extractName(data.status) || manga.status,
      genres: data.genres?.map((g: any) => this.extractName(g)) || [],
      coverUrl: data.poster?.medium || data.poster?.thumbnail || manga.coverUrl
    }
  }

  async fetchChapters(mangaUrl: string): Promise<Chapter[]> {
    const slug = mangaUrl.split('/').filter(Boolean).pop()
    if (!slug) return []

    // 0. Priority: if slug is a numeric ID
    if (/^\d+$/.test(slug)) {
      return this.fetchChaptersById(slug)
    }

    // 1. Fallback: Get Series ID from slug
    const seriesData = await this.fetchApi(`/series/?slug=${slug}`)
    const series = seriesData?.results?.[0]
    if (!series) {
      console.warn(`[MangaSwat] Could not find series for slug: ${slug}`)
      return []
    }

    return this.fetchChaptersById(String(series.id))
  }

  private async fetchChaptersById(serieId: string): Promise<Chapter[]> {
    // 2. Get Chapters using serie ID (singular 'serie')
    const data = await this.fetchApi(`/chapters/?serie=${serieId}&order_by=-order&page_size=500`)
    if (!data || !data.results) return []

    return data.results.map((item: any) => ({
      id: String(item.id),
      title: item.title || `Chapter ${item.chapter}`,
      url: `https://appswat.com/chapter/${item.id}`,
      number: parseFloat(item.chapter) || 0,
      date: item.created_at_humanized
    }))
  }

  async fetchPages(chapterUrl: string): Promise<string[]> {
    const id = chapterUrl.split('/').filter(Boolean).pop()
    if (!id) return []

    const data = await this.fetchApi(`/chapters/${id}/`)
    if (!data) return []

    // 1. Try 'images' field (most common in this API)
    if (data.images && Array.isArray(data.images)) {
      return data.images.map((img: any) => img.image || img.url || (typeof img === 'string' ? img : ''))
        .filter(Boolean)
    }

    // 2. Try 'pages' field (alternative)
    if (data.pages && Array.isArray(data.pages)) {
      return data.pages.map((p: any) => p.image || p.url || (typeof p === 'string' ? p : ''))
        .filter(Boolean)
    }

    return []
  }
}
