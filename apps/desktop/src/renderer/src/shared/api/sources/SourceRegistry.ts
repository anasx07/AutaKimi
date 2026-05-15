import { ISourceAdapter } from './types'
import {
  MadaraSource,
  IkenSource,
  MangaThemesiaSource,
  ZeistMangaSource
} from '@common/engines/sources'

export let generatedSourcesJson: Record<string, any> = {}

/**
 * Initializes the registry with metadata fetched from remote repositories
 */
export function setGeneratedSources(sources: Record<string, any> | any[]) {
  if (Array.isArray(sources)) {
    generatedSourcesJson = Object.fromEntries(sources.map((s) => [s.id, s]))
  } else {
    generatedSourcesJson = sources
  }
}

export class SourceRegistry {
  private static instances: Map<string, ISourceAdapter> = new Map()

  /**
   * Resolves a source by its package name, optionally applying domain overrides.
   */
  static resolve(pkg: string, overrides: Record<string, string> = {}): ISourceAdapter | null {
    if (this.instances.has(pkg)) {
      return this.instances.get(pkg)!
    }

    // 1. Check generated sources (Manga base classes)
    const meta = (generatedSourcesJson as any)[pkg]
    if (meta) {
      let instance: ISourceAdapter | undefined
      if (meta.baseClass === 'Madara') {
        instance = new MadaraSource(
          meta.id,
          meta.name,
          meta.version,
          meta.baseUrl,
          meta.lang,
          meta.id,
          false,
          meta.customSelectors
        )
      } else if (meta.baseClass === 'Iken') {
        instance = new IkenSource(
          meta.id,
          meta.name,
          meta.version,
          meta.baseUrl,
          meta.apiUrl || meta.baseUrl,
          meta.lang,
          meta.id
        )
      } else if (meta.baseClass === 'MangaThemesia') {
        instance = new MangaThemesiaSource(
          meta.id,
          meta.name,
          meta.version,
          meta.baseUrl,
          meta.lang,
          '',
          false,
          meta.customSelectors
        )
      } else if (meta.baseClass === 'ZeistManga') {
        instance = new ZeistMangaSource(meta.id, meta.name, meta.version, meta.baseUrl, meta.lang, meta.id)
      }

      if (instance) {
        this.applyDomainOverride(pkg, instance, overrides)
        this.instances.set(pkg, instance)
        return instance
      }
    }

    return null
  }

  /**
   * Alias for resolve for backward compatibility or direct native access.
   */
  static resolveNative(pkg: string, overrides: Record<string, string> = {}): ISourceAdapter | null {
    return this.resolve(pkg, overrides)
  }

  /**
   * Forces a reload of a source instance (useful if configuration changed).
   */
  static reload(pkg: string): void {
    this.instances.delete(pkg)
  }

  private static applyDomainOverride(
    pkg: string,
    instance: ISourceAdapter,
    overrides: Record<string, string>
  ) {
    const override = overrides[pkg]
    if (override && override.startsWith('http')) {
      instance.baseUrl = override
    }
  }
}
