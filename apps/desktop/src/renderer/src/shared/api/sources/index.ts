import { SourceRegistry, generatedSourcesJson } from './SourceRegistry'
import { ISourceAdapter } from './types'

export function reloadSource(pkg: string): void {
  SourceRegistry.reload(pkg)
}

export function isFullySupported(pkg?: string): boolean {
  if (!pkg) return false
  const cleanPkg = pkg.replace(/^ma\.autakimi\.extension\./, '')
  const fullPkg = pkg.startsWith('ma.autakimi.extension.') ? pkg : `ma.autakimi.extension.${pkg}`
  return !!(
    (generatedSourcesJson as any)[pkg] ||
    (generatedSourcesJson as any)[cleanPkg] ||
    (generatedSourcesJson as any)[fullPkg]
  )
}

export function getNativeSource(pkg: string): ISourceAdapter | null {
  return SourceRegistry.resolveNative(pkg)
}
