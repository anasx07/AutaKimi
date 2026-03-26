import { AnimeSource } from '../base/AnimeSource'
import { Manga, MangaPage, Chapter } from '../../sources/types'
import * as cheerio from 'cheerio'

/**
 * RistoAnime source adapter for https://ristoanime.co/
 */
export class RistoAnimeSource extends AnimeSource {
  constructor() {
    super(
      'ma.lmanwa.extension.ar.ristoanime',
      'RistoAnime',
      '0.0.1',
      'https://ristoanime.co',
      'ar',
      'ma.lmanwa.extension.ar.ristoanime',
      false
    )
  }

  override getFeedLabels(): Record<string, string> {
    return {
      popular: 'Series',
      latest: 'Latest Updates',
      search: 'Search'
    }
  }

  // ─── Lists ───────────────────────────────────────────────────────────────────

  async fetchPopular(page: number): Promise<MangaPage> {
    const url = page === 1 ? `${this.baseUrl}/series/` : `${this.baseUrl}/series/?offset=${page}`
    return this._parseAnimeList(url)
  }

  async fetchLatest(page: number): Promise<MangaPage> {
    const url = page === 1 ? this.baseUrl : `${this.baseUrl}/?offset=${page}`
    return this._parseAnimeList(url)
  }

  async searchManga(query: string, page: number): Promise<MangaPage> {
    if (!query) return this.fetchPopular(page)
    const url = page === 1 ? `${this.baseUrl}/?s=${encodeURIComponent(query)}` : `${this.baseUrl}/?s=${encodeURIComponent(query)}&offset=${page}`
    return this._parseAnimeList(url)
  }

