import { ShahiidAnimeSource } from './native/ma.autakimi.extension.ar.shahiidanime'
import { RistoAnimeSource } from './native/ma.autakimi.extension.ar.ristoanime'
import { ISourceAdapter } from '../sources/types'
import { SourceRegistry } from '../sources/SourceRegistry'
import { useExtensionStore } from '@renderer/shared/model'

// Register all anime native sources
SourceRegistry.register('ma.autakimi.extension.ar.shahiidanime', ShahiidAnimeSource)
SourceRegistry.register('ma.autakimi.extension.ar.ristoanime', RistoAnimeSource)


