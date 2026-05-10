import { NetworkService } from '@common/services/network'
import { Extension, IpcResult } from '@common/types'
import { localExtensions as rawCatalog } from './sources/catalog/catalog-local'

const REPO_URL =
  'https://raw.githubusercontent.com/keiyoushi/extensions-source/main/index.min.json'
const ICON_BASE = 'https://raw.githubusercontent.com/keiyoushi/extensions-source/main/icons'

/**
 * CatalogService handles the discovery, fetching, and merging of extension metadata.
 * It decouples business logic (deduplication, remote sync) from the raw IPC/Proxy layer.
 */
export const CatalogService = {
  /**
   * Fetches the unified extension catalog, merging local bundled metadata with
   * remote updates from the official repository.
   */
  getExtensions: async (): Promise<IpcResult<Extension[]>> => {
    // 1. Load Local Bundled Extensions
    const localExtensions = rawCatalog.map((ext: any) => ({
      pkg: ext.pkg,
      name: ext.name,
      lang: ext.lang,
      icon: `${ICON_BASE}/${ext.pkg}.png`,
      version: ext.version,
      baseUrl: ext.sources?.[0]?.baseUrl || '',
      repoUrl: 'local',
      nsfw: ext.nsfw || 0
    }))

    try {
      // 2. Try to fetch Remote Index for updates with robust retry handling
      const res = await NetworkService.fetchWithRetry(REPO_URL)

      if (!res.ok) {
        throw new Error(`Remote fetch failed with status: ${res.status}`)
      }

      const remoteData = await res.json()

      // Transform remote format to standardized Extension format
      const remoteExtensions: Extension[] = remoteData.map((ext: any) => ({
        pkg: ext.pkg,
        name: ext.name,
        lang: ext.lang,
        icon: `${ICON_BASE}/${ext.pkg}.png`,
        version: ext.version,
        baseUrl: ext.baseUrl || '',
        repoUrl: 'https://raw.githubusercontent.com/keiyoushi/extensions-source/main',
        nsfw: ext.nsfw || 0
      }))

      // 3. Merge (Remote overrides Local if present as it contains newer version info)
      const mergedMap = new Map<string, Extension>()

      // Fill with local first
      localExtensions.forEach((ext) => mergedMap.set(ext.pkg, ext))

      // Update with remote (newer info)
      remoteExtensions.forEach((ext) => {
        mergedMap.set(ext.pkg, ext)
      })

      return { ok: true, value: Array.from(mergedMap.values()) }
    } catch (e: unknown) {
      console.warn('[CatalogService] Failed to fetch remote catalog, falling back to local only:', e)
      // Return local only if remote fails to ensure app remains functional offline
      return { ok: true, value: localExtensions }
    }
  }
}