  private async _parseAnimeList(url: string): Promise<MangaPage> {
    const html = await this.fetchHtml(url)
    if (!html) return { manga: [], hasNextPage: false }

    const $ = cheerio.load(html)
    const manga: Manga[] = []

    // Broad selector: MovieItem or any 'a' that contains an 'h4' (anime title)
    $('.MovieItem a, a:has(h4), a:has(.title)').each((_, el) => {
      const node = $(el)
      const href = node.attr('href') || ''
      if (!href || href.length < 5 || href === this.baseUrl || 
          href === `${this.baseUrl}/` || href.includes('/genre/') || 
          href.includes('/year/') || href.includes('/watch/')) return

      let seriesUrl = href
      if (!href.startsWith('http')) {
        seriesUrl = href.startsWith('/') ? `${this.baseUrl}${href}` : `${this.baseUrl}/${href}`
      }

      // Target h4 specifically inside the title div to avoid placeholder <p>
      const titleElem = node.find('.title h4, h4, .title').first()
      let title = titleElem.is('h4') ? titleElem.text().trim() : titleElem.find('h4').text().trim()
      
      // Fallback to div text if still empty
      if (!title) title = node.find('.title').text().trim()

      // Clean up common Arabic suffixes/prefixes often found in titles
      title = title
          .replace(/مترجمة اون لاين/g, '')
          .replace(/مترجم اونلاين/g, '')
          .replace(/مترجم اون لاين/g, '')
          .replace(/جميع حلقات انمي/g, '')
          .replace(/انمي/g, '')
          .replace(/\s+/g, ' ')
          .trim()
   
        
      if (!title || title.length < 2) return

      // Cover from any element with background-image style (usually div.poster)
      let cover = ''
      const coverElem = node.find('.poster, [style*="background-image"], .img').first()
      const style = coverElem.attr('style') || ''
      const bgMatch = style.match(/background-image:\s*url\((.*?)\)/)
      if (bgMatch) {
         cover = bgMatch[1].replace(/&quot;/g, '').replace(/['"]/g, '').trim()
      }

      if (!cover) {
        const img = node.find('img').first()
        cover = img.attr('src') || img.attr('data-src') || ''
      }

      const status = node.find('.status, .type, .quality').first().text().trim()

      if (!manga.find(m => m.id === seriesUrl)) {
        manga.push({
          id: seriesUrl,
          title,
          coverUrl: cover,
          url: seriesUrl,
          status: status || 'TV',
          author: '',
          artist: '',
          description: '',
          genres: [],
          mediaType: 'anime'
        })
      }
    })

    const hasNextPage = $('.next, a.next, .pagination .next, .page-numbers.next, a.next.page-numbers, .nav-next a').length > 0
    return { manga, hasNextPage }
  }

  // ─── Series Detail ───────────────────────────────────────────────────────────

  async fetchMangaDetails(manga: Manga): Promise<Manga> {
    const html = await this.fetchHtml(manga.url || '')
    if (!html) return manga

    const $ = cheerio.load(html)

    // Try to get specific title container first
    let title = $('.PostTitle').first().text().trim() || 
                $('.SeriesSide h1').first().text().trim() || 
                $('.anime-title').first().text().trim()

    // If still empty or just the site name, look for any H1 that isn't for the logo
    if (!title || title.toLowerCase() === 'risto' || title.toLowerCase() === 'ristoanime') {
        $('h1').each((_, el) => {
            const t = $(el).text().trim()
            if (t && t.toLowerCase() !== 'risto' && t.toLowerCase() !== 'ristoanime') {
                title = t
                return false // break
            }
            return true
        })
    }

    if (title) {
        // Remove 'انمي' prefix if it exists at the start
        if (title.startsWith('انمي ')) {
            title = title.substring(5).trim()
        }
        
        title = title
          .replace(/مترجمة اون لاين/g, '')
          .replace(/مترجم اونلاين/g, '')
          .replace(/مترجم اون لاين/g, '')
          .replace(/جميع حلقات انمي/g, '')
          .replace(/انمي/g, '')
          .replace(/\s+/g, ' ')
          .trim()
    }
    title = title || manga.title
    const description = $('.StoryLine, .entry-content p, .anime-story, .description').text().trim() || 
                        $('.SeriesSide p').first().text().trim()
    
    const genres: string[] = []
    $('a[href*="/genre/"], .gen-links a').each((_, el) => {
      const g = $(el).text().trim()
      if (g && !genres.includes(g)) genres.push(g)
    })

    let status = manga.status
    $('.SeriesSide li, .anime-info-right li').each((_, el) => {
      const text = $(el).text()
      if (text.includes('الحالة')) {
        status = $(el).find('a, span').text().trim() || text.split(':').pop()?.trim() || status
      }
    })

    return {
      ...manga,
      title,
      description,
      genres,
      status: status || 'Unknown'
    }
  }

  // ─── Episodes ────────────────────────────────────────────────────────────────

  async fetchChapters(mangaUrl: string): Promise<Chapter[]> {
    const html = await this.fetchHtml(mangaUrl)
    if (!html) return []

    const $ = cheerio.load(html)
    const chapters: Chapter[] = []

    $('.EpisodesList a, .episodes-list a, .ep-list a, .episodes a').each((i, el) => {
      const href = $(el).attr('href') || ''
      if (!href) return

      const epUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`
      const numStr = $(el).find('em, span, b').text().trim() || $(el).text().trim().match(/\d+/)?.[0] || String(i + 1)
      const num = parseFloat(numStr) || (i + 1)
      
      chapters.push({
        id: epUrl,
        title: `Episode ${num}`,
        url: epUrl,
        number: num
      })
    })

    return chapters.sort((a, b) => b.number - a.number)
  }

  // ─── Streaming ───────────────────────────────────────────────────────────────

  async fetchPages(episodeUrl: string): Promise<any> {
    // RistoAnime watch URL is usually the episode URL + /watch/
    let watchUrl = episodeUrl.endsWith('/') ? `${episodeUrl}watch/` : `${episodeUrl}/watch/`
    if (episodeUrl.includes('/watch/')) watchUrl = episodeUrl

    // Some sites require the episode page as Referer to allow access to /watch/
    const html = await this.fetchHtml(watchUrl, {
      headers: {
        'Referer': episodeUrl
      }
    })

    const debugInfo = {
        version: '1.0.3-v2',
        url: watchUrl,
        htmlLength: html?.length || 0,
        isBlocked: this.isCfChallengePage(html),
        snippet: html ? html.substring(0, 500) : 'EMPTY'
    }

    if (!html) {
      const epHtml = await this.fetchHtml(episodeUrl)
      return { 
        urls: epHtml ? this._extractIframes(epHtml) : [],
        debug: { ...debugInfo, fallbackUrl: episodeUrl, fallbackHtmlLength: epHtml?.length || 0 }
      }
    }

    return {
        urls: this._extractIframes(html),
        debug: { ...debugInfo, allIframes: this._getAllIframes(html) }
    }
  }

  private _getAllIframes(html: string): string[] {
    const $ = cheerio.load(html)
    const iframes: string[] = []
    $('iframe').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src') || ''
      if (src && !iframes.includes(src)) iframes.push(src)
    })
    return iframes
  }

  private _extractIframes(html: string): any[] {
    const $ = cheerio.load(html)
    const servers: any[] = []
    const seenUrls = new Set<string>()

    const getProvider = (url: string, label?: string) => {
      const lUrl = url.toLowerCase()
      if (lUrl.includes('vidmoly')) return 'Vidmoly'
      if (lUrl.includes('mega.nz')) return 'Mega'
      if (lUrl.includes('mp4upload')) return 'MP4Upload'
      if (lUrl.includes('uqload')) return 'Uqload'
      if (lUrl.includes('voe.sx')) return 'Voe'
      if (lUrl.includes('sendvid')) return 'Sendvid'
      if (lUrl.includes('sibnet')) return 'Sibnet'
      if (lUrl.includes('dood')) return 'DoodStream'
      if (lUrl.includes('ok.ru')) return 'Okru'
      if (lUrl.includes('filemoon')) return 'Filemoon'
      if (lUrl.includes('vidoza')) return 'Vidoza'
      if (lUrl.includes('google') || lUrl.includes('drive')) return 'G-Drive'
      if (lUrl.includes('shared')) return 'Shared'
      if (lUrl.includes('youdrive')) return 'YouDrive'
      
      if (label && label.length > 1 && !label.includes('<')) return label
      return 'Server'
    }
    
    // 1. Primary: RistoAnime uses li[data-watch]
    $('#watch li[data-watch], .ServersList li[data-watch], [data-watch]').each((_, el) => {
      let src = $(el).attr('data-watch')
      if (src) {
        if (src.startsWith('//')) src = `https:${src}`
        
        // Auto-play support for common providers
        if (src.includes('vidmoly') || src.includes('sibnet') || src.includes('uqload') || src.includes('mp4upload') || src.includes('listeamed')) {
          src = src.includes('?') ? `${src}&autoplay=1` : `${src}?autoplay=1`
        }

        if (!seenUrls.has(src)) {
          seenUrls.add(src)
          // Only get direct text nodes, ignore children like <noscript>
          const label = $(el).contents().filter((_, node) => node.nodeType === 3).text()
            .replace(/\s+/g, ' ')
            .replace(/\d+/g, '')
            .replace(/سيرفر/g, '')
            .trim()
          
          servers.push({ name: getProvider(src, label), url: src })
        }
      }
    })

    // 2. Direct iframes in WatchIframe or WatchArea
    $('.WatchIframe iframe, .WatchArea iframe, #watch iframe').each((_, el) => {
      let src = $(el).attr('src') || $(el).attr('data-src') || ''
      if (src) {
        if (src.startsWith('//')) src = `https:${src}`

        // Auto-play support for common providers
        if (src.includes('vidmoly') || src.includes('sibnet') || src.includes('uqload') || src.includes('mp4upload') || src.includes('listeamed')) {
          src = src.includes('?') ? `${src}&autoplay=1` : `${src}?autoplay=1`
        }

        if (src.startsWith('http') && !seenUrls.has(src)) {
          seenUrls.add(src)
          servers.push({ name: getProvider(src), url: src })
        }
      }
    })

    return servers
  }
}
