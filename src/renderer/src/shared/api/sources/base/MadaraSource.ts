import { DataService } from '@renderer/shared/api'
import * as cheerio from 'cheerio'
import { ISourceAdapter, Manga, Chapter, MangaPage } from '../types'

export class MadaraSource implements ISourceAdapter {
  public theme: string = 'madara'

  constructor(
    public id: string,
    public name: string,
    public version: string,
    public baseUrl: string,
    public lang: string,
    public icon: string,
    public nsfw: boolean = false
  ) {}

  protected async fetchHtml(url: string, options: any = {}): Promise<string> {
    if (!url) {
      console.warn('[MadaraSource] Cannot fetch undefined or empty URL');
      return '';
    }

    const defaultHeaders = {
      'Referer': this.baseUrl.endsWith('/') ? this.baseUrl : `${this.baseUrl}/`,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    }

    const res: any = await DataService.fetchText(url, {
      ...options,
      bypassCf: true,
      headers: { ...defaultHeaders, ...options.headers }
    })

    if (!res || !res.ok) {
      if (!options.silent) {
        console.warn(`[MadaraSource] Fetch ${res?.status || 'failed'} for ${url}${res?.error ? `: ${res.error}` : ''}`)
      }
      return ''
    }

    if (typeof res.data === 'string') return res.data
    return ''
  }

  async fetchPopular(page: number, _extraArgs?: any): Promise<MangaPage> {
    const urls = [
      `${this.baseUrl}/manga/page/${page}/?m_orderby=views`,
      `${this.baseUrl}/series/page/${page}/?m_orderby=views`,
      `${this.baseUrl}/?m_orderby=views&page=${page}`,
      `${this.baseUrl}/manga/page/${page}/?m_orderby=trending`
    ]

    for (const url of urls) {
      const res = await this.parseMangaList(url, { silent: true })
      if (res.manga.length > 0) return res
    }
    return { manga: [], hasNextPage: false }
  }

  async fetchLatest(page: number, _extraArgs?: any): Promise<MangaPage> {
    const urls = [
      `${this.baseUrl}/manga/page/${page}/?m_orderby=latest`,
      `${this.baseUrl}/series/page/${page}/?m_orderby=latest`,
      `${this.baseUrl}/?m_orderby=latest&page=${page}`,
      `${this.baseUrl}/manga/page/${page}/?m_orderby=new-manga`
    ]

    for (const url of urls) {
      const res = await this.parseMangaList(url, { silent: true })
      if (res.manga.length > 0) return res
    }
    return { manga: [], hasNextPage: false }
  }

  async searchManga(query: string, page: number, _extraArgs?: any): Promise<MangaPage> {
    const url = `${this.baseUrl}/page/${page}/?s=${encodeURIComponent(query)}&post_type=wp-manga`
    return this.parseMangaList(url)
  }

  protected async parseMangaList(url: string, options: any = {}): Promise<MangaPage> {
    const html = await this.fetchHtml(url, options)
    const $ = cheerio.load(html)
    const manga: Manga[] = []

    $('.manga-item, .page-item-detail, .c-tabs-item__content').each((_, el) => {
      const node = $(el)
      const titleNode = node.find('.post-title a, h3 a, h4 a')
      const title = titleNode.text().trim()
      const mangaUrl = titleNode.attr('href') || ''
      const cover = node.find('img').attr('src') || node.find('img').attr('data-src') || node.find('img').attr('data-lazy-src') || ''

      if (mangaUrl) {
        manga.push({
          id: mangaUrl,
          title,
          coverUrl: cover,
          url: mangaUrl,
          status: 'Unknown'
        })
      }
    })

    const hasNextPage = $('.nextpostslink').length > 0 || $('.next').length > 0
    return { manga, hasNextPage }
  }

