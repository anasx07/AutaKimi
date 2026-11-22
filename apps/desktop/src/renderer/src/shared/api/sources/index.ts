import { SourceRegistry, generatedSourcesJson } from './SourceRegistry'
import { ISourceAdapter } from './types'
import { isAnimeExtension } from '@renderer/shared/lib/constants'

export function reloadSource(pkg: string): void {
  SourceRegistry.reload(pkg)
}

export function isFullySupported(pkg?: string): boolean {
  if (!pkg) return false
  const cleanPkg = pkg.replace(/^ma\.autakimi\.extension\./, '')
  const fullPkg = pkg.startsWith('ma.autakimi.extension.') ? pkg : `ma.autakimi.extension.${pkg}`
  const meta =
    (generatedSourcesJson as any)[pkg] ||
    (generatedSourcesJson as any)[cleanPkg] ||
    (generatedSourcesJson as any)[fullPkg]

  if (meta) {
    if (meta.isFullySupported !== undefined) return Boolean(meta.isFullySupported)
    if (meta.status) return meta.status === 'supported'
  }

  // Anime source check: RistoAnime is currently the only fully supported anime extension
  const isAnime = isAnimeExtension({
    pkg: fullPkg,
    type: meta?.type
  })

  if (isAnime) {
    return cleanPkg === 'ar.ristoanime' || fullPkg === 'ma.autakimi.extension.ar.ristoanime'
  }

  // Arabic Manga: MangaSid is verified and fully supported
  if (cleanPkg === 'ar.mangasid' || fullPkg === 'ma.autakimi.extension.ar.mangasid') {
    return true
  }

  // Other manga sources: if explicitly marked WIP or not supported
  if (meta?.status === 'wip' || meta?.isFullySupported === false) {
    return false
  }

  return !!meta
}

export function getNativeSource(pkg: string): ISourceAdapter | null {
  return SourceRegistry.resolveNative(pkg)
}
