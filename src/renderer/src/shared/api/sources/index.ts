import { TeamX } from './native/ma.lmanwa.extension.ar.teamx'
import { MangaLek } from './native/ma.lmanwa.extension.ar.mangalek'
import { MangaSwat } from './native/ma.lmanwa.extension.ar.mangaswat'
import { MangaDexSource } from './official/MangaDexSource'
import { ISourceAdapter } from './types'
import generatedSourcesJson from './generated.json'
import { SourceRegistry } from './SourceRegistry'

// Register all manga native sources
SourceRegistry.register('ma.lmanwa.extension.ar.teamx', TeamX)
SourceRegistry.register('ma.lmanwa.extension.ar.mangalek', MangaLek)
SourceRegistry.register('ma.lmanwa.extension.ar.mangaswat', MangaSwat)
SourceRegistry.register('official.mangadex', MangaDexSource)

export { MangaDexSource }

export function isFullySupported(pkg: string): boolean {
  return [
    'ma.lmanwa.extension.ar.mangaswat',
    'ma.lmanwa.extension.ar.teamx'
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
