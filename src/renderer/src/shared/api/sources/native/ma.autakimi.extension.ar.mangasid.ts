import { MadaraSource } from '../base/MadaraSource'
import { MangaPage, Manga, Chapter } from '../types'
import * as cheerio from 'cheerio'

export class MangaSid extends MadaraSource {
  private apiUrl = 'https://api.mangasid.com/api'

  constructor() {
    super(
      'ma.autakimi.extension.ar.mangasid',
      'MangaSid',
      '0.0.1',
      'https://mangasid.com',
      'ar',
      'ma.autakimi.extension.ar.mangasid',
      false
    )
  }

  async fetchPopular(page: number): Promise<MangaPage> {
    const url = `${this.apiUrl}/manga?sort=views&limit=20&page=${page}`
    return this.parseApiMangaList(url)
  }

  async fetchLatest(page: number): Promise<MangaPage> {
    const url = `${this.apiUrl}/manga?sort=latest&limit=20&page=${page}`
    return this.parseApiMangaList(url)
  }

  async searchManga(query: string, page: number): Promise<MangaPage> {
    const url = `${this.apiUrl}/manga?search=${encodeURIComponent(query)}&limit=20&page=${page}`
    return this.parseApiMangaList(url)
  }

  private async parseApiMangaList(url: string): Promise<MangaPage> {
    const jsonStr = await this.fetchHtml(url, { silent: true })
    if (!jsonStr) return { manga: [], hasNextPage: false }

    try {
      const data = JSON.parse(jsonStr)
      // The API returns { success: true, data: { mangas: [...] } }
      const items =
        data.data?.mangas ||
        (Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [])

      const manga: Manga[] = items.map((item: any) => {
        let coverUrl = item.cover_image || ''
        if (coverUrl.includes('api.mangatek.com')) {
          coverUrl = coverUrl.replace('api.mangatek.com', 'api.mangasid.com')
        }

        return {
          id: String(item.id),
          title: item.title,
          coverUrl,
          url: `${this.baseUrl}/manga/${item.slug}`,
          status: item.status || 'Unknown'
        }
      })

      return {
        manga,
        hasNextPage: items.length >= 20
      }
    } catch (e: any) {
      console.error('[MangaSid] Failed to parse API response:', e.message)
      return { manga: [], hasNextPage: false }
    }
  }

  async fetchMangaDetails(manga: Manga): Promise<Manga> {
    const url = `${this.apiUrl}/manga/${manga.id}`
    const jsonStr = await this.fetchHtml(url, { silent: true })
    if (!jsonStr) return manga

    try {
      const data = JSON.parse(jsonStr)
      const details = data.data || data

      const genres: string[] = []
      if (details.display_tags) {
        details.display_tags.forEach((tag: any) => genres.push(tag.name || tag))
      }

      return {
        ...manga,
        title: details.title || manga.title,
        description: details.description || details.description_preview || '',
        author: details.author || 'Unknown',
        status: details.status || 'Ongoing',
        genres: [...new Set(genres)]
      }
    } catch (e) {
      console.error('[MangaSid] Failed to fetch details from API:', e)
      return manga
    }
  }

  async fetchChapters(mangaIdOrUrl: string): Promise<Chapter[]> {
    let mangaId = mangaIdOrUrl

    // If it's a full URL, try to extract ID or fetch HTML to find it
    if (mangaIdOrUrl.startsWith('http')) {
      // 1. Try to extract numeric ID from URL slug if it follows a pattern like /manga/123-slug (unlikely for MangaSid)
      // 2. Fallback: Fetch HTML and look for the ID
      const html = await this.fetchHtml(mangaIdOrUrl)
      if (!html) return []

      const unescapedHtml = html.replace(/&quot;/g, '"')

      const idMatch =
        unescapedHtml.match(/"id"\s*:\s*\[\d+,\s*(\d+)\]/) || // Astro state pattern
        unescapedHtml.match(/"id"\s*:\s*(\d+)/) ||
        unescapedHtml.match(/id\s*=\s*(\d+)/) ||
        unescapedHtml.match(/"manga_?id"\s*:\s*(\d+)/)

      mangaId = idMatch ? idMatch[1] : ''

      if (!mangaId) {
        console.warn('[MangaSid] Could not find numeric ID from HTML, falling back to basic scrap.')
        return this.scrapeChaptersFromHtml(html)
      }
    }

    // Now we have a numeric ID (hopefully), fetch from API
    const apiUrl = `${this.apiUrl}/manga/${mangaId}`
    const jsonStr = await this.fetchHtml(apiUrl, { silent: true })
    if (!jsonStr) return []

    try {
      const data = JSON.parse(jsonStr)
      const details = data.data || data
      const slug = details.slug || mangaId
      const apiChapters = details.MangaChapters || details.chapters || []

      return apiChapters
        .map((ch: any) => ({
          id: `${this.baseUrl}/reader/${slug}/${ch.chapter_number}`,
          title: `الفصل ${ch.chapter_number}${ch.title ? ` - ${ch.title}` : ''}`,
          url: `${this.baseUrl}/reader/${slug}/${ch.chapter_number}`,
          number: parseFloat(ch.chapter_number),
          date: ch.release_date || undefined
        }))
        .sort((a: any, b: any) => b.number - a.number)
    } catch (e: any) {
      console.error('[MangaSid] Failed to fetch chapters from API:', e.message)
      return []
    }
  }

  private scrapeChaptersFromHtml(html: string): Chapter[] {
    const $ = cheerio.load(html)
    const chapters: Chapter[] = []

    // Specific selector to avoid "Start Reading" button
    $('div.grid a[href*="/reader/"]').each((_, el) => {
      const a = $(el)
      const url = a.attr('href')
      if (!url) return

      const absoluteUrl = url.startsWith('http') ? url : new URL(url, this.baseUrl).toString()
      const title = a.find('h3').text().trim() || a.text().trim()

      // Filter out empty or "Start Reading" style links
      if (!title || title.includes('ابدأ')) return

      const numMatch = title.match(/\d+/)
      const number = numMatch ? parseFloat(numMatch[0]) : 0

      chapters.push({
        id: absoluteUrl,
        title,
        url: absoluteUrl,
        number
      })
    })

    return chapters.sort((a, b) => b.number - a.number)
  }

  async fetchPages(chapterUrl: string): Promise<string[]> {
    const html = await this.fetchHtml(chapterUrl)
    if (!html) return []

    // Robust extraction from script tags (Astro hydration state)
    const tokenMatch = html.match(/"chapter_token"\s*:\s*"([^"]+)"/)
    const imagesMatch = html.match(/"images"\s*:\s*(\[[^\]]+\])/)

    if (tokenMatch && imagesMatch) {
      try {
        const token = tokenMatch[1]
        const imageIds = JSON.parse(imagesMatch[1])
        return imageIds.map(
          (id: string) => `${this.apiUrl}/chapters/stream/${token}/${id}?v=${Date.now()}`
        )
      } catch (err: any) {
        console.warn('[MangaSid] Failed to extract JSON images:', err.message)
      }
    }

    // Fallback: search for direct image tags in the reader container
    const $ = cheerio.load(html)
    const pages: string[] = []
    $('img').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src')
      if (
        src &&
        (src.includes('/stream/') || src.includes('mangasid') || src.includes('mangatek'))
      ) {
        pages.push(src)
      }
    })

    return [...new Set(pages)]
  }
}
