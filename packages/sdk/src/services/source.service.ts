import { Extension } from '../types'
import { networkClient } from './network'
import { repositoryService } from './repository.service'
import { keiyoushiService } from './keiyoushi.service'

export interface AutakimiSource extends Extension {
  baseUrl: string
  apiUrl: string
  type?: 'manga' | 'anime'
}

export class SourceService {
  private static instance: SourceService
  private sources = new Map<string, AutakimiSource>()
  private catalogFiles: { manga: { baseUrl: string; file: string }[]; anime: { baseUrl: string; file: string }[] } = { manga: [], anime: [] }

  public static getInstance(): SourceService {
    if (!SourceService.instance) {
      SourceService.instance = new SourceService()
    }
    return SourceService.instance
  }

  resetCatalogFiles(): void {
    this.catalogFiles = { manga: [], anime: [] }
  }

  async hydrateManifest(manifest: any, installedLangs: string[] = []): Promise<{ success: boolean; totalCount: number }> {
    let totalCount = 0
    try {
      const baseUrl = manifest.baseUrl

      // Special handling for Keiyoushi repositories (whether index.json or index.min.json)
      const isKeiyoushi =
        Boolean(manifest.isKeiyoushi) ||
        manifest.catalogs?.manga === 'index.json' ||
        manifest.catalogs?.manga === 'index.min.json' ||
        keiyoushiService.isKeiyoushiUrl(baseUrl) ||
        keiyoushiService.isKeiyoushiUrl(manifest.catalogs?.manga || '')

      if (isKeiyoushi) {
        const catalogFile = manifest.catalogs?.manga || 'index.json'
        const kRes = await keiyoushiService.fetchKeiyoushiCatalog(`${baseUrl}${catalogFile}`)
        if (kRes.success) {
          for (const ext of kRes.extensions) {
            this.sources.set(ext.pkg, {
              ...ext,
              id: ext.pkg,
              apiUrl: ext.baseUrl,
              type: 'manga'
            } as any)
          }
          return { success: true, totalCount: kRes.extensions.length }
        }
      }

      // 1. Fetch manga & anime catalogs index concurrently in parallel
      const mangaCatalogsUrl = `${baseUrl}${manifest.catalogs.manga}`
      const animeCatalogsUrl = `${baseUrl}${manifest.catalogs.anime}`

      const [mcRes, acRes] = await Promise.all([
        networkClient.fetch(mangaCatalogsUrl, { cache: 'no-store' }),
        networkClient.fetch(animeCatalogsUrl, { cache: 'no-store' })
      ])

      if (mcRes.ok && mcRes.value.ok) {
        const mcData = await mcRes.value.json()
        if (mcData.catalogs && Array.isArray(mcData.catalogs)) {
          for (const catalogFile of mcData.catalogs) {
            this.catalogFiles.manga.push({ baseUrl, file: catalogFile })
          }
        }
      }

      if (acRes.ok && acRes.value.ok) {
        const acData = await acRes.value.json()
        if (acData.catalogs && Array.isArray(acData.catalogs)) {
          for (const catalogFile of acData.catalogs) {
            this.catalogFiles.anime.push({ baseUrl, file: catalogFile })
          }
        }
      }

      // Fetch installed languages or all if none specified concurrently
      const langsToFetch = installedLangs.length > 0 ? installedLangs : ['all']
      const langResults = await Promise.all(
        langsToFetch.map(async (lang) => {
          const [mRes, aRes] = await Promise.all([
            this.fetchCatalogByLang(lang, 'manga'),
            this.fetchCatalogByLang(lang, 'anime')
          ])
          return (mRes.count || 0) + (aRes.count || 0)
        })
      )

      for (const count of langResults) {
        totalCount += count
      }
    } catch (e) {
      console.error(`[SourceService] Error hydrating manifest at ${manifest.baseUrl}:`, e)
    }
    return { success: true, totalCount }
  }

  async loadAllRepositories(urls: string[], installedLangs: string[] = []): Promise<{ success: boolean; totalCount: number }> {
    let totalCount = 0
    this.resetCatalogFiles()
    const results = await Promise.all(
      urls.map(async (url) => {
        try {
          const manifest = await repositoryService.resolveManifest(url)
          return await this.hydrateManifest(manifest, installedLangs)
        } catch (e) {
          console.error(`[SourceService] Error loading repo ${url}:`, e)
          return { success: false, totalCount: 0 }
        }
      })
    )
    for (const res of results) {
      totalCount += res.totalCount
    }
    return { success: true, totalCount }
  }

  async fetchCatalogByLang(lang: string = 'all', type: 'manga' | 'anime' = 'manga'): Promise<{ success: boolean; count: number }> {
    let total = 0
    const targetLang = (lang || 'all').toLowerCase()
    
    // Map lang code to full filename matching logic
    const matchesLang = (file: string) => {
      const f = file.toLowerCase()
      if (targetLang === 'all' || !targetLang) return true
      
      const langMap: Record<string, string> = {
        'en': 'english', 'ar': 'arabic', 'es': 'spanish', 'fr': 'french',
        'id': 'indonesian', 'ja': 'japanese', 'ko': 'korean', 'pt': 'portuguese',
        'pt-br': 'portuguese-brazil', 'ru': 'russian', 'th': 'thai', 'tr': 'turkish',
        'vi': 'vietnamese', 'zh': 'zh', 'de': 'de', 'it': 'italian', 'pl': 'polish',
        'nl': 'dutch', 'cs': 'czech', 'bg': 'bg', 'ca': 'ca', 'uk': 'ukrainian'
      }
      const mapped = langMap[targetLang] || targetLang
      
      const basename = f.split('/').pop() || f
      return basename === `${mapped}.json` || basename === `${targetLang}.json` ||
             basename.startsWith(`${mapped}-`) || basename.startsWith(`${targetLang}-`)
    }

    const targets = this.catalogFiles[type].filter(c => matchesLang(c.file))
    
    const results = await Promise.all(
      targets.map(async (target) => {
        const url = `${target.baseUrl}${type === 'manga' ? 'MangaCatalogs' : 'AnimeCatalogs'}/${target.file}`
        return this.fetchCatalog(url, type)
      })
    )

    for (const res of results) {
      if (res.success) total += res.count
    }
    
    return { success: true, count: total }
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

  hasCatalogFiles(): boolean {
    return this.catalogFiles.manga.length > 0 || this.catalogFiles.anime.length > 0 || this.sources.size > 0
  }

  getAllSources(type?: 'manga' | 'anime'): AutakimiSource[] {
    const all = Array.from(this.sources.values())
    if (type) return all.filter(s => s.type === type)
    return all
  }

  getSource(id: string): AutakimiSource | undefined {
    if (this.sources.has(id)) return this.sources.get(id)
    const cleanId = id.replace(/^ma\.autakimi\.extension\./, '')
    if (this.sources.has(cleanId)) return this.sources.get(cleanId)
    const fullId = `ma.autakimi.extension.${cleanId}`
    if (this.sources.has(fullId)) return this.sources.get(fullId)
    return undefined
  }
}

export const sourceService = SourceService.getInstance()
