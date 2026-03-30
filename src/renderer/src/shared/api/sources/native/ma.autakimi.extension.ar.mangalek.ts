import { MadaraSource } from '../base/MadaraSource'
import { MangaPage, Manga, Chapter } from '../types'
import * as cheerio from 'cheerio'

export class MangaLek extends MadaraSource {
  constructor() {
    super(
      'ma.autakimi.extension.ar.mangalek',
      'Manga Lek',
      '0.0.1',
      'https://lekmanga.online', // Updated to latest working mirror
      'ar',
      'ma.autakimi.extension.ar.mangalek',
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
            description: data.og_description || og?.description || manga.description,
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
      console.log(`[MangaLek] fetchChapters failed, trying extended ID recovery: ${e.message}`)
      const html = await this.fetchHtml(mangaUrl, { silent: true })
      const idMatch =
        html.match(/manga-id-(\d+)/) ||
        html.match(/id="manga-id" value="(\d+)"/) ||
        html.match(/"post_id":"?(\d+)"?/)

      if (idMatch && idMatch[1]) {
        const mangaId = idMatch[1]
        const ajaxUrl = `${this.baseUrl}/wp-admin/admin-ajax.php`
        const body = `action=manga_get_chapters&manga=${mangaId}`

        try {
          const ajaxRes = await this.fetchHtml(ajaxUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body
          })

          if (ajaxRes && ajaxRes.length > 50) {
            const $ = cheerio.load(ajaxRes)
            const rows = $('.wp-manga-chapter a')
            const chapters: Chapter[] = []
            rows.each((i, el) => {
              const a = $(el)
              const url = a.attr('href') || ''
              const title = a.text().trim()
              if (url) chapters.push({ id: url, title, url, number: rows.length - i })
            })
            if (chapters.length > 0) return chapters
          }
        } catch (err) {}
      }
      return []
    }
  }
}
