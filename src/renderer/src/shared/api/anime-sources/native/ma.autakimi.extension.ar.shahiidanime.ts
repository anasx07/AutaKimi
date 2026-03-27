import { AnimeSource } from '../base/AnimeSource'
import { Manga, MangaPage, Chapter } from '../../sources/types'
import * as cheerio from 'cheerio'

/**
 * ShahiidAnime source adapter for https://shahiid-anime.net/
 *
 * Site structure:
 *   Series list   → /series/page/{n}/     (grid of anime with .listupd .bs cards)
 *   Series detail → /series/{slug}/        (cover, description, genres, season links)
 *   Season detail → /seasons/{slug}/       (list of episodes for a season)
 *   Episode page  → /episodes/{slug}/      (iframe-based video player)
 *
 * We flatten Seasons into the "chapters" list so each season becomes a group of chapters.
 */
export class ShahiidAnimeSource extends AnimeSource {
  constructor() {
    super(
      'ma.autakimi.extension.ar.shahiidanime',
      'Shahiid Anime',
      '0.0.1',
      'https://shahiid-anime.net',
      'ar',
      'ma.autakimi.extension.ar.shahiidanime',
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
    // The site's /series/ page sorts by popularity by default
    const url = `${this.baseUrl}/series/page/${page}/`
    return this._parseAnimeList(url)
  }

  async fetchLatest(page: number): Promise<MangaPage> {
    // Latest episodes added section
    const url = `${this.baseUrl}/series/page/${page}/?order=latest`
    const result = await this._parseAnimeList(url)
    if (result.manga.length === 0) {
      // Fallback: same as popular if no order param
      return this._parseAnimeList(`${this.baseUrl}/series/page/${page}/`)
    }
    return result
  }

  async searchManga(query: string, page: number): Promise<MangaPage> {
    if (!query) return this.fetchPopular(page)
    const url = `${this.baseUrl}/page/${page}/?s=${encodeURIComponent(query)}`
    return this._parseAnimeList(url)
  }

  private async _parseAnimeList(url: string): Promise<MangaPage> {
    const html = await this.fetchHtml(url)
    if (!html) return { manga: [], hasNextPage: false }

    const $ = cheerio.load(html)
    const manga: Manga[] = []

    // Primary: .one-poster (Custom theme), .listupd .bs (Madara fallback), .box-item
    $('.one-poster, .listupd .bs, .listupd .bsx, article.box-item, .item.anime, .item.series').each((_, el) => {
      const node = $(el)
      const a = node.find('a').first()
      const href = a.attr('href')
      if (!href) return

      // Resolve to absolute URL
      const seriesUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`
      let title = (
        node.find('h2 a, .tt, .title, a[title], h3').first().text().trim() ||
        a.attr('title') ||
        ''
      ).replace(/\s+/g, ' ')
      
      // Clean up common Arabic suffixes
      title = title
        .replace(/مترجمة اون لاين/g, '')
        .replace(/جميع حلقات انمي/g, '')
        .replace(/مترجم اون لاين/g, '')
        .replace(/انمي/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        
      if (!title) return

      const imgEl = node.find('img').first()
      const cover = (
        imgEl.attr('src') ||
        imgEl.attr('data-src') ||
        imgEl.attr('data-lazy-src') ||
        ''
      )

      // Type badge or Rating
      const typeBadge = (node.find('.typez, .type, span.Type, .rated-poster, .status-poster').first().text().trim() || 'TV').replace(/\s+/g, ' ')
      const score = node.find('.numscore, .rate, .rating, .rated-poster').first().text().trim()
      
      manga.push({
        id: seriesUrl,
        title,
        coverUrl: cover,
        url: seriesUrl,
        status: score ? `${typeBadge} • ${score}`.replace(' •  • ', ' • ') : typeBadge,
        author: '',
        artist: '',
        description: '',
        genres: [],
        mediaType: 'anime'
      })
    })

    // Detect next page
    const hasNextPage = $('.nextpostslink, a.next, .next.page-numbers, .nav-next a, .pagination .next').length > 0

    return { manga, hasNextPage }
  }

  // ─── Series Detail ───────────────────────────────────────────────────────────

  async fetchMangaDetails(manga: Manga): Promise<Manga> {
    const html = await this.fetchHtml(manga.url || '')
    if (!html) return manga

    const $ = cheerio.load(html)

    // Title
    let title = $('.SeriesSide h1, h1').first().text().trim()
    if (title) {
      title = title
        .replace(/مترجمة اون لاين/g, '')
        .replace(/جميع حلقات انمي/g, '')
        .replace(/مترجم اون لاين/g, '')
        .replace(/انمي/g, '')
        .replace(/\s+/g, ' ')
        .trim()
    }
    title = title || manga.title

    // Cover — prefer the large image in series header
    let coverUrl = manga.coverUrl
    const coverImg = $('.head-post img, .thumb img, .seriesthumbnail img').first()
    const newCover = coverImg.attr('src') || coverImg.attr('data-src') || ''
    if (newCover) coverUrl = newCover

    // Description
    const description = (
      $('.entry-content p, .desc p, .synops p, .SeriesInfo p').first().text().trim() ||
      $('.entry-content, .desc, .synops').first().text().trim() ||
      ''
    )

    // Genres
    const genres: string[] = []
    $('a[href*="/series-cats/"], a[href*="/genre/"], .gen-links a, .seriestugenre a').each((_, el) => {
      const g = $(el).text().trim()
      if (g && !genres.includes(g)) genres.push(g)
    })

    // Status
    let status = manga.status || ''
    $('div, span').each((_, el) => {
      const text = $(el).text()
      if (text.includes('حالة الأنيمي') || text.includes('حالة الانمي')) {
        const val = $(el).find('a, span').first().text().trim() ||
          text.replace(/حالة الأنيمي|حالة الانمي|:/g, '').trim()
        if (val) status = val
      }
    })

    return {
      ...manga,
      title,
      coverUrl,
      description,
      genres,
      status: status || manga.status || 'Unknown'
    }
  }

  // ─── Episodes (Chapters) ─────────────────────────────────────────────────────

  /**
   * fetches all episodes across all seasons for the given series URL.
   * Strategy:
   *   1. Extract Series ID (Post ID) from body class.
   *   2. Search for season links on the series page.
   *   3. If no season found, try fallback aggregator URL (?serie=ID).
   *   4. Flatten all episodes from all seasons.
   */
  async fetchChapters(mangaUrl: string): Promise<Chapter[]> {
    const html = await this.fetchHtml(mangaUrl)
    if (!html) return []

    const $ = cheerio.load(html)
    const allChapters: Chapter[] = []

    // ── 1. Extract Series ID (Post ID) ──
    let seriesId: string | null = null

    // a. From body class (standard WP)
    const bodyClass = $('body').attr('class') || ''
    const postIdMatch = bodyClass.match(/postid-(\d+)/)
    if (postIdMatch) seriesId = postIdMatch[1]

    // b. From shortlink in head or inputs
    if (!seriesId) {
      const shortlink = $('link[rel="shortlink"]').attr('href') || 
                       $('input#shortlink, .shortlink-input').val() as string || ''
      const pMatch = shortlink.match(/[?&]p=(\d+)/)
      if (pMatch) seriesId = pMatch[1]
    }

    // c. From "رقم المسلسل" (Series Number) text label
    if (!seriesId) {
      $('.info-content, .sidebar, .series-info, div').each((_, el) => {
        const text = $(el).text()
        if (text.includes('رقم المسلسل')) {
          const match = text.match(/(\d+)/)
          if (match) {
            seriesId = match[1]
            return false // break each
          }
        }
        return true
      })
    }

    // ── 2. Collect season links from the series page ──
    const seasonUrls: string[] = []

    // Try to find season links on the series page
    $(`a[href*="/seasons/"], 
       .seasons-list a, 
       .mseason a, 
       .series-seasons a,
       a:contains("الموسم")`
    ).each((_, el) => {
      const href = $(el).attr('href') || ''
      if (!href) return
      const seasonUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`
      
      // Filter out utility links like ?serie= or search links
      if (seasonUrl.includes('?serie=') || seasonUrl.includes('?s=')) return

      if (!seasonUrls.includes(seasonUrl)) seasonUrls.push(seasonUrl)
    })

    // ── 3. Fallback: If no season links found but we have a seriesId, try the aggregator URL ──
    if (seasonUrls.length === 0 && seriesId) {
      const aggregatorUrl = `${this.baseUrl}/seasons/?serie=${seriesId}`
      const aggregatorHtml = await this.fetchHtml(aggregatorUrl)
      if (aggregatorHtml) {
        const $agg = cheerio.load(aggregatorHtml)
        $agg('a[href*="/seasons/"], .listupd a, .bs a').each((_, el) => {
          const href = $agg(el).attr('href') || ''
          if (!href) return
          const seasonUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`
          if (!seasonUrls.includes(seasonUrl)) seasonUrls.push(seasonUrl)
        })
      }
    }

    // ── 4. Direct Episode Search (if no seasons or as a secondary check) ──
    const directEpisodeLinks: string[] = []
    $(`a[href*="/episodes/"], 
       a[href*="/episodesDubbed/"],
       .episodelist a,
       .eplister a`
    ).each((_, el) => {
      const href = $(el).attr('href') || ''
      if (href && !directEpisodeLinks.includes(href) && (href.includes('/episodes/') || href.includes('/episodesDubbed/'))) {
        directEpisodeLinks.push(href)
      }
    })

    if (seasonUrls.length === 0 && directEpisodeLinks.length === 0) {
      console.warn(`[ShahiidAnime] No seasons or episodes found at ${mangaUrl} (ID: ${seriesId})`)
      return []
    }

    // ── 5. Fetch episodes from each season ──
    if (seasonUrls.length > 0) {
      let globalIndex = 0
      for (const seasonUrl of seasonUrls) {
        const seasonChapters = await this._fetchSeasonEpisodes(seasonUrl, globalIndex)
        globalIndex += seasonChapters.length
        allChapters.push(...seasonChapters)
        // Rate limit between seasons
        await new Promise(resolve => setTimeout(resolve, 300))
      }
    }

    // ── 6. Fallback to direct links if seasons yielded nothing ──
    if (allChapters.length === 0 && directEpisodeLinks.length > 0) {
      directEpisodeLinks.forEach((href, i) => {
        const epUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`
        const titleEl = $(`a[href="${href}"]`).first()
        const title = titleEl.attr('title') || titleEl.text().trim() || `Episode ${i + 1}`
        const numStr = title.match(/\d+/)?.[0] || String(i + 1)
        allChapters.push({
          id: epUrl,
          title,
          url: epUrl,
          number: parseFloat(numStr) || (i + 1)
        })
      })
    }

    // Final deduplication and sort
    const finalChapters = Array.from(new Map(allChapters.map(c => [c.id, c])).values())
    finalChapters.sort((a, b) => b.number - a.number) // Default to Newest first
    return finalChapters
  }

  private async _fetchSeasonEpisodes(seasonUrl: string, startIndex = 0): Promise<Chapter[]> {
    const allChapters: Chapter[] = []
    let currentUrl: string | null = seasonUrl
    let pageCount = 0

    while (currentUrl && pageCount < 15) { // Safety limit of 15 pages (~315 episodes per season)
      const html = await this.fetchHtml(currentUrl)
      if (!html) break

      const $ = cheerio.load(html)
      const pageChapters: Chapter[] = []
      const seasonTitle = $('h1.entry-title, h1.seriestitle, h1').first().text().trim()

      $(`.episodelist a, .eplister a, .epAll a, .listupd a, .bs a, li a[href*="/episodes/"], li a[href*="/episodesDubbed/"], .episodelist-series a`)
        .each((_, el) => {
          const href = $(el).attr('href') || ''
          if (!href || (!href.includes('/episodes/') && !href.includes('/episodesDubbed/'))) return

          // Skip duplicate/download links
          if ($(el).hasClass('dlBtn') || $(el).text().includes('تحميل')) return

          const epUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`
          if (pageChapters.find(c => c.url === epUrl) || allChapters.find(c => c.url === epUrl)) return

          const rawTitle = $(el).attr('title') || $(el).find('.epl-title, .epl-num').text().trim() || $(el).text().trim() || ''
          const urlSlug = href.split('/').filter(Boolean).pop() || ''
          const numMatch = rawTitle.match(/(?:الحلقة|حلقة|ep|episode)\s*(\d+)/i) || rawTitle.match(/(\d+)/) || urlSlug.match(/(\d+)/)
          
          // Use a combination of start index and count if no number found
          const num = numMatch ? parseFloat(numMatch[1]) : (startIndex + allChapters.length + pageChapters.length + 1)
          const title = rawTitle || (seasonTitle ? `${seasonTitle} - الحلقة ${num}` : `Episode ${num}`)
          const dateStr = $(el).closest('li, article, .epRow').find('.date, .epl-date, time').text().trim()

          pageChapters.push({
            id: epUrl,
            title,
            url: epUrl,
            number: num,
            date: dateStr || undefined
          })
        })

      allChapters.push(...pageChapters)

      // Pagination check
      const nextA = $('.nextpostslink, a.next, .next.page-numbers, .nav-next a').first()
      const nextHref = nextA.attr('href')
      if (nextHref && nextHref !== currentUrl && nextHref !== seasonUrl) {
        currentUrl = nextHref.startsWith('http') ? nextHref : `${this.baseUrl}${nextHref}`
        pageCount++
        // Rate limit between pages to avoid blocking
        await new Promise(resolve => setTimeout(resolve, 500))
      } else {
        currentUrl = null
      }
    }

    // Sort ascending by number for this specific season
    allChapters.sort((a, b) => a.number - b.number)
    return allChapters
  }

  // ─── Episode Streaming URLs ───────────────────────────────────────────────────

  /**
   * Returns iframe/streaming URLs from the episode page.
   * The AnimePage will open the first URL in the internal browser.
   */
  async fetchPages(episodeUrl: string): Promise<string[]> {
    const html = await this.fetchHtml(episodeUrl)
    const servers = this._extractIframes(html, episodeUrl)
    return servers
  }

  private _extractIframes(html: string, episodeUrl: string): any[] {
    if (!html) return []

    const $ = cheerio.load(html)
    const servers: any[] = []
    const seenUrls = new Set<string>()

    const getProvider = (url: string) => {
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
      if (lUrl.includes('fembed')) return 'Fembed'
      if (lUrl.includes('streamtape')) return 'Streamtape'
      return 'Server'
    }

    // Primary: find iframes inside the player containers
    const playerSelectors = [
      '#player iframe',
      '.player iframe',
      '.video-content iframe',
      '.video-embed iframe',
      '.entry-content iframe',
      'div[class*="player"] iframe',
      'div[class*="embed"] iframe',
      'iframe[src*="shahiid"]',
      'iframe[src*="mega"],iframe[src*="stream"],iframe[src*="embed"]',
      'iframe'
    ]

    for (const sel of playerSelectors) {
      $(sel).each((_, el) => {
        let src = $(el).attr('src') || $(el).attr('data-src') || ''
        if (src && src.startsWith('http')) {
          // Auto-play support for common providers
          if (src.includes('vidmoly') || src.includes('sibnet') || src.includes('uqload') || src.includes('mp4upload') || src.includes('sendvid')) {
            src = src.includes('?') ? `${src}&autoplay=1` : `${src}?autoplay=1`
          }

          if (!seenUrls.has(src)) {
            seenUrls.add(src)
            servers.push({ name: getProvider(src), url: src })
          }
        }
      })
      if (servers.length > 0) break
    }

    // Fallback: look for server tab buttons
    if (servers.length === 0) {
      $('.buttosn, .ServerAll a, .ServerLinksTop a, [data-src], [data-embed]').each((_, el) => {
        const src = ($(el).attr('data-src') || $(el).attr('data-embed') || $(el).attr('href') || '').trim()
        if (src && src.startsWith('http') && !seenUrls.has(src)) {
          seenUrls.add(src)
          servers.push({ name: getProvider(src), url: src })
        }
      })
    }

    // Last resort: return the episode page URL itself
    if (servers.length === 0) {
      servers.push({ name: 'Direct', url: episodeUrl })
    }

    return servers
  }
}
