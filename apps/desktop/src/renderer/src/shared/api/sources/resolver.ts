import { DataService } from '@renderer/shared/api'
import { ISourceAdapter, Manga, Chapter, MangaPage, StreamingServer } from './types'
import { SourceRegistry } from './SourceRegistry'
import { useExtensionStore } from '@renderer/shared/model'
import { normalizeManga, isValidMediaCatalogItem } from '@common/utils/mangaNormalizer'
import { sourceService } from '@common/services/source.service'

/**
 * Wraps dynamic Sandbox extension calls to match Native return types
 */
export class SandboxRunner implements ISourceAdapter {
  id: string
  name: string
  mediaType: 'manga' | 'anime' // NEW
  version: string
  theme: string
  baseUrl: string
  lang: string
  nsfw: boolean
  icon: string
  isSupported: boolean = true

  getFeedLabels(): Record<string, string> {
    const hasLatest = this.extensionCode.includes('latest') || this.extensionCode.includes('fetchLatest')
    return {
      popular: 'Popular',
      latest: hasLatest ? 'Latest' : 'Popular',
      search: 'Search'
    }
  }

  private extensionCode: string
  private pkg: string

  constructor(pkg: string, resExt: any) {
    this.pkg = pkg
    this.extensionCode = resExt?.code || ''

    // Map headers
    this.id = pkg
    this.name = resExt?.name || pkg
    this.mediaType = resExt?.type || 'manga'
    this.version = resExt?.version || '0.0.0'
    this.theme = ''
    this.baseUrl = resExt?.baseUrl || ''
    this.lang = resExt?.lang || 'all'
    this.nsfw = !!resExt?.nsfw
    this.icon = resExt?.icon || `autakimi-cache://local-icon/${pkg}.png`
  }

  private async executeFeed(activeFeed: string, page: number, extraArgs: any = {}, debouncedSearch?: string): Promise<MangaPage> {
    const res: any = await DataService.executeExtension({
      pkg: this.pkg,
      code: this.extensionCode,
      contextArgs: {
        limit: 15,
        offset: (page - 1) * 15,
        activeFeed,
        lang: this.lang,
        baseUrl: this.baseUrl,
        ...(debouncedSearch !== undefined ? { debouncedSearch } : {}),
        ...extraArgs
      }
    })
    const manga = (res?.data || [])
      .filter(isValidMediaCatalogItem)
      .map((m: any) => {
        const norm = normalizeManga(m)
        return {
          ...norm,
          pkg: norm.pkg || this.pkg,
          url: norm.url || m.url || ''
        } as Manga
      })
    return { manga, hasNextPage: (res?.data?.length || 0) > 0 }
  }

  async fetchPopular(page: number, extraArgs: any = {}): Promise<MangaPage> {
    return this.executeFeed('popular', page, extraArgs)
  }

  async fetchLatest(page: number, extraArgs: any = {}): Promise<MangaPage> {
    const hasLatest = this.extensionCode.includes('latest') || this.extensionCode.includes('fetchLatest')
    if (!hasLatest) {
      return this.fetchPopular(page, extraArgs)
    }
    return this.executeFeed('latest', page, extraArgs)
  }

  async searchManga(query: string, page: number, extraArgs: any = {}): Promise<MangaPage> {
    return this.executeFeed('search', page, extraArgs, query)
  }

  async fetchMangaDetails(manga: Manga): Promise<Manga> {
    const res: any = await DataService.executeExtension({
      pkg: this.pkg,
      code: this.extensionCode,
      contextArgs: { type: 'fetchMangaDetails', mangaUrl: manga.url, baseUrl: this.baseUrl }
    })
    if (res && res.data) {
      const details = normalizeManga(res.data)
      return {
        ...manga,
        ...details,
        url: details.url || manga.url,
        pkg: details.pkg || manga.pkg
      }
    }
    return manga
  }

  async fetchChapters(mangaUrl: string): Promise<Chapter[]> {
    const res: any = await DataService.executeExtension({
      pkg: this.pkg,
      code: this.extensionCode,
      contextArgs: { type: 'fetchChapters', mangaUrl, baseUrl: this.baseUrl }
    })
    return res?.data || []
  }

  async fetchPages(chapterUrl: string): Promise<string[] | StreamingServer[]> {
    const res: any = await DataService.executeExtension({
      pkg: this.pkg,
      code: this.extensionCode,
      contextArgs: { type: 'fetchPages', chapterUrl, baseUrl: this.baseUrl }
    })
    return res?.pages || []
  }
}

export const ExtensionResolver = {
  async resolve(pkg: string): Promise<ISourceAdapter | null> {
    const fullPkg = pkg.startsWith('ma.autakimi.extension.') ? pkg : `ma.autakimi.extension.${pkg}`
    const cleanPkg = pkg.replace(/^ma\.autakimi\.extension\./, '')

    let resExt = (await DataService.db.getExtension(fullPkg)) || (await DataService.db.getExtension(cleanPkg))
    const hasValidCode = (resExt as any)?.code && (resExt as any)?.baseUrl && (resExt as any).baseUrl !== ''

    // If no valid extension code in DB, try auto-installing/fetching with source metadata from sourceService
    if (!resExt || !hasValidCode) {
      try {
        const meta = sourceService.getSource(fullPkg) || sourceService.getSource(cleanPkg)
        const extToInstall = {
          pkg: fullPkg,
          name: meta?.name || cleanPkg,
          lang: meta?.lang || 'ar',
          icon: meta?.icon || '',
          baseUrl: meta?.baseUrl || (resExt as any)?.baseUrl || '',
          version: meta?.version || '1.0.0',
          sources: (meta?.baseUrl || (resExt as any)?.baseUrl) ? [{ baseUrl: meta?.baseUrl || (resExt as any)?.baseUrl }] : []
        }

        await DataService.installExtension(extToInstall, 'remote')
        resExt = (await DataService.db.getExtension(fullPkg)) || (await DataService.db.getExtension(cleanPkg))
      } catch (e) {
        console.warn(`[ExtensionResolver] Auto-install failed for ${fullPkg}:`, e)
      }
    }

    // 1. Prefer sandbox runner if custom JS / template scraper code exists
    if ((resExt as any)?.code) {
      const overrides = useExtensionStore.getState().domainOverrides
      const overrideDomain = overrides[fullPkg] || overrides[cleanPkg] || overrides[pkg]
      if (overrideDomain) {
        (resExt as any).baseUrl = overrideDomain
      }
      return new SandboxRunner(fullPkg, resExt as any)
    }

    // 2. Fallback to native base-class adapter if available
    const overrides = useExtensionStore.getState().domainOverrides
    const native = SourceRegistry.resolve(fullPkg, overrides) || SourceRegistry.resolve(cleanPkg, overrides)
    if (native) {
      return native
    }

    return null
  }
}
