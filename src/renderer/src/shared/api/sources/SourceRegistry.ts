import { ISourceAdapter } from './types'
import { MadaraSource } from './base/MadaraSource'
import { IkenSource } from './base/IkenSource'
import { MangaThemesiaSource } from './base/MangaThemesiaSource'
import { ZeistMangaSource } from './base/ZeistMangaSource'
import { ShahiidAnimeSource } from '../anime-sources/native/ma.autakimi.extension.ar.shahiidanime'
import { RistoAnimeSource } from '../anime-sources/native/ma.autakimi.extension.ar.ristoanime'
import { metadataModules } from './catalog/generated-local'

export const generatedSourcesJson = Object.assign(
  {},
  ...Object.values(metadataModules).map((m: any) => m.default || m)
)

export class SourceRegistry {
  private static instances: Map<string, ISourceAdapter> = new Map()
  private static nativeRegistry: Map<string, new () => ISourceAdapter> = new Map()

  static register(pkg: string, SourceClass: new () => ISourceAdapter) {
    this.nativeRegistry.set(pkg, SourceClass)
  }

  static resolveNative(pkg: string, overrides: Record<string, string> = {}): ISourceAdapter | null {
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
        instance = new ZeistMangaSource(
          meta.id,
          meta.name,
          meta.version,
          meta.baseUrl,
          meta.lang,
          meta.id
        )
      }

      if (instance) {
        this.applyDomainOverride(pkg, instance, overrides)
        this.instances.set(pkg, instance)
        return instance
      }
    }

    // 2. Check native registry (Handwritten sources)
    const SourceClass = this.nativeRegistry.get(pkg)
    if (SourceClass) {
      const instance = new SourceClass()
      this.applyDomainOverride(pkg, instance, overrides)
      this.instances.set(pkg, instance)
      return instance
    }

    return null
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

  static reload(pkg: string) {
    this.instances.delete(pkg)
  }
}

// ─── Manual Native Registration ─────────────────────────────────────────────
SourceRegistry.register('ma.autakimi.extension.ar.shahiidanime', ShahiidAnimeSource)
SourceRegistry.register('ma.autakimi.extension.ar.ristoanime', RistoAnimeSource)
