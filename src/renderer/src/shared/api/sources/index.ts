import { TeamX } from './native/ma.autakimi.extension.ar.teamx'
import { MangaLek } from './native/ma.autakimi.extension.ar.mangalek'
import { MangaSwat } from './native/ma.autakimi.extension.ar.mangaswat'
import { MangaDexSource } from './official/MangaDexSource'
import { MangaSid } from './native/ma.autakimi.extension.ar.mangasid'
import { ISourceAdapter } from './types'
import { SourceRegistry, generatedSourcesJson } from './SourceRegistry'

// Register all manga native sources
SourceRegistry.register('ma.autakimi.extension.ar.teamx', TeamX)
SourceRegistry.register('ma.autakimi.extension.ar.mangalek', MangaLek)
SourceRegistry.register('ma.autakimi.extension.ar.mangaswat', MangaSwat)
SourceRegistry.register('ma.autakimi.extension.ar.mangasid', MangaSid)
SourceRegistry.register('official.mangadex', MangaDexSource)

export { MangaDexSource }

export function isFullySupported(pkg: string): boolean {
  return [
    'ma.autakimi.extension.ar.mangaswat',
    'ma.autakimi.extension.ar.teamx'
  ].includes(pkg) || !!(generatedSourcesJson as any)[pkg]
}

/** @deprecated Use SourceRegistry.resolveNative instead */
export function getNativeSource(pkg: string): ISourceAdapter | null {
  return SourceRegistry.resolveNative(pkg)
}

/** @deprecated Use SourceRegistry.reload instead */
export function reloadSource(pkg: string) {
  SourceRegistry.reload(pkg)
}
