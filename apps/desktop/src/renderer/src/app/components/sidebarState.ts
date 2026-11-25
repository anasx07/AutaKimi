export const SIDEBAR_COLLAPSE_STORAGE_KEY = 'autakimi-sidebar-collapsed'

/**
 * Resolves effective sidebar collapse state: preserves the user's normal preference while
 * auto-collapsing during inline anime watch mode unless temporarily overridden mid-watch.
 */
export function resolveSidebarCollapsedState(params: {
  userPrefCollapsed: boolean
  autoCollapsed: boolean
  watchOverride: boolean | null
}): boolean {
  if (!params.autoCollapsed) {
    return params.userPrefCollapsed
  }
  return params.watchOverride ?? true
}
