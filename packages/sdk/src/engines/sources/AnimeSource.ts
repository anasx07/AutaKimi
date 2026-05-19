import { ISourceAdapter, Manga, Chapter, MangaPage, FetchOptions, StreamingServer } from '../../types'
import { networkClient } from '../../services/network'

/**
 * Base class for anime streaming sources.
 * Treats anime series like "manga" and episodes like "chapters".
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

  protected async fetchHtml(url: string, options: FetchOptions = {}): Promise<string> {
    if (!url) return ''

    const defaultHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      Referer: this.baseUrl.endsWith('/') ? this.baseUrl : `${this.baseUrl}/`,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
      'Cache-Control': 'no-cache'
    }

    const res = await networkClient.fetch(url, {
      ...options,
      headers: { ...defaultHeaders, ...options.headers }
    })

    if (!res.ok) {
      if (!options.silent) console.warn(`[${this.name}] Fetch failed for ${url}: ${res.error}`)
      return ''
    }

    return await res.value.text()
  }

  abstract fetchPopular(page: number, extraArgs?: FetchOptions): Promise<MangaPage>
  abstract fetchLatest(page: number, extraArgs?: FetchOptions): Promise<MangaPage>
  abstract searchManga(query: string, page: number, extraArgs?: FetchOptions): Promise<MangaPage>
  abstract fetchMangaDetails(manga: Manga): Promise<Manga>
  abstract fetchChapters(mangaUrl: string): Promise<Chapter[]>
  abstract fetchPages(episodeUrl: string): Promise<string[] | StreamingServer[]>
}
