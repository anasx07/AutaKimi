import { DataService } from '@renderer/shared/api'
import { ISourceAdapter, Manga, Chapter, MangaPage, FetchOptions } from '../../sources/types'

/**
 * Base class for anime streaming sources.
 * Treats anime series like "manga" and episodes like "chapters".
 * `fetchPages(episodeUrl)` returns streaming iframe URLs instead of image URLs.
 */
export abstract class AnimeSource implements ISourceAdapter {
  public theme: string = 'anime'
  public mediaType: 'manga' | 'anime' = 'anime'

  constructor(
    public id: string,
    public name: string,
    public version: string,
    public baseUrl: string,
    public lang: string,
    public icon: string,
    public nsfw: boolean = false
  ) {}

  protected isCfChallengePage(html: string): boolean {
    if (typeof html !== 'string' || !html) return false
    const lower = html.toLowerCase()
    return (
      (lower.includes('cf_chl') ||
        lower.includes('challenges.cloudflare.com') ||
        lower.includes('verifying you are human') ||
        lower.includes('jschl') ||
        lower.includes('__cf_chl')) &&
      !lower.includes('success!') &&
      !lower.includes('verified!')
    )
  }

  protected async fetchHtml(url: string, options: FetchOptions = {}): Promise<string> {
    if (!url) {
      console.warn(`[${this.name}] Cannot fetch undefined or empty URL`)
      return ''
    }

    const chromeVersion = navigator.userAgent.match(/Chrome\/(\d+)/)?.[1] || '130'
    const defaultHeaders = {
      'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion}.0.0.0 Safari/537.36`,
      Referer: this.baseUrl.endsWith('/') ? this.baseUrl : `${this.baseUrl}/`,
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
      'Cache-Control': 'no-cache'
    }

    const res: any = await DataService.fetchText(url, {
      ...options,
      bypassCf: true,
      headers: { ...defaultHeaders, ...options.headers }
    })

    const html = res && typeof res.data === 'string' ? res.data : ''

    const isBlocked =
      !res || res.status === 403 || res.status === 503 || this.isCfChallengePage(html)

    if (isBlocked) {
      console.warn(
        `[${this.name}] Blocked (Status: ${res?.status || 'Unknown'}). HTML Length: ${html?.length || 0}. Trying browser fetch for ${url}...`
      )
      try {
        const browserHtml = await DataService.cfFetchHtml(url)
        if (browserHtml && !this.isCfChallengePage(browserHtml)) {
          console.log(`[${this.name}] Browser fetch SUCCESS for ${url}`)
          return browserHtml
        }
      } catch (e) {
        console.warn(`[${this.name}] cfFetchHtml failed for ${url}:`, e)
      }
    }

    if (!html && !options.silent) {
      console.warn(`[${this.name}] Fetch FAILED (Status: ${res?.status || 'Error'}) for ${url}`)
    } else if (html.length < 500 && !options.silent) {
      console.warn(
        `[${this.name}] Fetch returned suspicious small HTML (${html.length} bytes) for ${url}`
      )
    }

    return html
  }

  /**
   * Returns human-readable labels for the feeds (popular, latest, search).
   * Subclasses can override this to provide more specific names (e.g. "Series" instead of "Popular").
   */
  getFeedLabels(): Record<string, string> {
    return {
      popular: 'Popular',
      latest: 'Latest',
      search: 'Search'
    }
  }

  abstract fetchPopular(page: number, extraArgs?: FetchOptions): Promise<MangaPage>
  abstract fetchLatest(page: number, extraArgs?: FetchOptions): Promise<MangaPage>
  abstract searchManga(query: string, page: number, extraArgs?: FetchOptions): Promise<MangaPage>
  abstract fetchMangaDetails(manga: Manga): Promise<Manga>
  abstract fetchChapters(mangaUrl: string): Promise<Chapter[]>
  /**
   * For anime, this returns streaming iframe URLs (not image URLs).
   * The AnimePage will open these in the internal browser.
   */
  abstract fetchPages(episodeUrl: string): Promise<string[] | any>
}
