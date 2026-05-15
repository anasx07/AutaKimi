import { DataService } from '@renderer/shared/api'
import { ISourceAdapter, Manga, Chapter, MangaPage } from './types'
import { SourceRegistry } from './SourceRegistry'
import { useExtensionStore } from '@renderer/shared/model'
import { compareVersions } from '@renderer/shared/lib/version'
import { normalizeManga } from '@common/utils/mangaNormalizer'

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

  getFeedLabels?(): Record<string, string> {
    return { popular: 'Popular', latest: 'Latest', search: 'Search' }
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
    this.baseUrl = ''
    this.lang = 'all'
    this.nsfw = false
    this.icon = ''
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
        ...(debouncedSearch !== undefined ? { debouncedSearch } : {}),
        ...extraArgs
      }
    })
    const manga = (res?.data || []).map((m: any) => normalizeManga(m) as any as Manga)
    return { manga, hasNextPage: (res?.data?.length || 0) > 0 }
  }

  async fetchPopular(page: number, extraArgs: any = {}): Promise<MangaPage> {
    return this.executeFeed('popular', page, extraArgs)
  }

  async fetchLatest(page: number, extraArgs: any = {}): Promise<MangaPage> {
    return this.executeFeed('latest', page, extraArgs)
  }

  async searchManga(query: string, page: number, extraArgs: any = {}): Promise<MangaPage> {
    return this.executeFeed('search', page, extraArgs, query)
  }

  async fetchMangaDetails(manga: Manga): Promise<Manga> {
    const res: any = await DataService.executeExtension({
      pkg: this.pkg,
      code: this.extensionCode,
      contextArgs: { type: 'fetchMangaDetails', mangaUrl: manga.url }
    })
    if (res && res.data) {
      return { ...manga, ...normalizeManga(res.data) }
    }
    return manga
  }

  async fetchChapters(mangaUrl: string): Promise<Chapter[]> {
    const res: any = await DataService.executeExtension({
      pkg: this.pkg,
      code: this.extensionCode,
      contextArgs: { type: 'fetchChapters', mangaUrl }
    })
    return res?.data || []
  }

  async fetchPages(chapterUrl: string): Promise<string[]> {
    const res: any = await DataService.executeExtension({
      pkg: this.pkg,
      code: this.extensionCode,
      contextArgs: { type: 'fetchPages', chapterUrl }
    })
    return res?.pages || []
  }
}

export const ExtensionResolver = {
  async resolve(pkg: string): Promise<ISourceAdapter | null> {
    const resExt = await DataService.db.getExtension(pkg)
    const overrides = useExtensionStore.getState().domainOverrides
    const native = SourceRegistry.resolve(pkg, overrides)

    // 1. Check native compatibility
    if (native) {
      const dbVersion = resExt?.version || '0.0.0'
      const nativeVersion = native.version || '0.0.0'

      // If native is same or newer than installed, use it
      if (compareVersions(nativeVersion, dbVersion) >= 0) {
        return native
      }
    }

    // 2. Fallback to sandbox if code exists
    if ((resExt as any)?.code) {
      return new SandboxRunner(pkg, resExt as any)
    }

    // 3. Last fallback to native if no code
    if (native) return native

    return null
  }
}
