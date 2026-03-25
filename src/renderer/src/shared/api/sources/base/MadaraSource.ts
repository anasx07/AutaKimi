import { DataService } from '@renderer/shared/api'
import * as cheerio from 'cheerio'
import { ISourceAdapter, Manga, Chapter, MangaPage } from '../types'

export class MadaraSource implements ISourceAdapter {
  public theme: string = 'madara'
  private workingUrlPatterns: string[] = []

  constructor(
    public id: string,
    public name: string,
    public version: string,
    public baseUrl: string,
    public lang: string,
    public icon: string,
    public nsfw: boolean = false
  ) {}

  private isCfChallengePage(html: string): boolean {
    if (typeof html !== 'string' || !html) return false
    const lower = html.toLowerCase()
    return (lower.includes('cf_chl') ||
      lower.includes('challenges.cloudflare.com') ||
      lower.includes('verifying you are human') ||
      lower.includes('performing security verification') ||
      lower.includes('jschl') ||
      lower.includes('__cf_chl')) && 
      !lower.includes('success!') && 
      !lower.includes('verified!')
  }

  protected async fetchHtml(url: string, options: any = {}): Promise<string> {
    if (!url) {
      console.warn('[MadaraSource] Cannot fetch undefined or empty URL');
      return '';
    }

    const chromeVersion = navigator.userAgent.match(/Chrome\/(\d+)/)?.[1] || '130'
    const defaultHeaders = {
      'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion}.0.0.0 Safari/537.36`,
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

    let html = (res && typeof res.data === 'string') ? res.data : ''
    
    // Even if 200 OK, it might be a challenge page
    const isBlocked = !res || res.status === 403 || this.isCfChallengePage(html)

    if (isBlocked) {
      console.log(`[MadaraSource] Blocked or challenge detected on ${url}, fetching via browser...`)
      try {
        const browserHtml = await DataService.cfFetchHtml(url)
        if (browserHtml && !this.isCfChallengePage(browserHtml)) return browserHtml
      } catch (e) {
        console.warn('[MadaraSource] cfFetchHtml failed:', e)
      }
    }

    if (!html && !options.silent) {
      console.warn(`[MadaraSource] Fetch ${res?.status || 'failed'} for ${url}`)
    }

    return html
  }

  async fetchPopular(page: number, _extraArgs?: any): Promise<MangaPage> {
    const defaultUrls = [
      `${this.baseUrl}/manga/page/${page}/?m_orderby=views`,
      `${this.baseUrl}/manga/?m_orderby=views`,
      `${this.baseUrl}/series/page/${page}/?m_orderby=views`,
      `${this.baseUrl}/?m_orderby=views&page=${page}`,
      `${this.baseUrl}/manga/page/${page}/?m_orderby=trending`
    ]
    
    // Sort so working patterns are tried first
    const urls = [...new Set([...this.workingUrlPatterns, ...defaultUrls])]

    for (const url of urls) {
      const res = await this.parseMangaList(url, { page })
      if (res.manga.length > 0) {
        // Cache the underlying template pattern (not the specific page URL)
        const pattern = url.replace(`/page/${page}/`, '/page/{page}/').replace(`page=${page}`, 'page={page}')
        if (!this.workingUrlPatterns.includes(pattern)) this.workingUrlPatterns.unshift(pattern)
        return res
      }
    }
    
    throw new Error('No items found. This might be due to a change in site structure or persistent Cloudflare protection.')
  }

  async fetchLatest(page: number, _extraArgs?: any): Promise<MangaPage> {
    const urls = [
      `${this.baseUrl}/manga/page/${page}/?m_orderby=latest`,
      `${this.baseUrl}/manga/?m_orderby=latest`,
      `${this.baseUrl}/series/page/${page}/?m_orderby=latest`,
      `${this.baseUrl}/?m_orderby=latest&page=${page}`,
      `${this.baseUrl}/manga/page/${page}/?m_orderby=new-manga`
    ]

    for (const url of urls) {
      const res = await this.parseMangaList(url, { page })
      if (res.manga.length > 0) return res
    }
    
    throw new Error('No items found.')
  }

  async searchManga(query: string, page: number, _extraArgs?: any): Promise<MangaPage> {
    const url = `${this.baseUrl}/page/${page}/?s=${encodeURIComponent(query)}&post_type=wp-manga`
    return this.parseMangaList(url, { page })
  }

  private parseMangaItems($: cheerio.CheerioAPI): Manga[] {
    const manga: Manga[] = []
    const seen = new Set<string>()

    // Primary containers for Madara
    const items = $('.manga-item, .page-item-detail, .c-tabs-item__content, .manga, .item-thumb')
    
    items.each((_, el) => {
      const node = $(el)
      const titleNode = node.find('.post-title a, h3 a, h4 a, .manga-name a').first()
      const title = titleNode.text().trim()
      let mangaUrl = titleNode.attr('href') || ''
      
      if (!mangaUrl || seen.has(mangaUrl) || !title) return
      seen.add(mangaUrl)

      // Resolve relative URLs if any
      if (mangaUrl.startsWith('/')) {
        mangaUrl = new URL(mangaUrl, this.baseUrl).toString()
      }

      const imgNode = node.find('img').first()
      let cover = imgNode.attr('src') || imgNode.attr('data-src') || imgNode.attr('data-lazy-src') || ''
      
      if (cover && cover.startsWith('/')) {
        cover = new URL(cover, this.baseUrl).toString()
      }

      let status = node.find('.mg_status, .status, .post-on').first().text().trim()
      if (!status) {
        status = node.find('.post-on a').attr('title') || ''
      }

      manga.push({
        id: mangaUrl,
        title,
        coverUrl: cover,
        url: mangaUrl,
        status: status || 'Unknown'
      })
    })

    return manga
  }

  protected async parseMangaList(url: string, options: any = {}): Promise<MangaPage> {
    const targetUrl = url.includes('{page}') ? url.replace('{page}', options.page || '1') : url
    const html = await this.fetchHtml(targetUrl, options)
    if (!html) return { manga: [], hasNextPage: false }
    
    const $ = cheerio.load(html)
    const manga = this.parseMangaItems($)

    const hasNextPage = $('.nextpostslink, .next, .nav-previous a, .paging-navigation a, .load-more').length > 0
    return { manga, hasNextPage }
  }

  async fetchMangaDetails(manga: Manga): Promise<Manga> {
    const html = await this.fetchHtml(manga.url || '')
    const $ = cheerio.load(html)
    
    // MangaLionz specific title selector and fallback
    const title = $('.post-title h1, .manga-title h1').text().trim() || manga.title

    const description = $('.summary__content').text().trim() || 
                        $('.description-summary').text().trim() ||
                        $('.manga-excerpt').text().trim() ||
                        $('.tab-summary').text().trim()
                        
    const author = $('.author-content').text().trim()
    const artist = $('.artist-content').text().trim()
    const status = $('.post-status .summary-content').first().text().trim()
    
    const genres: string[] = []
    $('.genres-content a').each((_, el) => {
      genres.push($(el).text().trim())
    })

    return {
      ...manga,
      title,
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
    
    const chapterSelector = '.wp-manga-chapter a, .chapter-item .chapter a, .li .chapter a'
    let rows = $(chapterSelector)
    
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
          console.log(`[MadaraSource] Ajax chapters success, parsing...`)
          $ = cheerio.load(ajaxHtml)
          rows = $(chapterSelector)
        }
      }
    }

    const chapters: Chapter[] = []
    rows.each((i, el) => {
      const a = $(el)
      const url = a.attr('href') || ''
      const title = a.text().trim()
      const numStr = title.match(/\d+[\.\d]*/)?.[0] || '0'
      
      const container = a.closest('.wp-manga-chapter, li, .chapter-item')
      let dateStr = container.find('.chapter-release-date, .post-on').text().trim()
      
      if (!dateStr || dateStr.length < 3) {
        dateStr = container.find('.post-on a').attr('title') || container.find('.chapter-release-date a').attr('title') || ''
      }
      
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
      if (src && src.trim() && !src.includes('data:image')) {
        pages.push(src.trim())
      }
    })

    return pages
  }
}
