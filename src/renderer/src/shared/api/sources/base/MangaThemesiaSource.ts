import { DataService } from '@renderer/shared/api'
import * as cheerio from 'cheerio'
import { ISourceAdapter, Manga, Chapter, MangaPage } from '../types'

export class MangaThemesiaSource implements ISourceAdapter {
  public theme: string = 'mangathemesia'
  public mediaType: 'manga' | 'anime' = 'manga'

  constructor(
    public id: string,
    public name: string,
    public version: string,
    public baseUrl: string,
    public lang: string = 'en',
    public icon: string = '',
    public nsfw: boolean = false,
    public customSelectors?: Record<string, string>
  ) {}

  protected async fetchHtml(url: string): Promise<string | null> {
    const opts = {
      bypassCf: true,
      headers: {
        'Referer': `${this.baseUrl}/`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
      }
    }
    const res: any = await DataService.fetchText(url, opts)
    if (res && res.ok) return res.data

    // Cloudflare block: use browser-based extraction (avoids TLS fingerprint mismatch)
    if (res?.status === 403 || !res) {
      console.log(`[MangaThemesiaSource] 403 on ${url}, fetching via browser...`)
      try {
        return await DataService.cfFetchHtml(url)
      } catch (e) {
        console.warn('[MangaThemesiaSource] cfFetchHtml failed:', e)
      }
    }
    return null
  }

  async fetchPopular(page: number): Promise<MangaPage> {
    const url = `${this.baseUrl}/manga/?page=${page}&order=popular`
    return this.parseMangaPage(await this.fetchHtml(url))
  }

  async fetchLatest(page: number): Promise<MangaPage> {
    const url = `${this.baseUrl}/manga/?page=${page}&order=update`
    return this.parseMangaPage(await this.fetchHtml(url))
  }

  async searchManga(query: string, page: number): Promise<MangaPage> {
    const url = `${this.baseUrl}/manga/?title=${encodeURIComponent(query)}&page=${page}`
    return this.parseMangaPage(await this.fetchHtml(url))
  }

  private parseMangaPage(html: string | null): MangaPage {
    if (!html) return { manga: [], hasNextPage: false }
    const $ = cheerio.load(html)
    const manga: Manga[] = []

    const listSelector = this.customSelectors?.searchMangaSelector || '.utao .uta .imgu, .listupd .bs .bsx, .listo .bs .bsx';
    $(listSelector).each((_, el) => {
      const a = $(el).find('a')
      const img = $(el).find('img')
      const titleSelector = this.customSelectors?.searchMangaTitleSelector;
      const title = titleSelector ? $(el).find(titleSelector).text().trim() : (a.attr('title') || img.attr('alt') || '');
      const url = a.attr('href') || ''

      if (url) {
        const id = url.split('/').filter(Boolean).pop() || url;
        const statusText = $(el).find('.status, .v-status').first().text().trim() || 'Unknown';
        const timeText = $(el).find('.time, .v-time, .epxs').first().text().trim() || '';
        const combinedStatus = timeText ? `${statusText} • ${timeText}` : statusText;

        if (!manga.some(item => item.id === id)) {
          manga.push({
            id,
            title,
            url: url.startsWith('http') ? url : `${this.baseUrl}${url}`,
            coverUrl: img.attr('data-src') || img.attr('src') || '',
            status: combinedStatus
          })
        }
      }
    })

    const hasNextPage = $('div.pagination .next, div.hpage .r').length > 0
    return { manga, hasNextPage }
  }

  async fetchMangaDetails(manga: Manga): Promise<Manga> {
    const html = await this.fetchHtml(manga.url || '')
    if (!html) return manga

    const $ = cheerio.load(html)
    const detailsSelector = this.customSelectors?.seriesDetailsSelector || 'div.bigcontent, div.animefull, div.main-info, div.postbody';
    const box = $(detailsSelector).first()

    if (box.length) {
      const titleSelector = this.customSelectors?.seriesTitleSelector || 'h1.entry-title';
      const descSelector = this.customSelectors?.seriesDescriptionSelector || '.desc, .entry-content[itemprop=description]';
      const coverSelector = this.customSelectors?.seriesThumbnailSelector || '.infomanga > div[itemprop=image] img, .thumb img';
      const genreSelector = this.customSelectors?.seriesGenreSelector || 'div.gnr a, .mgen a, .seriestugenre a';

      const description = box.find(descSelector).text().trim()
      const title = box.find(titleSelector).text().trim() || manga.title
      const coverUrl = getImgAttr(box.find(coverSelector))
      const genres: string[] = []
      box.find(genreSelector).each((_, el) => { genres.push($(el).text()) })

      return {
        ...manga,
        title,
        description,
        coverUrl: coverUrl || manga.coverUrl,
        genres,
        status: box.find('.tsinfo .imptdt:contains(status) i, .fmed b:contains(status)+span').text() || manga.status
      }
    }

    return manga
  }

  async fetchChapters(mangaUrl: string): Promise<Chapter[]> {
    const html = await this.fetchHtml(mangaUrl)
    if (!html) return []

    const $ = cheerio.load(html)
    const chapters: Chapter[] = []

    const chapterSelector = this.customSelectors?.chapterListSelector || 'div.bxcl li, div.cl li, #chapterlist li';
    const items = $(chapterSelector);

    items.each((_, el) => {
      const a = $(el).find('a')
      let url = a.attr('href') || ''
      
      if (!url && $(el).is('a')) {
         url = $(el).attr('href') || '';
      }

      const title = $(el).find('.chap-num').text().trim() || $(el).find('.lch a, .chapternum').text().trim() || (a.length > 0 ? a.text().trim() : $(el).text().trim())

      if (url) {
        const id = url.split('/').filter(Boolean).pop() || url;
        if (!chapters.some(ch => ch.id === id)) {
          chapters.push({
            id,
            title,
            url: url.startsWith('http') ? url : `${this.baseUrl}${url}`,
            number: parseFloat(title.replace(/[^\d.]/g, '')) || 0,
            date: $(el).find('.chapterdate').text().trim()
          })
        }
      }
    })

    return chapters
  }

  async fetchPages(chapterUrl: string): Promise<string[]> {
    const html = await this.fetchHtml(chapterUrl)
    if (!html) return []

    const $ = cheerio.load(html)
    const pages: string[] = []

    $('div#readerarea img').each((_, el) => {
      const src = $(el).attr('data-src') || $(el).attr('src')
      if (src && !src.includes('lazyload')) {
        pages.push(src.replace(/ /g, '%20'))
      }
    })

    if (pages.length === 0) {
        const scriptHtml = $('script').map((_, s) => $(s).html() || '').get().join('\n')
        const match = scriptHtml.match(/"images"\s*:\s*(\[[^\]]+\])/)
        if (match) {
            try {
               const images = JSON.parse(match[1])
               return images.map((img: any) => typeof img === 'string' ? img : img.url)
            } catch (e) {}
        }
    }
    return pages
  }
}

function getImgAttr(el: cheerio.Cheerio<any>): string {
    return el.attr('data-lazy-src') || el.attr('data-src') || el.attr('data-cfsrc') || el.attr('src') || '';
}
