import { MadaraSource } from '../base/MadaraSource'
import { MangaPage, Manga, Chapter } from '../types'

export class MangaLek extends MadaraSource {
  constructor() {
    super(
      'ma.lmanwa.extension.ar.mangalek',
      'Manga Lek',
      '0.0.1',
      'https://lekmanga.online', // Updated to latest working mirror
      'ar',
      'ma.lmanwa.extension.ar.mangalek',
      false
    )
  }

  // MangaLek blocks /manga/ and /series/ with 403, but allows / (root)
  async fetchPopular(page: number): Promise<MangaPage> {
    if (page === 1) {
      const res = await this.parseMangaList(this.baseUrl, { silent: true })
      if (res.manga.length > 0) {
          return { ...res, hasNextPage: true } 
      }
    }
    // Fallback to AJAX for page 2+ as /manga/page/2/ is blocked
    return this.fetchAjaxPagination(page, { m_orderby: 'views' })
  }

  async fetchLatest(page: number): Promise<MangaPage> {
    if (page === 1) {
      const res = await this.parseMangaList(this.baseUrl, { silent: true })
      if (res.manga.length > 0) {
          return { ...res, hasNextPage: true } 
      }
    }
    // Fallback to AJAX for page 2+ as /manga/page/2/ is blocked
    return this.fetchAjaxPagination(page, { m_orderby: 'latest' })
  }

  async fetchMangaDetails(manga: Manga): Promise<Manga> {
    try {
      return await super.fetchMangaDetails(manga)
    } catch (e: any) {
      console.log(`[MangaLek] fetchMangaDetails failed, trying Yoast API fallback: ${e.message}`)
      const yoastUrl = `${this.baseUrl}/wp-json/yoast/v1/get_head?url=${encodeURIComponent(manga.url || '')}`
      const jsonStr = await this.fetchHtml(yoastUrl, { silent: true })
      if (jsonStr) {
        try {
          const data = JSON.parse(jsonStr)
          const og = data.json_ld?.['@graph']?.find((x: any) => x['@type'] === 'WebPage')
          return {
            ...manga,
            description: data.og_description || (og?.description) || manga.description,
            title: data.title || manga.title
          }
        } catch (err) {}
      }
      return manga
    }
  }

  async fetchChapters(mangaUrl: string): Promise<Chapter[]> {
    try {
      const chapters = await super.fetchChapters(mangaUrl)
      if (chapters.length > 0) return chapters
      throw new Error('No chapters found in HTML')
    } catch (e: any) {
      console.log(`[MangaLek] fetchChapters failed or empty, trying AJAX fallback: ${e.message}`)
      // Try to find post ID from slug
      return [] 
    }
  }
}
