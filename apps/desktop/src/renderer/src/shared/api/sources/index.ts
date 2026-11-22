import { SourceRegistry, generatedSourcesJson } from './SourceRegistry'
import { ISourceAdapter } from './types'

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
  const isAnime =
    meta?.type === 'anime' ||
    cleanPkg.includes('anime') ||
    fullPkg.includes('anime') ||
    cleanPkg.startsWith('ar.') ||
    fullPkg.includes('.ar.')

  if (isAnime) {
    return cleanPkg === 'ar.ristoanime' || fullPkg === 'ma.autakimi.extension.ar.ristoanime'
  }

  return !!meta
}

export function getNativeSource(pkg: string): ISourceAdapter | null {
  return SourceRegistry.resolveNative(pkg)
}
