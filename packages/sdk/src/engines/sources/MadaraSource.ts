import * as cheerio from 'cheerio'
import { ISourceAdapter, Manga, Chapter, MangaPage, FetchOptions } from '../../types'
import { networkClient } from '../../services/network'
import { NetworkUtils } from '../../utils/network'

export class MadaraSource implements ISourceAdapter {
  public theme: string = 'madara'
  public mediaType: 'manga' | 'anime' = 'manga'
  private workingUrlPatterns: string[] = []

  constructor(
    public id: string,
    public name: string,
    public version: string,
    public baseUrl: string,
    public lang: string,
    public icon: string,
    public nsfw: boolean = false,
    public customSelectors?: Record<string, string>
  ) {}

  protected async fetchHtml(url: string, options: FetchOptions = {}): Promise<string> {
    if (!url) return ''

    const defaultHeaders = NetworkUtils.getStealthHeaders(this.baseUrl)
    
    const res = await networkClient.fetch(url, {
      ...options,
      headers: { ...defaultHeaders, ...options.headers }
    })

    if (!res.ok) {
      if (!options.silent) console.warn(`[MadaraSource] Fetch failed for ${url}: ${res.error}`)
      return ''
    }

    return await res.value.text()
  }

  async fetchPopular(page: number, _extraArgs?: FetchOptions): Promise<MangaPage> {
    const defaultUrls = [
      `${this.baseUrl}/manga/page/${page}/?m_orderby=views`,
      `${this.baseUrl}/manga/?m_orderby=views`,
      `${this.baseUrl}/series/page/${page}/?m_orderby=views`,
      `${this.baseUrl}/?m_orderby=views&page=${page}`,
      `${this.baseUrl}/manga/page/${page}/?m_orderby=trending`
    ]

    const urls = [
      ...new Set([
        ...this.workingUrlPatterns.map((p) => p.replace('{page}', String(page))),
        ...defaultUrls
      ])
    ]

    if (this.workingUrlPatterns.length > 0) {
      const url = this.workingUrlPatterns[0].replace('{page}', String(page))
      try {
        const res = await this.parseMangaList(url, { page, silent: true })
        if (res.manga && res.manga.length > 0) return res
      } catch (e) {}
    }

    const promises = urls.map(async (url) => {
      const res = await this.parseMangaList(url, { page, silent: true })
      if (res.manga && res.manga.length > 0) return { res, url }
      throw new Error(`Empty result for ${url}`)
    })

    try {
      const { res, url } = await (Promise as any).any(promises)
      const pattern = url.replace(`/page/${page}/`, '/page/{page}/').replace(`page=${page}`, 'page={page}')
      if (!this.workingUrlPatterns.includes(pattern)) this.workingUrlPatterns.unshift(pattern)
      return res
    } catch {
      const fallbackUrl = urls[0]
      const fallbackRes = await this.parseMangaList(fallbackUrl, { page, silent: false })
      if (fallbackRes.manga && fallbackRes.manga.length > 0) {
        const pattern = fallbackUrl.replace(`/page/${page}/`, '/page/{page}/').replace(`page=${page}`, 'page={page}')
        if (!this.workingUrlPatterns.includes(pattern)) this.workingUrlPatterns.unshift(pattern)
        return fallbackRes
      }
      throw new Error('No items found.')
    }
  }

  async fetchLatest(page: number, _extraArgs?: FetchOptions): Promise<MangaPage> {
    const defaultUrls = [
      `${this.baseUrl}/manga/page/${page}/?m_orderby=latest`,
      `${this.baseUrl}/manga/?m_orderby=latest`,
      `${this.baseUrl}/series/page/${page}/?m_orderby=latest`,
      `${this.baseUrl}/?m_orderby=latest&page=${page}`,
      `${this.baseUrl}/manga/page/${page}/?m_orderby=new-manga`
    ]

    const urls = [
      ...new Set([
        ...this.workingUrlPatterns.map((p) => p.replace('{page}', String(page))),
        ...defaultUrls
      ])
    ]

    if (this.workingUrlPatterns.length > 0) {
      const url = this.workingUrlPatterns[0].replace('{page}', String(page))
      try {
        const res = await this.parseMangaList(url, { page, silent: true })
        if (res.manga && res.manga.length > 0) return res
      } catch (e) {}
    }

    const promises = urls.map(async (url) => {
      const res = await this.parseMangaList(url, { page, silent: true })
      if (res.manga && res.manga.length > 0) return { res, url }
      throw new Error(`Empty result for ${url}`)
    })

    try {
      const { res, url } = await (Promise as any).any(promises)
      const pattern = url.replace(`/page/${page}/`, '/page/{page}/').replace(`page=${page}`, 'page={page}')
      if (!this.workingUrlPatterns.includes(pattern)) this.workingUrlPatterns.unshift(pattern)
      return res
    } catch {
      const fallbackUrl = urls[0]
      const fallbackRes = await this.parseMangaList(fallbackUrl, { page, silent: false })
      if (fallbackRes.manga && fallbackRes.manga.length > 0) {
        const pattern = fallbackUrl.replace(`/page/${page}/`, '/page/{page}/').replace(`page=${page}`, 'page={page}')
        if (!this.workingUrlPatterns.includes(pattern)) this.workingUrlPatterns.unshift(pattern)
        return fallbackRes
      }
      throw new Error('No items found.')
    }
  }

  async searchManga(query: string, page: number, _extraArgs?: FetchOptions): Promise<MangaPage> {
    const url = `${this.baseUrl}/page/${page}/?s=${encodeURIComponent(query)}&post_type=wp-manga`
    return this.parseMangaList(url, { page })
  }

