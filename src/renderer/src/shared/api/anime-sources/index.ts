import { ShahiidAnimeSource } from './native/ma.lmanwa.extension.ar.shahiidanime'
import { RistoAnimeSource } from './native/ma.lmanwa.extension.ar.ristoanime'
import { ISourceAdapter } from '../sources/types'
import { useExtensionStore } from '@renderer/shared/model'

export const animeSources: Record<string, new () => ISourceAdapter> = {
  'ma.lmanwa.extension.ar.shahiidanime': ShahiidAnimeSource,
  'ma.lmanwa.extension.ar.ristoanime': RistoAnimeSource,
}

const instances: Record<string, ISourceAdapter> = {}

export function getAnimeSource(pkg: string): ISourceAdapter | null {
  if (instances[pkg]) {
    return instances[pkg]
  }

  const SourceClass = animeSources[pkg]
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
