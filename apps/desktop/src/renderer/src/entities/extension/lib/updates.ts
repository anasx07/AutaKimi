import { compareVersions } from '../../../shared/lib/version'
import type { ExtensionMetadata } from '../../../shared/model/extension.store'
import {
  buildScopedPkg,
  extractBasePkg,
  getRepoMeta,
  normalizeRepoKey
} from '../../../../../../../../packages/sdk/src/services/repoIdentity'

function catalogMatchesPkg(c: ExtensionMetadata | undefined, targetPkg: string): boolean {
  if (!c) return false
  const cPkg = extractBasePkg(c.pkg)
  const cId = extractBasePkg((c as { id?: string }).id)
  return cPkg === targetPkg || cId === targetPkg
}

/**
 * Finds the installed extension entry corresponding to a catalog item, scoped by repository URL.
 * Supports legacy rows (where `repoUrl` is empty or `'remote'`/`'local'`) when exact `pkg` matches.
 */
export function findInstalledMatch(
  catalogExt: ExtensionMetadata,
  installedExtensions: ExtensionMetadata[]
): ExtensionMetadata | undefined {
  if (!catalogExt || !Array.isArray(installedExtensions)) return undefined
  const basePkg = extractBasePkg(catalogExt.pkg || (catalogExt as { id?: string }).id)
  const catRepoKey = normalizeRepoKey(catalogExt.repoUrl)

  if (catRepoKey) {
    const exact = installedExtensions.find(
      (i) => i && extractBasePkg(i.pkg) === basePkg && normalizeRepoKey(i.repoUrl) === catRepoKey
    )
    if (exact) return exact
  }

  // Legacy fallback: installed before repoUrl column existed
  return installedExtensions.find(
    (i) => i && !normalizeRepoKey(i.repoUrl) && (i.pkg === basePkg || i.pkg === catalogExt.pkg)
  )
}

/**
 * Resolves the installation payload for Option A (multi-repo coexistence).
 * If the exact same `pkg` is already installed from another repository, scopes the new copy
 * as `pkg::repoHash` so both can remain installed side-by-side without overwriting each other.
 */
export function resolveInstallPayload(
  catalogExt: ExtensionMetadata,
  installedExtensions: ExtensionMetadata[]
): ExtensionMetadata {
  const existingForRepo = findInstalledMatch(catalogExt, installedExtensions)
  const meta = getRepoMeta(catalogExt.repoUrl, catalogExt.repoName)

  if (existingForRepo) {
    return {
      ...catalogExt,
      pkg: existingForRepo.pkg,
      repoName: catalogExt.repoName || meta.repoName,
      repoColor: catalogExt.repoColor || meta.repoColor
    }
  }

  const basePkg = extractBasePkg(catalogExt.pkg || (catalogExt as { id?: string }).id)
  const hasConflict = (installedExtensions || []).some(
    (i) => i && extractBasePkg(i.pkg) === basePkg
  )

  const targetPkg =
    hasConflict && catalogExt.repoUrl ? buildScopedPkg(basePkg, catalogExt.repoUrl) : basePkg

  return {
    ...catalogExt,
    pkg: targetPkg,
    repoName: catalogExt.repoName || meta.repoName,
    repoColor: catalogExt.repoColor || meta.repoColor
  }
}

/**
 * Computes the list of extensions that have a newer version available in their owning repository.
 * Strictly compares each installed extension against the matching repo in `catalog` so different
 * repositories never conflict over version numbers.
 */
export function computeAvailableUpdates(
  installedExtensions: ExtensionMetadata[],
  catalog: ExtensionMetadata[]
): ExtensionMetadata[] {
  if (!Array.isArray(catalog) || !Array.isArray(installedExtensions)) return []

  const updates: ExtensionMetadata[] = []

  for (const installed of installedExtensions) {
    if (!installed || !installed.pkg) continue
    const instBasePkg = extractBasePkg(installed.pkg)
    const instRepoKey = normalizeRepoKey(installed.repoUrl)

    const remote = instRepoKey
      ? catalog.find(
          (c) => catalogMatchesPkg(c, instBasePkg) && normalizeRepoKey(c.repoUrl) === instRepoKey
        )
      : catalog.find((c) => catalogMatchesPkg(c, instBasePkg))

    if (!remote) continue

    const remoteVersion = remote.version || '0.0.0'
    const installedVersion = installed.version || '0.0.0'
    if (compareVersions(remoteVersion, installedVersion) > 0) {
      const meta = getRepoMeta(remote.repoUrl, remote.repoName)
      updates.push({
        ...remote,
        pkg: installed.pkg,
        repoName: remote.repoName || meta.repoName,
        repoColor: remote.repoColor || meta.repoColor
      })
    }
  }

  return updates
}
