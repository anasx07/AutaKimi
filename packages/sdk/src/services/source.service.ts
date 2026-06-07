import { networkClient } from './network'

export interface ContentSource {
  id: string
  name: string
  url: string
  templateId: string
  icon?: string
  nsfw: boolean
  language: string
  type: 'manga' | 'anime'
}

export class SourceService {
  private static instance: SourceService
  private sources = new Map<string, ContentSource>()

  public static getInstance(): SourceService {
    if (!SourceService.instance) {
      SourceService.instance = new SourceService()
    }
    return SourceService.instance
  }

  async loadAllRepositories(urls: string[]): Promise<{ success: boolean; totalCount: number }> {
    let totalCount = 0
    for (const url of urls) {
      const baseUrl = url.endsWith('templates.json') 
        ? url.replace('templates.json', '') 
        : url.endsWith('/') ? url : `${url}/`

      // 1. Fetch manga catalogs index
      const mangaCatalogsUrl = `${baseUrl}manga_catalogs.json`
      console.log(`[SourceService] Fetching catalogs from: ${mangaCatalogsUrl}`)
      const mcRes = await networkClient.fetch(mangaCatalogsUrl, { cache: 'no-store' })
      console.log(`[SourceService] manga_catalogs.json fetch result: ok=${mcRes.ok}, status=${mcRes.ok ? mcRes.value.status : 'N/A'}`)
      if (mcRes.ok && mcRes.value.ok) {
        const mcData = await mcRes.value.json()
        if (mcData.catalogs && Array.isArray(mcData.catalogs)) {
          for (const catalogFile of mcData.catalogs) {
            const catalogUrl = `${baseUrl}MangaCatalogs/${catalogFile}`
            const catRes = await this.fetchCatalog(catalogUrl, 'manga')
            if (catRes.success) totalCount += catRes.count
          }
        }
      }

      // 2. Fetch anime catalogs index
      const animeCatalogsUrl = `${baseUrl}anime_catalogs.json`
      const acRes = await networkClient.fetch(animeCatalogsUrl, { cache: 'no-store' })
      if (acRes.ok && acRes.value.ok) {
        const acData = await acRes.value.json()
        if (acData.catalogs && Array.isArray(acData.catalogs)) {
          for (const catalogFile of acData.catalogs) {
            const catalogUrl = `${baseUrl}AnimeCatalogs/${catalogFile}`
            const catRes = await this.fetchCatalog(catalogUrl, 'anime')
            if (catRes.success) totalCount += catRes.count
          }
        }
      }

      // 2. Fetch manga sources
      const mangaUrl = `${baseUrl}manga_sources.json`
      const mRes = await this.fetchSources(mangaUrl, 'manga')
      if (mRes.success) totalCount += mRes.count

      // 3. Fetch anime sources
      const animeUrl = `${baseUrl}anime_sources.json`
      const aRes = await this.fetchSources(animeUrl, 'anime')
      if (aRes.success) totalCount += aRes.count
    }
    return { success: true, totalCount }
  }

  async fetchCatalog(url: string, type: 'manga' | 'anime'): Promise<{ success: boolean; count: number }> {
    try {
      const res = await networkClient.fetch(url, { cache: 'no-store' })
      if (!res.ok || !res.value.ok) {
        console.error(`[SourceService] fetchCatalog failed for ${url}: Network error or bad status. ok=${res.ok}, value.ok=${res.ok ? res.value.ok : false}`)
        return { success: false, count: 0 }
      }
      
      const contentType = res.value.headers.get('content-type') || ''
      if (contentType.includes('text/html')) {
        console.error(`[SourceService] fetchCatalog returned HTML for ${url}`)
        return { success: false, count: 0 }
      }

      const data = await res.value.json()
      let count = 0
      
      if (Array.isArray(data)) {
        for (const item of data) {
          const id = item.pkg || item.id
          if (!id) continue
          
          const existing = (this.sources.get(id) || {}) as any
          const firstSource = item.sources?.[0] || {}
          this.sources.set(id, {
            ...existing,
            ...item,
            id,
            baseUrl: item.baseUrl || firstSource.baseUrl || existing.baseUrl || '',
            apiUrl: item.apiUrl || firstSource.apiUrl || firstSource.baseUrl || existing.apiUrl || '',
            nsfw: item.nsfw === 1 || item.nsfw === true || item.nsfw === 'true' || firstSource.nsfw === 1 || firstSource.nsfw === true || !!existing.nsfw,
            type: existing.type || type
          })
          count++
        }
      } else {
        for (const [id, meta] of Object.entries(data)) {
          const item = meta as any
          const existing = (this.sources.get(id) || {}) as any
          this.sources.set(id, {
            ...existing,
            ...item,
            id, // Inject the key as the id property
            nsfw: item.nsfw === 1 || item.nsfw === true || item.nsfw === 'true' || !!existing.nsfw,
            type: existing.type || type
          })
          count++
        }
      }
      return { success: true, count }
    } catch (e: any) {
      console.error(`[SourceService] fetchCatalog Exception on ${url}:`, e.message)
      return { success: false, count: 0 }
    }
  }

  async fetchSources(url: string, type: 'manga' | 'anime'): Promise<{ success: boolean; count: number; error?: string }> {
    try {
      const res = await networkClient.fetch(url, { cache: 'no-store' })
      if (!res.ok) {
        // Silently fail for 404s as many repos won't have all source types
        if (res.status === 404) return { success: true, count: 0 }
        throw new Error(`Failed to fetch sources: ${res.error}`)
      }
      
      const response = res.value
      if (!response.ok) {
        if (response.status === 404) return { success: true, count: 0 }
        throw new Error(`HTTP ${response.status}`)
      }

      const contentType = response.headers.get('content-type') || ''
      if (contentType.includes('text/html')) {
        return { success: true, count: 0 }
      }

      const data = await response.json()
      const listKey = type === 'manga' ? 'manga_sources' : 'anime_sources'
      const items = data[listKey]

      if (!items || !Array.isArray(items)) {
        return { success: true, count: 0 }
      }

      for (const item of items) {
        this.sources.set(item.id, {
          ...item,
          nsfw: item.nsfw === 1 || item.nsfw === true || item.nsfw === 'true',
          type
        })
      }

      return { success: true, count: items.length }
    } catch (err: any) {
      console.error(`[SourceService] fetchSources HTTP Exception on ${url}:`, err.message)
      return { success: false, count: 0, error: err.message }
    }
  }

  getAllSources(type?: 'manga' | 'anime'): ContentSource[] {
    const all = Array.from(this.sources.values())
    if (type) return all.filter(s => s.type === type)
    return all
  }

  getSource(id: string): ContentSource | undefined {
    return this.sources.get(id)
  }
}

export const sourceService = SourceService.getInstance()