  private parseMangaItems($: cheerio.CheerioAPI): Manga[] {
    const manga: Manga[] = []
    const seen = new Set<string>()
    const items = $('.manga-item, .page-item-detail, .c-tabs-item__content, .manga, .item-thumb')

    items.each((_, el) => {
      const node = $(el)
      const titleNode = node.find('.post-title a, h3 a, h4 a, .manga-name a').first()
      const title = titleNode.text().trim()
      let mangaUrl = titleNode.attr('href') || ''

      if (!mangaUrl || seen.has(mangaUrl) || !title) return
      seen.add(mangaUrl)

      if (mangaUrl.startsWith('/')) {
        mangaUrl = new URL(mangaUrl, this.baseUrl).toString()
      }

      const imgNode = node.find('img').first()
      let cover = imgNode.attr('src') || imgNode.attr('data-src') || imgNode.attr('data-lazy-src') || ''
      if (cover && cover.startsWith('/')) {
        cover = new URL(cover, this.baseUrl).toString()
      }

      let status = node.find('.mg_status, .status, .post-on').first().text().trim()
      if (!status) status = node.find('.post-on a').attr('title') || ''

      const description = node.find('.post-content_item .summary-content').text().trim() ||
        node.find('.manga-excerpt').text().trim() ||
        node.find('.summary-content').text().trim() || ''

      manga.push({ id: mangaUrl, title, coverUrl: cover, url: mangaUrl, status: status || 'Unknown', description, pkg: this.id })
    })

    return manga
  }

  protected async parseMangaList(url: string, options: FetchOptions = {}): Promise<MangaPage> {
    const targetUrl = url.includes('{page}') ? url.replace('{page}', String(options.page || '1')) : url
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

    const title = $('.post-title h1, .manga-title h1').text().trim() || manga.title
    const description = $('.summary__content').text().trim() || $('.description-summary').text().trim() ||
      $('.manga-excerpt').text().trim() || $('.tab-summary').text().trim()
    const author = $('.author-content').text().trim()
    const artist = $('.artist-content').text().trim()
    const status = $('.post-status .summary-content').first().text().trim()

    const genres: string[] = []
    $('.genres-content a').each((_, el) => { genres.push($(el).text().trim()) })

    return { ...manga, title, description, author, artist, status, genres }
  }

  async fetchChapters(mangaUrl: string): Promise<Chapter[]> {
    const html = await this.fetchHtml(mangaUrl)
    if (!html) return []
    let $ = cheerio.load(html)

    const chapterSelector = this.customSelectors?.chapterListSelector || '.wp-manga-chapter a, li.wp-manga-chapter a, .chapter-item .chapter a, .li .chapter a, .chapter-link'
    let rows = $(chapterSelector)

    if (rows.length === 0) {
      const mangaIdNode = $('input.rating-post-id, #manga-chapters-holder, input#manga-id, input[name="manga"]')
      const mangaId = mangaIdNode.attr('value') || mangaIdNode.attr('data-id')

      if (mangaId) {
        const ajaxHeaders = { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest', Referer: mangaUrl }
        let ajaxHtml = await this.fetchHtml(`${this.baseUrl}/wp-admin/admin-ajax.php`, { method: 'POST', headers: ajaxHeaders, body: `action=manga_get_chapters&manga=${mangaId}` })
        
        if (ajaxHtml && ajaxHtml.trim().startsWith('{')) {
          try {
            const json = JSON.parse(ajaxHtml)
            ajaxHtml = json.data || json.html || ajaxHtml
          } catch (e) {}
        }

        if (ajaxHtml && ajaxHtml.length > 30) {
          $ = cheerio.load(ajaxHtml)
          rows = $(chapterSelector)
        }

        if (rows.length === 0) {
          const fallbacks = [`action=manga_get_chapters&manga_id=${mangaId}`, `action=ajax_chap&id=${mangaId}`, `action=manga_get_chapters&m_id=${mangaId}`]
          for (const body of fallbacks) {
            const res = await this.fetchHtml(`${this.baseUrl}/wp-admin/admin-ajax.php`, { method: 'POST', headers: ajaxHeaders, body })
            if (res && res.length > 50) {
              $ = cheerio.load(res)
              rows = $(chapterSelector)
              if (rows.length > 0) break
            }
          }
        }

        if (rows.length === 0) {
          const slugAjaxUrl = mangaUrl.endsWith('/') ? `${mangaUrl}ajax/chapters/` : `${mangaUrl}/ajax/chapters/`
          let sRes = await this.fetchHtml(slugAjaxUrl, { method: 'POST', headers: ajaxHeaders })
          if (!sRes || sRes.length < 50) sRes = await this.fetchHtml(slugAjaxUrl, { method: 'GET', headers: ajaxHeaders })
          if (sRes && sRes.length > 50) {
            $ = cheerio.load(sRes)
            rows = $(chapterSelector)
          }
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
      if (!dateStr || dateStr.length < 3) dateStr = container.find('.post-on a').attr('title') || container.find('.chapter-release-date a').attr('title') || ''
      if (url) {
        chapters.push({ id: url, title, url, number: parseFloat(numStr) || rows.length - i, date: dateStr || undefined })
      }
    })
    return chapters
  }

  async fetchPages(chapterUrl: string): Promise<string[]> {
    const html = await this.fetchHtml(chapterUrl)
    if (!html) return []
    const $ = cheerio.load(html)
    const pages: string[] = []
    $('.page-break img, .reading-content img, .wp-manga-chapter-img img').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src') || $(el).attr('data-cdn')
      if (src && src.trim() && !src.includes('data:image')) pages.push(src.trim())
    })
    return pages
  }
}
