import { DataService } from '@renderer/shared/api'
import { NetworkUtils } from '../../network.utils'
import { bypassRegistry } from '../../bypass.registry'
import * as cheerio from 'cheerio'
import { ISourceAdapter, Manga, Chapter, MangaPage, FetchOptions } from '../types'

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

  private isCfChallengePage(html: string): boolean {
    if (typeof html !== 'string' || !html) return false
    const lower = html.toLowerCase()
    return (
      (lower.includes('cf_chl') ||
        lower.includes('challenges.cloudflare.com') ||
        lower.includes('verifying you are human') ||
        lower.includes('performing security verification') ||
        lower.includes('jschl') ||
        lower.includes('__cf_chl')) &&
      !lower.includes('success!') &&
      !lower.includes('verified!')
    )
  }

  protected async fetchHtml(url: string, options: FetchOptions = {}): Promise<string> {
    if (!url) {
      console.warn('[MadaraSource] Cannot fetch undefined or empty URL')
      return ''
    }

    const defaultHeaders = NetworkUtils.getStealthHeaders(this.baseUrl)

    const res: any = await DataService.fetchText(url, {
      ...options,
      bypassCf: true,
      headers: { ...defaultHeaders, ...options.headers }
    })

    const html = res && typeof res.data === 'string' ? res.data : ''

    // Even if 200 OK, it might be a challenge page
    const isBlocked = !res || res.status === 403 || this.isCfChallengePage(html)

    if (isBlocked) {
      const hostname = new URL(this.baseUrl).hostname
      const isResolved = bypassRegistry.isResolved(hostname)

      // We trigger the bypass if:
      // 1. It's a non-silent request (user explicit action)
      // 2. It's a silent request but we've already resolved this domain before
      //    (allows background session checks without flicker)
      if (!options.silent || isResolved) {
        if (!options.silent) {
          console.log(`[MadaraSource] Blocked on ${url}, fetching via browser...`)
        }
        try {
          // Pass the silent flag to DataService to control overlay visibility
          const browserHtml = await DataService.cfFetchHtml(url, options.silent)
          if (browserHtml && !this.isCfChallengePage(browserHtml)) {
            bypassRegistry.setResolved(hostname, this.baseUrl)
            // Small delay to ensure cookies are synced to electron's net layer
            await new Promise((resolve) => setTimeout(resolve, 500))
            return browserHtml
          }
        } catch (e) {
          if (!options.silent) console.warn('[MadaraSource] cfFetchHtml failed:', e)
        }
      }
    } else {
      // Mark as active if successfully fetched without block
      const hostname = new URL(this.baseUrl).hostname
      bypassRegistry.reportPulse(hostname)
    }

    if (!html && !options.silent) {
      console.warn(`[MadaraSource] Fetch ${res?.status || 'failed'} for ${url}`)
    }

    return html
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

    // Performance optimization: If we have a working pattern, prioritize it sequentially
    // to avoid spawning multiple parallel background browsers via silent probes.
    if (this.workingUrlPatterns.length > 0) {
      const url = this.workingUrlPatterns[0].replace('{page}', String(page))
      try {
        const res = await this.parseMangaList(url, { page, silent: true })
        if (res.manga && res.manga.length > 0) return res
      } catch (e) {
        // Fallback to parallel discovery if the known pattern failed
      }
    }

    const promises = urls.map(async (url) => {
      const res = await this.parseMangaList(url, { page, silent: true })
      if (res.manga && res.manga.length > 0) return { res, url }
      throw new Error(`Empty result for ${url}`)
    })

    try {
      const { res, url } = await Promise.any(promises)
      const pattern = url
        .replace(`/page/${page}/`, '/page/{page}/')
        .replace(`page=${page}`, 'page={page}')
      if (!this.workingUrlPatterns.includes(pattern)) this.workingUrlPatterns.unshift(pattern)
      return res
    } catch {
      // All silent probes failed (likely CF-blocked). Try ONE non-silent fetch
      // which will trigger a single CF browser bypass via the domain lock.
      console.log(
        `[MadaraSource] All probes failed for ${this.name}, trying CF bypass with first URL...`
      )
      const fallbackUrl = urls[0]
      const fallbackRes = await this.parseMangaList(fallbackUrl, { page, silent: false })
      if (fallbackRes.manga && fallbackRes.manga.length > 0) {
        const pattern = fallbackUrl
          .replace(`/page/${page}/`, '/page/{page}/')
          .replace(`page=${page}`, 'page={page}')
        if (!this.workingUrlPatterns.includes(pattern)) this.workingUrlPatterns.unshift(pattern)
        return fallbackRes
      }
      throw new Error(
        'No items found. This might be due to a change in site structure or persistent Cloudflare protection.'
      )
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

    // Performance optimization: Prioritize known working pattern
    if (this.workingUrlPatterns.length > 0) {
      const url = this.workingUrlPatterns[0].replace('{page}', String(page))
      try {
        const res = await this.parseMangaList(url, { page, silent: true })
        if (res.manga && res.manga.length > 0) return res
      } catch (e) {
        // Fallback to discovery
      }
    }

    const promises = urls.map(async (url) => {
      const res = await this.parseMangaList(url, { page, silent: true })
      if (res.manga && res.manga.length > 0) return { res, url }
      throw new Error(`Empty result for ${url}`)
    })

    try {
      const { res, url } = await Promise.any(promises)
      const pattern = url
        .replace(`/page/${page}/`, '/page/{page}/')
        .replace(`page=${page}`, 'page={page}')
      if (!this.workingUrlPatterns.includes(pattern)) this.workingUrlPatterns.unshift(pattern)
      return res
    } catch {
      // All silent probes failed — try ONE non-silent fetch for CF bypass
      console.log(`[MadaraSource] All latest probes failed for ${this.name}, trying CF bypass...`)
      const fallbackUrl = urls[0]
      const fallbackRes = await this.parseMangaList(fallbackUrl, { page, silent: false })
      if (fallbackRes.manga && fallbackRes.manga.length > 0) {
        const pattern = fallbackUrl
          .replace(`/page/${page}/`, '/page/{page}/')
          .replace(`page=${page}`, 'page={page}')
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
      let cover =
        imgNode.attr('src') || imgNode.attr('data-src') || imgNode.attr('data-lazy-src') || ''

      if (cover && cover.startsWith('/')) {
        cover = new URL(cover, this.baseUrl).toString()
      }

      let status = node.find('.mg_status, .status, .post-on').first().text().trim()
      if (!status) {
        status = node.find('.post-on a').attr('title') || ''
      }

      const description =
        node.find('.post-content_item .summary-content').text().trim() ||
        node.find('.manga-excerpt').text().trim() ||
        node.find('.summary-content').text().trim() ||
        ''

      manga.push({
        id: mangaUrl,
        title,
        coverUrl: cover,
        url: mangaUrl,
        status: status || 'Unknown',
        description
      })
    })

    return manga
  }

  protected async parseMangaList(url: string, options: FetchOptions = {}): Promise<MangaPage> {
    const targetUrl = url.includes('{page}')
      ? url.replace('{page}', String(options.page || '1'))
      : url
    const html = await this.fetchHtml(targetUrl, options)
    if (!html) {
      if (!options.silent) console.warn(`[MadaraSource] Empty HTML received for ${targetUrl}`)
      return { manga: [], hasNextPage: false }
    }

    const $ = cheerio.load(html)
    const manga = this.parseMangaItems($)

    const hasNextPage =
      $('.nextpostslink, .next, .nav-previous a, .paging-navigation a, .load-more').length > 0
    return { manga, hasNextPage }
  }

  async fetchMangaDetails(manga: Manga): Promise<Manga> {
    const html = await this.fetchHtml(manga.url || '')
    const $ = cheerio.load(html)

    // MangaLionz specific title selector and fallback
    const title = $('.post-title h1, .manga-title h1').text().trim() || manga.title

    const description =
      $('.summary__content').text().trim() ||
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
    const html = await this.fetchHtml(mangaUrl)
    if (!html) {
      console.warn(`[MadaraSource] Empty HTML for chapters: ${mangaUrl}`)
      return []
    }
    let $ = cheerio.load(html)

    const chapterSelector =
      this.customSelectors?.chapterListSelector ||
      '.wp-manga-chapter a, li.wp-manga-chapter a, .chapter-item .chapter a, .li .chapter a, .chapter-link'
    let rows = $(chapterSelector)

    // Ajax fallback
    if (rows.length === 0) {
      const mangaIdNode = $(
        'input.rating-post-id, #manga-chapters-holder, input#manga-id, input[name="manga"]'
      )
      const mangaId = mangaIdNode.attr('value') || mangaIdNode.attr('data-id')

      if (mangaId) {
        console.log(`[MadaraSource] No chapters in HTML, trying AJAX for manga ID: ${mangaId}`)
        const ajaxHeaders = {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest',
          Referer: mangaUrl
        }

        // 1. Standard AJAX
        let ajaxHtml = await this.fetchHtml(`${this.baseUrl}/wp-admin/admin-ajax.php`, {
          method: 'POST',
          headers: ajaxHeaders,
          body: `action=manga_get_chapters&manga=${mangaId}`
        })

        if (ajaxHtml && ajaxHtml.trim().startsWith('{')) {
          try {
            const json = JSON.parse(ajaxHtml)
            if (json.data) ajaxHtml = json.data
            else if (json.html) ajaxHtml = json.html
          } catch (e) {}
        }

        if (ajaxHtml && ajaxHtml.length > 30) {
          console.log(
            `[MadaraSource] Ajax success (manga_get_chapters), length: ${ajaxHtml.length}. First chars: ${ajaxHtml.substring(0, 100).replace(/\n/g, '')}...`
          )
          $ = cheerio.load(ajaxHtml)
          rows = $(chapterSelector)
          console.log(`[MadaraSource] Found ${rows.length} rows with selector: ${chapterSelector}`)
        }

        // 2. Alternative Action Fallbacks
        if (rows.length === 0) {
          console.log(
            `[MadaraSource] Standard AJAX failed (Rows: ${rows.length}, HTML Length: ${ajaxHtml?.length}), trying alternative actions for ID: ${mangaId}...`
          )
          const fallbacks = [
            `action=manga_get_chapters&manga_id=${mangaId}`,
            `action=ajax_chap&id=${mangaId}`,
            `action=manga_get_chapters&m_id=${mangaId}`
          ]

          for (const body of fallbacks) {
            const res = await this.fetchHtml(`${this.baseUrl}/wp-admin/admin-ajax.php`, {
              method: 'POST',
              headers: ajaxHeaders,
              body
            })
            if (res && res.length > 50) {
              console.log(
                `[MadaraSource] Fallback AJAX success (${body.split('&')[0]}), length: ${res.length}. Parsing...`
              )
              $ = cheerio.load(res)
              rows = $(chapterSelector)
              if (rows.length > 0) {
                console.log(
                  `[MadaraSource] Success on fallback (${body.split('&')[0]}) with ${rows.length} chapters!`
                )
                break
              }
            } else {
              console.log(
                `[MadaraSource] Fallback AJAX failed or short (${body.split('&')[0]}), res: ${res?.substring(0, 50).replace(/\n/g, '')}...`
              )
            }
          }
        }

        // 3. Slug-based AJAX (Common in modern high-security Madara sites like 3asq)
        if (rows.length === 0) {
          const slugAjaxUrl = mangaUrl.endsWith('/')
            ? `${mangaUrl}ajax/chapters/`
            : `${mangaUrl}/ajax/chapters/`
          console.log(`[MadaraSource] Admin AJAX all failed, trying Slug AJAX: ${slugAjaxUrl}`)

          // Try POST first
          let sRes = await this.fetchHtml(slugAjaxUrl, { method: 'POST', headers: ajaxHeaders })
          // fallback to GET
          if (!sRes || sRes.length < 50) {
            sRes = await this.fetchHtml(slugAjaxUrl, { method: 'GET', headers: ajaxHeaders })
          }

          if (sRes && sRes.length > 50) {
            console.log(`[MadaraSource] Slug AJAX success, length: ${sRes.length}. Parsing...`)
            $ = cheerio.load(sRes)
            rows = $(chapterSelector)
            console.log(`[MadaraSource] Slug AJAX found ${rows.length} chapters!`)
          }
        }
      } else {
        console.warn(
          `[MadaraSource] Could not find manga ID in HTML for ${mangaUrl}. Holders checked: input.rating-post-id, #manga-chapters-holder, etc.`
        )
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
        dateStr =
          container.find('.post-on a').attr('title') ||
          container.find('.chapter-release-date a').attr('title') ||
          ''
      }

      if (url) {
        chapters.push({
          id: url,
          title,
          url,
          number: parseFloat(numStr) || rows.length - i,
          date: dateStr || undefined
        })
      }
    })

    return chapters
  }

  async fetchPages(chapterUrl: string): Promise<string[]> {
    const html = await this.fetchHtml(chapterUrl)
    if (!html) {
      console.warn(`[MadaraSource] Empty HTML for pages: ${chapterUrl}`)
      return []
    }
    const $ = cheerio.load(html)
    const pages: string[] = []

    $('.page-break img, .reading-content img, .wp-manga-chapter-img img').each((_, el) => {
      const src =
        $(el).attr('src') ||
        $(el).attr('data-src') ||
        $(el).attr('data-lazy-src') ||
        $(el).attr('data-cdn')
      if (src && src.trim() && !src.includes('data:image')) {
        pages.push(src.trim())
      }
    })

    return pages
  }

  public async fetchAjaxPagination(page: number, extraArgs: FetchOptions = {}): Promise<MangaPage> {
    const body = new URLSearchParams()
    body.append('action', 'madara_load_more')
    body.append('page', (page - 1).toString()) // Madara AJAX usually expects 0-indexed or previous page

    for (const [key, value] of Object.entries(extraArgs)) {
      body.append(key, value as string)
    }

    const html = await this.fetchHtml(`${this.baseUrl}/wp-admin/admin-ajax.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    })

    if (!html) return { manga: [], hasNextPage: false }
    const $ = cheerio.load(html)
    const manga = this.parseMangaItems($)
    return { manga, hasNextPage: manga.length > 0 }
  }
}
