export interface PageDimensions {
  width: number
  height: number
}

export type PageDimensionsMap = Readonly<Record<number, PageDimensions | undefined>>

/**
 * Returns true when an image has valid natural dimensions whose width exceeds its height
 * (indicating a double-page spread in manga/comic layouts).
 */
export function isWideSpreadDimensions(dims?: PageDimensions | null): boolean {
  if (!dims) return false
  return dims.width > 0 && dims.height > 0 && dims.width > dims.height
}

/**
 * Partitions 1-based chapter pages into spreads for Double-Page reading modes:
 * - Page 1 is always displayed solo as the cover page.
 * - Any page with `naturalWidth > naturalHeight` is placed alone in a solo wide spread.
 * - If page `p` is portrait/square but `p + 1` is a wide spread, page `p` is placed alone
 *   so `p + 1` is not paired with it and can render full-width on the next turn.
 */
export function buildDoublePageSpreads(
  totalPages: number,
  pageDimensions?: PageDimensionsMap
): number[][] {
  if (totalPages <= 0) return []

  const spreads: number[][] = [[1]]
  let page = 2

  while (page <= totalPages) {
    if (isWideSpreadDimensions(pageDimensions?.[page])) {
      spreads.push([page])
      page += 1
      continue
    }

    const nextPage = page + 1
    if (nextPage <= totalPages && !isWideSpreadDimensions(pageDimensions?.[nextPage])) {
      spreads.push([page, nextPage])
      page += 2
    } else {
      spreads.push([page])
      page += 1
    }
  }

  return spreads
}

export interface DoublePageSlot {
  /** 1-based page numbers belonging to the active spread (length 1 or 2). */
  pages: number[]
  /** Zero-based index of the active spread in `buildDoublePageSpreads`. */
  spreadIndex: number
  /** True when the active spread consists of a single wide-spread page. */
  isWideSpread: boolean
}

/**
 * Resolves the active double-page spread slot containing `currentPage`.
 */
export function getDoublePageSlot(
  totalPages: number,
  currentPage: number,
  pageDimensions?: PageDimensionsMap
): DoublePageSlot {
  const spreads = buildDoublePageSpreads(totalPages, pageDimensions)
  if (spreads.length === 0) {
    return { pages: [], spreadIndex: -1, isWideSpread: false }
  }

  const clampedPage = Math.max(1, Math.min(totalPages, currentPage))
  const spreadIndex = spreads.findIndex((pair) => pair.includes(clampedPage))
  const resolvedIndex = spreadIndex !== -1 ? spreadIndex : 0
  const pages = spreads[resolvedIndex]

  return {
    pages,
    spreadIndex: resolvedIndex,
    isWideSpread: pages.length === 1 && isWideSpreadDimensions(pageDimensions?.[pages[0]])
  }
}

/**
 * Returns the starting 1-based page number of the next spread after `currentPage`.
 */
export function getNextDoublePage(
  totalPages: number,
  currentPage: number,
  pageDimensions?: PageDimensionsMap
): number {
  const spreads = buildDoublePageSpreads(totalPages, pageDimensions)
  if (spreads.length === 0) return currentPage

  const clampedPage = Math.max(1, Math.min(totalPages, currentPage))
  const idx = spreads.findIndex((pair) => pair.includes(clampedPage))
  if (idx === -1 || idx + 1 >= spreads.length) return clampedPage
  return spreads[idx + 1][0]
}

/**
 * Returns the starting 1-based page number of the previous spread before `currentPage`.
 */
export function getPrevDoublePage(
  totalPages: number,
  currentPage: number,
  pageDimensions?: PageDimensionsMap
): number {
  const spreads = buildDoublePageSpreads(totalPages, pageDimensions)
  if (spreads.length === 0) return currentPage

  const clampedPage = Math.max(1, Math.min(totalPages, currentPage))
  const idx = spreads.findIndex((pair) => pair.includes(clampedPage))
  if (idx <= 0) return spreads[0][0]
  return spreads[idx - 1][0]
}
