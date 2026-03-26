import { TeamX } from './native/ma.lmanwa.extension.ar.teamx'
import { MangaLek } from './native/ma.lmanwa.extension.ar.mangalek'
import { MangaSwat } from './native/ma.lmanwa.extension.ar.mangaswat'
import { MangaDexSource } from './official/MangaDexSource'
import { ISourceAdapter } from './types'
import { useExtensionStore } from '@renderer/shared/model'
import { MadaraSource } from './base/MadaraSource'
import { IkenSource } from './base/IkenSource'
import { MangaThemesiaSource } from './base/MangaThemesiaSource'
import { ZeistMangaSource } from './base/ZeistMangaSource'
import generatedSourcesJson from './generated.json'

export { MangaDexSource }

export const nativeSources: Record<string, new () => ISourceAdapter> = {
  'ma.lmanwa.extension.ar.teamx': TeamX,
  'ma.lmanwa.extension.ar.mangalek': MangaLek,
  'ma.lmanwa.extension.ar.mangaswat': MangaSwat,
  'official.mangadex': MangaDexSource,
}

export function isFullySupported(pkg: string): boolean {
  return [
    'ma.lmanwa.extension.ar.mangaswat',
    'ma.lmanwa.extension.ar.teamx'
  ].includes(pkg) || !!(generatedSourcesJson as any)[pkg]
}

const instances: Record<string, ISourceAdapter> = {}

export function getNativeSource(pkg: string): ISourceAdapter | null {
  if (instances[pkg]) {
    return instances[pkg]
  }

  const meta = (generatedSourcesJson as any)[pkg]
  if (meta) {
    let instance: ISourceAdapter
    if (meta.baseClass === 'Madara') {
      instance = new MadaraSource(meta.id, meta.name, meta.version, meta.baseUrl, meta.lang, meta.id, false, meta.customSelectors)
    } else if (meta.baseClass === 'Iken') {
      instance = new IkenSource(meta.id, meta.name, meta.version, meta.baseUrl, meta.apiUrl || meta.baseUrl, meta.lang, meta.id)
    } else if (meta.baseClass === 'MangaThemesia') {
      instance = new MangaThemesiaSource(meta.id, meta.name, meta.version, meta.baseUrl, meta.lang, '', false, meta.customSelectors)
    } else if (meta.baseClass === 'ZeistManga') {
      instance = new ZeistMangaSource(meta.id, meta.name, meta.version, meta.baseUrl, meta.lang, meta.id)
    } else {
      return null
    }

    const override = useExtensionStore.getState().domainOverrides[pkg]
    if (override && override.startsWith('http')) {
      instance.baseUrl = override
    }
    instances[pkg] = instance
    return instance
  }

  const SourceClass = nativeSources[pkg]
  if (SourceClass) {
    const instance = new SourceClass()
    
    // Apply domain override if exists
    const override = useExtensionStore.getState().domainOverrides[pkg]
    if (override && override.startsWith('http')) {
      instance.baseUrl = override
    }

    instances[pkg] = instance
    return instance
  }
  return null
}

export function reloadSource(pkg: string) {
  if (instances[pkg]) {
    delete instances[pkg]
  }
}
