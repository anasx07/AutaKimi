import { TeamX } from './native/ma.lmanwa.extension.ar.teamx'
import { MangaLek } from './native/ma.lmanwa.extension.ar.mangalek'
import { MangaSwat } from './native/ma.lmanwa.extension.ar.mangaswat'
import { MangaDexSource } from './official/MangaDexSource'
import { ISourceAdapter } from './types'
import { useExtensionStore } from '@renderer/shared/model'

export { MangaDexSource }

export const nativeSources: Record<string, new () => ISourceAdapter> = {
  'ma.lmanwa.extension.ar.teamx': TeamX,
  'ma.lmanwa.extension.ar.mangalek': MangaLek,
  'ma.lmanwa.extension.ar.mangaswat': MangaSwat,
  'official.mangadex': MangaDexSource,
}

const instances: Record<string, ISourceAdapter> = {}

export function getNativeSource(pkg: string): ISourceAdapter | null {
  if (instances[pkg]) {
    return instances[pkg]
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
