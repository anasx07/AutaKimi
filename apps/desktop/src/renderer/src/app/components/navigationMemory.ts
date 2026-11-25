import type { Chapter, PartialManga } from '@common/types'

export interface SuspendedOverlayState {
  selectedManga: PartialManga
  activeChapter: Chapter | null
}

/**
 * Pure helper storing last visited `/browse/*` path and per-route suspended overlays so switching
 * tabs (e.g. Browse -> History -> Browse) restores where the user left off without wiping state.
 */
export class TabNavigationMemory {
  private lastBrowsePath = '/browse'
  private readonly suspendedOverlays = new Map<string, SuspendedOverlayState>()

  recordPath(pathname: string): void {
    if (pathname.startsWith('/browse')) {
      this.lastBrowsePath = pathname
    }
  }

  getLastBrowsePath(): string {
    return this.lastBrowsePath
  }

  resetBrowsePath(): void {
    this.lastBrowsePath = '/browse'
  }

  suspendOverlay(pathname: string, state: SuspendedOverlayState): void {
    this.suspendedOverlays.set(pathname, state)
  }

  consumeOverlay(pathname: string): SuspendedOverlayState | null {
    const entry = this.suspendedOverlays.get(pathname) || null
    if (entry) {
      this.suspendedOverlays.delete(pathname)
    }
    return entry
  }

  clearOverlay(pathname: string): void {
    this.suspendedOverlays.delete(pathname)
  }

  clearAll(): void {
    this.lastBrowsePath = '/browse'
    this.suspendedOverlays.clear()
  }
}

export const sharedTabNavigationMemory = new TabNavigationMemory()

/**
 * Resolves the target route when clicking the Browse sidebar tab:
 * - From another section (e.g. History), returns to the last `/browse/*` sub-route.
 * - From an already-open `/browse/:pkg` source page, steps back up to `/browse`.
 */
export function resolveBrowseNavTarget(currentPath: string, lastBrowsePath: string): string {
  if (currentPath.startsWith('/browse')) {
    return '/browse'
  }
  return lastBrowsePath || '/browse'
}