  async fetchMangaDetails(manga: Manga): Promise<Manga> {
    const html = await this.fetchHtml(manga.url || '')
    const $ = cheerio.load(html)

    const description = $('.summary__content').text().trim() || $('.description-summary').text().trim()
    const author = $('.author-content').text().trim()
    const artist = $('.artist-content').text().trim()
    const status = $('.post-status .summary-content').first().text().trim()
    
    const genres: string[] = []
    $('.genres-content a').each((_, el) => {
      genres.push($(el).text().trim())
    })

    return {
      ...manga,
      description,
      author,
      artist,
      status,
      genres
    }
  }

  async fetchChapters(mangaUrl: string): Promise<Chapter[]> {
    let html = await this.fetchHtml(mangaUrl)
    let $ = cheerio.load(html)
    
    let rows = $('.wp-manga-chapter a')
    
    // Ajax fallback
    if (rows.length === 0) {
      const mangaIdNode = $('input.rating-post-id, #manga-chapters-holder')
      const mangaId = mangaIdNode.attr('value') || mangaIdNode.attr('data-id')
      if (mangaId) {
        console.log(`[MadaraSource] No chapters in HTML, trying AJAX for manga ID: ${mangaId}`)
        const ajaxHtml = await this.fetchHtml(`${this.baseUrl}/wp-admin/admin-ajax.php`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `action=manga_get_chapters&manga=${mangaId}`
        })
        if (ajaxHtml) {
          $ = cheerio.load(ajaxHtml)
          rows = $('.wp-manga-chapter a')
        }
      }
    }

    const chapters: Chapter[] = []
    rows.each((i, el) => {
      const a = $(el)
      const url = a.attr('href') || ''
      const title = a.text().trim()
      const numStr = title.match(/\d+/)?.[0] || '0'
      const dateStr = a.closest('.wp-manga-chapter, li').find('.chapter-release-date').text().trim()
      
      if (url) {
        chapters.push({
          id: url,
          title,
          url,
          number: parseFloat(numStr) || (rows.length - i),
          date: dateStr || undefined
        })
      }
    })

    return chapters
  }

  async fetchPages(chapterUrl: string): Promise<string[]> {
    const html = await this.fetchHtml(chapterUrl)
    const $ = cheerio.load(html)
    const pages: string[] = []

    $('.page-break img, .reading-content img, .wp-manga-chapter-img img').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src') || $(el).attr('data-cdn')
      if (src && src.trim()) {
        pages.push(src.trim())
      }
    })

    return pages
  }

  protected async fetchAjaxPagination(page: number, extraArgs: any = {}): Promise<MangaPage> {
    const url = `${this.baseUrl}/wp-admin/admin-ajax.php`
    const body = new URLSearchParams()
    body.append('action', 'madara_load_more')
    body.append('page', (page - 1).toString()) 
    body.append('template', 'madara-core/content/content-archive')
    
    const vars = {
      paged: page,
      posts_per_page: 30,
      ...extraArgs
    }
    body.append('vars', JSON.stringify(vars))

    const res: any = await DataService.fetchText(url, {
      method: 'POST',
      body: body.toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': this.baseUrl
      },
      bypassCf: true
    })

    if (!res || !res.ok || !res.data) return { manga: [], hasNextPage: false }

    const $ = cheerio.load(res.data)
    const manga: Manga[] = []
    
    $('.manga-item, .page-item-detail, .c-tabs-item__content').each((_, el) => {
      const node = $(el)
      const titleNode = node.find('.post-title a, h3 a, h4 a')
      const title = titleNode.text().trim()
      const mangaUrl = titleNode.attr('href') || ''
      const cover = node.find('img').attr('src') || node.find('img').attr('data-src') || node.find('img').attr('data-lazy-src') || ''
      
      if (mangaUrl) {
        manga.push({
          id: mangaUrl,
          title,
          coverUrl: cover,
          description: node.find('.item-summary, .summary').text().trim(),
          status: node.find('.mg_status, .status').text().trim(),
          url: mangaUrl
        })
      }
    })

    return {
      manga,
      hasNextPage: manga.length > 0 
    }
  }
}
