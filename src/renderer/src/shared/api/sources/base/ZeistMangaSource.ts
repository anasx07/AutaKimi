import { DataService } from '@renderer/shared/api'
import * as cheerio from 'cheerio'
import { ISourceAdapter, Manga, Chapter, MangaPage } from '../types'

export class ZeistMangaSource implements ISourceAdapter {
  public theme: string = 'zeistmanga'
  public mediaType: 'manga' | 'anime' = 'manga'

  constructor(
    public id: string,
    public name: string,
    public version: string,
    public baseUrl: string,
    public lang: string = 'en',
    public icon: string = '',
    public nsfw: boolean = false
  ) {}

  protected async fetchApi(endpoint: string): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`
    const res: any = await DataService.fetchText(url)
    if (!res || !res.ok || !res.data) return null
    try {
      return JSON.parse(res.data)
    } catch (e) {
      return null
    }
  }

  async fetchPopular(_page: number): Promise<MangaPage> {
    const res: any = await DataService.fetchText(this.baseUrl, { bypassCf: true })
    if (!res || !res.ok || !res.data) return { manga: [], hasNextPage: false }

    const $ = cheerio.load(res.data)
    const manga: Manga[] = []

    $('div.PopularPosts div.grid > figure').each((_, el) => {
       const img = $(el).find('img').attr('src')
       const a = $(el).find('figcaption > a')
       const url = a.attr('href') || ''

       if (url) {
           manga.push({
               id: url.split('/').filter(Boolean).pop()?.replace('.html', '') || url,
               title: a.text().trim(),
               url: url.startsWith('http') ? url : `${this.baseUrl}${url}`,
               coverUrl: img || ''
           })
       }
    })

    return { manga, hasNextPage: false }
  }

  async fetchLatest(page: number): Promise<MangaPage> {
     const startIndex = 20 * (page - 1) + 1
     const data = await this.fetchApi(`/feeds/posts/default/-/Series?alt=json&orderby=published&start-index=${startIndex}&max-results=21`)
     return this.parseBloggerFeed(data)
  }

  async searchManga(query: string, page: number): Promise<MangaPage> {
      const startIndex = 20 * (page - 1) + 1
      const q = query ? `label:Series+${encodeURIComponent(query)}` : 'Series'
      const data = await this.fetchApi(`/feeds/posts/default/-/${q}?alt=json&start-index=${startIndex}&max-results=21`)
      return this.parseBloggerFeed(data)
  }

  private parseBloggerFeed(data: any): MangaPage {
      if (!data || !data.feed || !data.feed.entry) return { manga: [], hasNextPage: false }

      const entries = data.feed.entry;
      const manga: Manga[] = entries.map((entry: any) => {
          const urlLink = entry.link?.find((l: any) => l.rel === 'alternate')?.href || ''
          const title = entry.title?.$t || ''
          const coverUrl = entry.media$thumbnail?.url?.replace(/\/s72-c\//, '/s1600/') || '' // Upscale Blogger thumbs

          return {
              id: urlLink.split('/').filter(Boolean).pop()?.replace('.html', '') || urlLink,
              title: title.trim(),
              url: urlLink,
              coverUrl
          }
      })

      const hasNextPage = entries.length > 20
      if (hasNextPage) manga.pop() // remove lookahead element

      return { manga, hasNextPage }
  }

  async fetchMangaDetails(manga: Manga): Promise<Manga> {
      const res: any = await DataService.fetchText(manga.url || '', { bypassCf: true })
      if (!res || !res.ok || !res.data) return manga

      const $ = cheerio.load(res.data)
      const box = $('.grid.gtc-235fr').first()

      if (box.length) {
          const description = box.find('#synopsis').text().trim()
          const genres: string[] = []
          box.find('div.mt-15 > a[rel=tag]').each((_, el) => { genres.push($(el).text()) })

          return {
              ...manga,
              description,
              genres,
              author: box.find('span#author').text().trim(),
              artist: box.find('span#artist').text().trim(),
              status: box.find('span[data-status]').text().trim() || manga.status
          }
      }

      return manga
  }

  async fetchChapters(mangaUrl: string): Promise<Chapter[]> {
      const res: any = await DataService.fetchText(mangaUrl, { bypassCf: true })
      if (!res || !res.ok || !res.data) return []

      const $ = cheerio.load(res.data)
      const scriptHtml = $('script').map((_, s) => $(s).html() || '').get().join('\n')

      const feedMatch = scriptHtml.match(/clwd\.run\((?:"|')(.*?)(?:"|')\)/) || scriptHtml.match(/label\s*=\s*'(.*?)'/)
      const feed = feedMatch ? feedMatch[1] : 'Chapter'

      // Check Blogger Chapter Feed Index
      const label = encodeURIComponent(feed === 'Chapter' ? 'Chapter' : feed)
      const data = await this.fetchApi(`/feeds/posts/default/-/${label}?alt=json&max-results=999999`)

      if (!data || !data.feed || !data.feed.entry) return []

      return data.feed.entry.map((entry: any) => {
          const urlLink = entry.link?.find((l: any) => l.rel === 'alternate')?.href || ''
          const title = entry.title?.$t || ''

          return {
              id: urlLink,
              title: title.trim(),
              url: urlLink,
              number: parseFloat(title.replace(/[^\d.]/g, '')) || 1,
              date: entry.published?.$t
          }
      })
  }

  async fetchPages(chapterUrl: string): Promise<string[]> {
      const res: any = await DataService.fetchText(chapterUrl.split('#')[0], { bypassCf: true })
      if (!res || !res.ok || !res.data) return []

      const $ = cheerio.load(res.data)
      const pages: string[] = []

      $('div.check-box div.separator img[src]').each((_, el) => {
          const src = $(el).attr('src')
          if (src) pages.push(src.replace(/ /g, '%20'))
      })

      return pages
  }
}
