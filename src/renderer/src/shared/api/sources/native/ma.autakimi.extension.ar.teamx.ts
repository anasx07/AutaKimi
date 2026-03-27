import { MadaraSource } from '../base/MadaraSource'
import { Manga, MangaPage, Chapter } from '../types'
import * as cheerio from 'cheerio'

export class TeamX extends MadaraSource {
  constructor() {
    super(
      'ma.autakimi.extension.ar.teamx',
      'Team X',
      '0.0.1',
      'https://olympustaff.com',
      'ar',
      'ma.autakimi.extension.ar.teamx',
      false
    )
  }

  async fetchPopular(page: number): Promise<MangaPage> {
    const url = `${this.baseUrl}/series?page=${page}`
    return this.parseOlympusMangaList(url)
  }

  async fetchLatest(page: number): Promise<MangaPage> {
    const url = `${this.baseUrl}/series?page=${page}`
    return this.parseOlympusMangaList(url)
  }

  async searchManga(query: string, page: number): Promise<MangaPage> {
    const url = query ? `${this.baseUrl}/series?search=${encodeURIComponent(query)}&page=${page}` : `${this.baseUrl}/series?page=${page}`
    return this.parseOlympusMangaList(url)
  }

  private async parseOlympusMangaList(url: string): Promise<MangaPage> {
    const html = await this.fetchHtml(url)
    if (!html) return { manga: [], hasNextPage: false }

    const $ = cheerio.load(html)
    const manga: Manga[] = []

    $('.bsx').each((_, el) => {
      const a = $(el).find('a')
      const link = a.attr('href')
      if (link) {
        const id = link.trim()
        const title = a.find('.tt').text().trim() || a.attr('title') || ''
        const cover = $(el).find('img').attr('src') || ''
        const statusStr = $(el).find('.status').text().trim() || 'Ongoing'
        
        let status = 'Ongoing'
        if (statusStr.includes('مكتمل')) status = 'Completed'
        else if (statusStr.includes('متوقف')) status = 'On Hiatus'

        manga.push({
          id,
          title,
          coverUrl: cover,
          url: id,
          status,
          author: '',
          artist: '',
          description: '',
          genres: []
        })
      }
    })

    const hasNextPage = $('.pagination .page-link[rel="next"]').length > 0 || $('.pagination .disabled:contains("»")').length === 0

    return { manga, hasNextPage }
  }

  async fetchMangaDetails(manga: Manga): Promise<Manga> {
    const html = await this.fetchHtml(manga.url || '')
    if (!html) throw new Error(`[TeamX] Failed to fetch details for ${manga.url}`)

    const $ = cheerio.load(html)
    
    // Find highest rez cover in the post
    let coverUrl = manga.coverUrl
    $('img').each((_, el) => {
      const src = $(el).attr('src')
      if (src && src.includes('images/manga') && !coverUrl) {
        coverUrl = src
      }
    })

    const description = 
      $('.manga-excerpt').text().trim() || 
      $('.review-content').text().trim() ||
      $('.mt-5.text-gray-400').text().trim() || 
      $('.description-content').text().trim() ||
      $('.mb-6 p').text().trim() || 
      $('.prose').text().trim() || 
      $('#synopsis').text().trim() ||
      ''

    const genres: string[] = []
    $('a[href*="/genres/"]').each((_, el) => {
      const g = $(el).text().trim()
      if (g && !genres.includes(g)) genres.push(g)
    })

    let author = ''
    let artist = ''
    
    // Attempt to find metadata by searching for Arabic labels
    $('div, span, p').each((_, el) => {
      const t = $(el).text()
      if (t.includes('المؤلف:')) {
         author = $(el).parent().find('a, span').last().text().trim()
      }
      if (t.includes('الرسام:')) {
         artist = $(el).parent().find('a, span').last().text().trim()
      }
    })

    return {
      ...manga,
      coverUrl: coverUrl || manga.coverUrl,
      description,
      genres,
      author: author || undefined,
      artist: artist || author || undefined
    }
  }

  async fetchChapters(mangaUrl: string): Promise<Chapter[]> {
    const html = await this.fetchHtml(mangaUrl)
    if (!html) throw new Error(`[TeamX] Failed to fetch chapters for ${mangaUrl}`)

    const $ = cheerio.load(html)
    const chapters: Chapter[] = []

    $('.enhanced-chapters-grid .chapter-card').each((i, el) => {
      const $a = $(el).find('a.chapter-link')
      const href = $a.attr('href')
      if (href) {
        const numStr = $(el).find('.chapter-number').text().trim().match(/\d+/)?.[0] || '0'
        let title = $(el).find('.chapter-number').text().trim()
        const sub = $(el).find('.chapter-title').text().trim()
        if (sub) {
            title += ` - ${sub}`
        }
        
        const dateStr = $(el).find('.chapter-date').text().trim()
        
        chapters.push({
          id: href,
          title: title || `Chapter ${numStr}`,
          url: href,
          number: parseFloat(numStr) || i + 1,
          date: dateStr
        })
      }
    })

    // Fallback if they change to standard list
    if (chapters.length === 0) {
      $('a[href*="/chapter/"], a[href*="/series/"]').each((i, el) => {
         const href = $(el).attr('href')
         if (href && href !== mangaUrl && $(el).text().trim().length < 100 && href.split('/').length > 5) {
            const numStr = $(el).text().trim().match(/\d+/)?.[0] || '0'
            chapters.push({
               id: href,
               title: $(el).text().trim() || `Chapter ${numStr}`,
               url: href,
               number: parseFloat(numStr) || i + 1
            })
         }
      })
    }

    return chapters
  }

  async fetchPages(chapterUrl: string): Promise<string[]> {
    const html = await this.fetchHtml(chapterUrl)
    if (!html) throw new Error(`[TeamX] Failed to fetch pages for ${chapterUrl}`)

    const $ = cheerio.load(html)
    const pages: string[] = []

    $('.manga-chapter-img').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src')
      if (src) {
        pages.push(src.trim())
      }
    })

    // Fallback if class changes
    if (pages.length === 0) {
        $('img').each((_, el) => {
            const src = $(el).attr('src')
            if (src && (src.includes('uploads/manga') || src.includes('chapter') || src.includes('pages/'))) {
                pages.push(src.trim())
            }
        })
    }

    return pages
  }
}
