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
      const mcRes = await networkClient.fetch(mangaCatalogsUrl)
      if (mcRes.ok) {
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
      const acRes = await networkClient.fetch(animeCatalogsUrl)
      if (acRes.ok) {
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
      const res = await networkClient.fetch(url)
      if (!res.ok) return { success: false, count: 0 }
      
      const data = await res.value.json()
      let count = 0
      for (const [id, meta] of Object.entries(data)) {
        this.sources.set(id, { ...(meta as any), type })
        count++
      }
      return { success: true, count }
    } catch (e) {
      return { success: false, count: 0 }
    }
  }

  async fetchSources(url: string, type: 'manga' | 'anime'): Promise<{ success: boolean; count: number; error?: string }> {
    try {
      const res = await networkClient.fetch(url)
      if (!res.ok) {
        // Silently fail for 404s as many repos won't have all source types
        if (res.value?.status === 404) return { success: true, count: 0 }
        throw new Error(`Failed to fetch sources: ${res.error}`)
      }
      
      const response = res.value
      if (!response.ok) {
        if (response.status === 404) return { success: true, count: 0 }
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      const listKey = type === 'manga' ? 'manga_sources' : 'anime_sources'
      const items = data[listKey]

      if (!items || !Array.isArray(items)) {
        return { success: true, count: 0 }
      }

      for (const item of items) {
        this.sources.set(item.id, { ...item, type })
      }

      return { success: true, count: items.length }
    } catch (err: any) {
      console.warn(`[SourceService] Could not load ${type} sources from ${url}:`, err.message)
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
