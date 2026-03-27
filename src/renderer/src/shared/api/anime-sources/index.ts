import { ShahiidAnimeSource } from './native/ma.autakimi.extension.ar.shahiidanime'
import { RistoAnimeSource } from './native/ma.autakimi.extension.ar.ristoanime'
import { ISourceAdapter } from '../sources/types'
import { SourceRegistry } from '../sources/SourceRegistry'

// Register all anime native sources
SourceRegistry.register('ma.autakimi.extension.ar.shahiidanime', ShahiidAnimeSource)
SourceRegistry.register('ma.autakimi.extension.ar.ristoanime', RistoAnimeSource)

/** @deprecated Use SourceRegistry.resolveNative instead */
export function getAnimeSource(pkg: string): ISourceAdapter | null {
  return SourceRegistry.resolveNative(pkg)
}
