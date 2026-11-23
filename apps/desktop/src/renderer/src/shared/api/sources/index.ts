import { SourceRegistry, generatedSourcesJson } from './SourceRegistry'
import { ISourceAdapter } from './types'

export function reloadSource(pkg: string): void {
  SourceRegistry.reload(pkg)
}

/**
 * Determines if an extension is fully supported based on its metadata.
 * Driven dynamically by the extension's own config/manifest from autakimi-extensions.
 */
export function isFullySupported(
  pkgOrExt?: string | { pkg?: string; id?: string; status?: string; isFullySupported?: boolean }
): boolean {
  if (!pkgOrExt) return false

  // 1. Direct object inspection (e.g. from catalog or active extension instance)
  if (typeof pkgOrExt === 'object') {
    if (pkgOrExt.isFullySupported !== undefined) return Boolean(pkgOrExt.isFullySupported)
    if (pkgOrExt.status !== undefined) return pkgOrExt.status === 'supported'
  }

  // 2. Package string lookup in generatedSourcesJson (catalog metadata cache)
  const pkg = typeof pkgOrExt === 'string' ? pkgOrExt : pkgOrExt.pkg || pkgOrExt.id
  if (!pkg) return false

  const cleanPkg = pkg.replace(/^ma\.autakimi\.extension\./, '')
  const fullPkg = pkg.startsWith('ma.autakimi.extension.') ? pkg : `ma.autakimi.extension.${pkg}`
  const meta =
    (generatedSourcesJson as any)[pkg] ||
    (generatedSourcesJson as any)[cleanPkg] ||
    (generatedSourcesJson as any)[fullPkg]

  if (meta) {
    if (meta.isFullySupported !== undefined) return Boolean(meta.isFullySupported)
    if (meta.status !== undefined) return meta.status === 'supported'
  }

  return false
}

export function getNativeSource(pkg: string): ISourceAdapter | null {
  return SourceRegistry.resolveNative(pkg)
}
