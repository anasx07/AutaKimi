import { DataService } from '@renderer/shared/api'
import * as cheerio from 'cheerio'
import { ISourceAdapter, Manga, Chapter, MangaPage } from '../types'

export class IkenSource implements ISourceAdapter {
  public theme: string = 'iken'
  public mediaType: 'manga' | 'anime' = 'manga'

  constructor(
    public id: string,
    public name: string,
    public version: string,
    public baseUrl: string,
    public apiUrl: string,
    public lang: string = 'ar',
    public icon: string = '',
    public nsfw: boolean = false
  ) {}

  protected async fetchApi(endpoint: string): Promise<any> {
    const url = endpoint.startsWith('http') ? endpoint : `${this.apiUrl}${endpoint}`
    const headers: Record<string, string> = {
      Referer: `${this.baseUrl}/`,
      Accept: 'application/json, text/plain, */*'
    }

    const res: any = await DataService.fetchText(url, { headers })
    if (!res || !res.ok) return null

    try {
      return JSON.parse(res.data)
    } catch (e) {
      return null
    }
  }

  async fetchPopular(page: number): Promise<MangaPage> {
    const data = await this.fetchApi(
      `/api/query?page=${page}&perPage=18&searchTerm=&seriesStatus=&seriesType=&orderBy=totalViews&orderDirection=desc`
    )
    return this.parseMangaPage(data)
  }

  async fetchLatest(page: number): Promise<MangaPage> {
    const data = await this.fetchApi(
      `/api/query?page=${page}&perPage=18&searchTerm=&seriesStatus=&seriesType=&orderBy=lastChapterAddedAt&orderDirection=desc`
    )
    return this.parseMangaPage(data)
  }

  async searchManga(query: string, page: number): Promise<MangaPage> {
    const data = await this.fetchApi(
      `/api/query?page=${page}&perPage=18&searchTerm=${encodeURIComponent(query)}&seriesStatus=&seriesType=&orderBy=lastChapterAddedAt&orderDirection=desc`
    )
    return this.parseMangaPage(data)
  }

  private parseMangaPage(data: any): MangaPage {
    if (!data || !data.posts) return { manga: [], hasNextPage: false }

    const manga: Manga[] = data.posts
      .filter((p: any) => !p.isNovel)
      .map((p: any) => ({
        id: String(p.id),
        title: p.postTitle,
        coverUrl: p.featuredImage,
        url: `${this.baseUrl}/series/${p.slug}`,
        status: p.seriesStatus || 'Unknown'
      }))

    const hasNextPage = data.totalCount > data.posts.length + (data.page ? (data.page - 1) * 18 : 0)
    return { manga, hasNextPage: !!hasNextPage }
  }

  async fetchMangaDetails(manga: Manga): Promise<Manga> {
    const res: any = await DataService.fetchText(manga.url || '', { bypassCf: true })
    if (!res || !res.ok || !res.data) return manga

    const $ = cheerio.load(res.data)
    const nextDataStr = $('#__NEXT_DATA__').html()
    if (!nextDataStr) return manga

    try {
      const nextData = JSON.parse(nextDataStr)
      const props = nextData.props?.pageProps
      const mangaData = props?.post || props?.manga || props?.data

      if (mangaData) {
        return {
          ...manga,
          id: String(mangaData.id || manga.id),
          description:
            mangaData.postContent?.replace(/<br>/g, '\n').replace(/<\/?[^>]+(>|$)/g, '') || '',
          genres: mangaData.genres?.map((g: any) => g.name || '').filter(Boolean) || [],
          status: mangaData.seriesStatus || manga.status,
          author: mangaData.author || undefined,
          artist: mangaData.artist || undefined
        }
      }
    } catch (e) {
      console.warn('[IkenSource] Failed to parse NEXT_DATA for details')
    }

    return manga
  }

  async fetchChapters(mangaUrl: string): Promise<Chapter[]> {
    const res: any = await DataService.fetchText(mangaUrl, { bypassCf: true })
    if (!res || !res.ok || !res.data) return []

    const $ = cheerio.load(res.data)
    const nextDataStr = $('#__NEXT_DATA__').html()
    if (!nextDataStr) return []

    try {
      const nextData = JSON.parse(nextDataStr)
      const props = nextData.props?.pageProps
      const chapters = props?.post?.chapters || props?.chapters

      if (chapters && Array.isArray(chapters)) {
        return chapters.map((c: any) => ({
          id: String(c.id),
          title: `Chapter ${c.number}`,
          url: `${this.baseUrl}/series/${props?.post?.slug || c.slug}/${c.slug}#${c.id}`,
          number: parseFloat(c.number) || 0,
          date: c.createdAt
        }))
      }
    } catch (e) {}

    return []
  }

  async fetchPages(chapterUrl: string): Promise<string[]> {
    const res: any = await DataService.fetchText(chapterUrl.split('#')[0], { bypassCf: true })
    if (!res || !res.ok || !res.data) return []

    const $ = cheerio.load(res.data)
    const nextDataStr = $('#__NEXT_DATA__').html()
    if (!nextDataStr) return []

    try {
      const nextData = JSON.parse(nextDataStr)
      const props = nextData.props?.pageProps
      const images = props?.data?.images || props?.images?.images

      if (images && Array.isArray(images)) {
        return images.map((img: any) => img.url?.replace(/ /g, '%20')).filter(Boolean)
      }
    } catch (e) {}

    return []
  }
}
