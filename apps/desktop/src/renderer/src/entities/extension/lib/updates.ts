import { compareVersions } from '../../../shared/lib/version'
import type { ExtensionMetadata } from '../../../shared/model/extension.store'

/**
 * Computes the list of extensions that have a newer version available in the remote catalog.
 * Returns the remote catalog entry (preserving `installed.pkg`) so that clicking Update
 * installs the latest remote version and code rather than re-installing the stale installed entry.
 */
export function computeAvailableUpdates(
  installedExtensions: ExtensionMetadata[],
  catalog: ExtensionMetadata[]
): ExtensionMetadata[] {
  if (!Array.isArray(catalog) || !Array.isArray(installedExtensions)) return []

  const updates: ExtensionMetadata[] = []

  for (const installed of installedExtensions) {
    if (!installed || !installed.pkg) continue
    const remote = catalog.find(
      (c) => c && (c.pkg === installed.pkg || (c as { id?: string }).id === installed.pkg)
    )
    if (!remote) continue

    const remoteVersion = remote.version || '0.0.0'
    const installedVersion = installed.version || '0.0.0'
    if (compareVersions(remoteVersion, installedVersion) > 0) {
      updates.push({
        ...remote,
        pkg: installed.pkg
      })
    }
  }

  return updates
}
