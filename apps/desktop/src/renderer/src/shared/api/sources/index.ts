import { SourceRegistry, generatedSourcesJson } from './SourceRegistry'
import { ISourceAdapter } from './types'

export function reloadSource(pkg: string): void {
  SourceRegistry.reload(pkg)
}

export function isFullySupported(pkg: string): boolean {
  // All sources are now loaded dynamically from remote repositories.
  // A source is "supported" if its metadata exists in the merged registry.
  return !!(generatedSourcesJson as any)[pkg]
}

export function getNativeSource(pkg: string): ISourceAdapter | null {
  return SourceRegistry.resolveNative(pkg)
}
