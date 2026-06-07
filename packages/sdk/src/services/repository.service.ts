import { networkClient } from './network'

export interface RepositoryManifest {
  version: string
  name?: string
  templates: string
  plugins: string
  catalogs: {
    manga: string
    anime: string
  }
  sources: {
    manga: string
    anime: string
  }
  // Internally added property for absolute path resolution
  baseUrl: string
}

export class RepositoryService {
  private static instance: RepositoryService
  private manifestCache = new Map<string, Promise<RepositoryManifest>>()

  public static getInstance(): RepositoryService {
    if (!RepositoryService.instance) {
      RepositoryService.instance = new RepositoryService()
    }
    return RepositoryService.instance
  }

  private resolveBaseUrl(url: string): string {
    let baseUrl = url
    if (url.endsWith('.json')) {
      const parts = url.split('/')
      parts.pop()
      baseUrl = parts.join('/') + '/'
    } else {
      baseUrl = url.endsWith('/') ? url : `${url}/`
    }
    return baseUrl
  }

  /**
   * Fetches the manifest.json for a repository. If it does not exist,
   * it returns a legacy manifest mapping based on the legacy structure.
   */
  async resolveManifest(url: string): Promise<RepositoryManifest> {
    const baseUrl = this.resolveBaseUrl(url)

    if (this.manifestCache.has(baseUrl)) {
      return this.manifestCache.get(baseUrl)!
    }

    const fetchPromise = this.fetchManifest(baseUrl)
    this.manifestCache.set(baseUrl, fetchPromise)
    
    try {
      return await fetchPromise
    } catch (e) {
      this.manifestCache.delete(baseUrl)
      throw e
    }
  }

  private async fetchManifest(baseUrl: string): Promise<RepositoryManifest> {
    const manifestUrl = `${baseUrl}manifest.json`
    
    const legacyManifest: RepositoryManifest = {
      version: '1.0.0',
      templates: 'templates.json',
      plugins: 'plugins.json',
      catalogs: {
        manga: 'manga_catalogs.json',
        anime: 'anime_catalogs.json'
      },
      sources: {
        manga: 'manga_sources.json',
        anime: 'anime_sources.json'
      },
      baseUrl
    }

    try {
      const res = await networkClient.fetch(manifestUrl, { cache: 'no-store' })
      if (!res.ok || !res.value.ok) {
        if (res.ok && res.value.status === 404) {
          console.log(`[RepositoryService] No manifest.json found at ${baseUrl}. Falling back to legacy structure.`)
          return legacyManifest
        }
        return legacyManifest
      }

      const contentType = res.value.headers.get('content-type') || ''
      if (contentType.includes('text/html')) {
        console.log(`[RepositoryService] HTML returned for manifest.json at ${baseUrl}. Falling back to legacy structure.`)
        return legacyManifest
      }

      const data = await res.value.json()
      
      // Merge with legacy structure to ensure missing fields are populated
      return {
        ...legacyManifest,
        ...data,
        baseUrl,
        catalogs: {
          ...legacyManifest.catalogs,
          ...(data.catalogs || {})
        },
        sources: {
          ...legacyManifest.sources,
          ...(data.sources || {})
        }
      }
    } catch (e) {
      console.warn(`[RepositoryService] Error fetching manifest at ${baseUrl}. Falling back to legacy.`, e)
      return legacyManifest
    }
  }
}

export const repositoryService = RepositoryService.getInstance()
