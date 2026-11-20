import { networkClient } from './network'
import { keiyoushiService } from './keiyoushi.service'

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
  isKeiyoushi?: boolean
}

export function isPrivateIpOrHost(hostname: string): boolean {
  const host = hostname.toLowerCase().trim()
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0') {
    return true
  }

  // IPv4 regex checks for private / link-local / loopback ranges:
  // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16, 127.0.0.0/8, 0.0.0.0/8
  if (
    /^10\./.test(host) ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^127\./.test(host) ||
    /^0\./.test(host)
  ) {
    return true
  }

  // Check IPv6 link-local and unique-local
  if (/^fc[0-9a-f]{2}:/i.test(host) || /^fd[0-9a-f]{2}:/i.test(host) || /^fe80:/i.test(host)) {
    return true
  }

  return false
}

export function validateRepositoryUrl(urlStr: string): void {
  if (urlStr.startsWith('autakimi-local://') || urlStr.startsWith('file://')) {
    return
  }
  let parsed: URL
  try {
    parsed = new URL(urlStr)
  } catch {
    throw new Error(`Invalid repository URL format: ${urlStr}`)
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Invalid repository protocol "${parsed.protocol}". Only HTTP and HTTPS are permitted.`)
  }

  if (isPrivateIpOrHost(parsed.hostname)) {
    throw new Error(`Repository host "${parsed.hostname}" is a private or local address and cannot be accessed.`)
  }
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
    validateRepositoryUrl(url)
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
    validateRepositoryUrl(url)
    if (keiyoushiService.isKeiyoushiUrl(url)) {
      return keiyoushiService.resolveKeiyoushiManifest(url)
    }

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
    validateRepositoryUrl(baseUrl)
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
