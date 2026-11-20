import { networkClient } from './network'
import { RepositoryManifest } from './repository.service'
import { Extension } from '../types'

export interface KeiyoushiExtensionItem {
  name: string
  pkg: string
  apk: string
  lang: string
  code: number
  version: string
  nsfw: number | boolean
  sources: Array<{
    name: string
    id: string
    baseUrl: string
    lang: string
  }>
}

export class KeiyoushiService {
  private static instance: KeiyoushiService
  private keiyoushiCache = new Map<string, any[]>()

  public static getInstance(): KeiyoushiService {
    if (!KeiyoushiService.instance) {
      KeiyoushiService.instance = new KeiyoushiService()
    }
    return KeiyoushiService.instance
  }

  isKeiyoushiUrl(url: string): boolean {
    if (!url) return false
    const lower = url.toLowerCase()
    return (
      lower.includes('keiyoushi') ||
      lower.endsWith('index.min.json') ||
      lower.endsWith('index.json') ||
      lower.endsWith('index.pb')
    )
  }

  /**
   * Normalizes any Keiyoushi URL (including .pb, .min.json, or github web URLs) to the real index.json
   */
  normalizeKeiyoushiUrl(url: string): string {
    let clean = (url || '').trim()
    // Convert github.com web/raw URLs to raw.githubusercontent.com
    if (clean.includes('github.com/keiyoushi/extensions/raw/')) {
      clean = clean.replace('github.com/keiyoushi/extensions/raw/', 'raw.githubusercontent.com/keiyoushi/extensions/')
    } else if (clean.includes('github.com/keiyoushi/extensions')) {
      clean = 'https://raw.githubusercontent.com/keiyoushi/extensions/repo/index.json'
    }

    // Any index.pb or index.min.json or bare repo path for Keiyoushi must map to index.json
    if (clean.endsWith('index.min.json')) {
      return clean.replace(/index\.min\.json$/, 'index.json')
    }
    if (clean.endsWith('index.pb')) {
      return clean.replace(/index\.pb$/, 'index.json')
    }
    if (clean.includes('keiyoushi') && !clean.endsWith('.json')) {
      return clean.replace(/\/+$/, '') + '/index.json'
    }
    return clean
  }

  /**
   * Resolves a Keiyoushi URL and constructs a compatible AutaKimi RepositoryManifest
   */
  async resolveKeiyoushiManifest(url: string): Promise<RepositoryManifest> {
    const targetUrl = this.normalizeKeiyoushiUrl(url)
    const parts = targetUrl.split('/')
    parts.pop()
    const baseUrl = parts.join('/') + '/'

    return {
      version: '1.0.0',
      name: 'Keiyoushi Extensions Repository',
      templates: 'templates.json',
      plugins: 'plugins.json',
      catalogs: {
        manga: 'index.json',
        anime: 'index.json'
      },
      sources: {
        manga: 'index.json',
        anime: 'index.json'
      },
      baseUrl,
      isKeiyoushi: true
    }
  }

  /**
   * Fetches Keiyoushi index.json and converts items to standard AutaKimi Extension objects
   */
  async fetchKeiyoushiCatalog(url: string): Promise<{ success: boolean; extensions: Extension[] }> {
    try {
      const targetUrl = this.normalizeKeiyoushiUrl(url)
      const res = await networkClient.fetch(targetUrl, { cache: 'no-store' })
      if (!res.ok || !res.value.ok) {
        return { success: false, extensions: [] }
      }

      const data = await res.value.json()
      const rawList: any[] = data.extensionList?.extensions || data.extensions || (Array.isArray(data) ? data : [])

      if (!Array.isArray(rawList) || rawList.length === 0) {
        return { success: false, extensions: [] }
      }

      // Filter out dummy warning notices ("Outdated App", "Update to Mihon 0.20.1+")
      const validItems = rawList.filter((item) => {
        const pkg = item.packageName || item.pkg || ''
        const name = item.name || ''
        if (pkg.endsWith('.keiyoushi') || pkg.endsWith('.mihon')) return false
        if (name.includes('Outdated App') || name.includes('Update to Mihon')) return false
        return true
      })

      const extensions: Extension[] = validItems.map((item: any) => {
        const primarySource = item.sources?.[0] || {}
        const pkg = item.packageName || item.pkg || ''
        const name = item.name || primarySource.name || 'Keiyoushi Source'
        const version = item.versionName || item.version || '1.0.0'
        const resources = item.resources || {}

        const baseUrlDir = targetUrl.replace(/\/[^/]+\.json$/, '/')
        const apkUrl = resources.apkUrl || item.apkUrl || `${baseUrlDir}apk/${item.apk}`
        const iconUrl = resources.iconUrl || item.iconUrl || `${baseUrlDir}icon/${pkg}.png`
        const jarUrl = resources.jarUrl || item.jarUrl || `${baseUrlDir}jar/${item.jar}`
        const isNsfw = item.contentWarning === 'CONTENT_WARNING_NSFW' || item.nsfw === 1 || item.nsfw === true

        return {
          pkg,
          id: pkg,
          name,
          lang: primarySource.language || item.lang || 'all',
          icon: iconUrl,
          version,
          baseUrl: primarySource.homeUrl || primarySource.baseUrl || '',
          nsfw: isNsfw,
          repoUrl: url,
          isKeiyoushi: true,
          apkUrl,
          jarUrl
        } as any
      })

      this.keiyoushiCache.set(url, extensions as any)
      return { success: true, extensions }
    } catch (e: any) {
      console.error('[KeiyoushiService] Failed to fetch Keiyoushi catalog:', e.message)
      return { success: false, extensions: [] }
    }
  }
}

export const keiyoushiService = KeiyoushiService.getInstance()
