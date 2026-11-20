import { useEffect, useRef } from 'react'

interface PreloadItem {
  url: string
  priority: number
}

const CONCURRENCY_LIMIT = 4

/**
 * Intelligent Progressive Image Preloader for Manga/Webtoon Reader.
 *
 * Prioritizes images relative to the user's current reading position:
 * 1. Immediate forward window: [currentPage, currentPage + 3] (Priority 1)
 * 2. Lookahead forward window: [currentPage + 4, currentPage + 7] (Priority 2)
 * 3. Rest of the chapter forward: [currentPage + 8, ...lastPage] (Priority 3)
 * 4. Backward window: [currentPage - 1, ...1] (Priority 4)
 *
 * Uses managed concurrency (4 simultaneous connections) and dynamically
 * re-prioritizes the pending queue whenever the user scrolls or jumps.
 */
export function useImagePreloader(
  pages: string[] = [],
  currentPage: number = 1
) {
  const loadedUrlsRef = useRef<Set<string>>(new Set())
  const activeCountRef = useRef(0)
  const queueRef = useRef<PreloadItem[]>([])
  const isCancelledRef = useRef(false)

  // Clear loaded set if chapter pages change completely
  const pagesKey = pages.slice(0, 3).join('|')
  useEffect(() => {
    loadedUrlsRef.current = new Set()
  }, [pagesKey])

  useEffect(() => {
    if (!pages || pages.length === 0) return
    isCancelledRef.current = false

    const total = pages.length
    // Convert 1-based currentPage to 0-based index
    const currIdx = Math.max(0, Math.min(total - 1, currentPage - 1))

    // 1. Build bounded prioritized sliding window (avoids clogging memory with 100+ images)
    const prioritizedIndices: { index: number; priority: number }[] = []

    // Priority 1: Current page and immediate 3 forward pages
    for (let i = currIdx; i < Math.min(total, currIdx + 4); i++) {
      prioritizedIndices.push({ index: i, priority: 1 })
    }

    // Priority 2: Next 3 forward lookahead pages
    for (let i = currIdx + 4; i < Math.min(total, currIdx + 7); i++) {
      prioritizedIndices.push({ index: i, priority: 2 })
    }

    // Priority 3: Bounded backward buffer (max 2 pages behind current reading position)
    for (let i = currIdx - 1; i >= Math.max(0, currIdx - 2); i--) {
      prioritizedIndices.push({ index: i, priority: 3 })
    }

    // Prune loadedUrls cache if it grows too large to free memory
    if (loadedUrlsRef.current.size > 25) {
      const activeWindowSet = new Set(
        pages.slice(Math.max(0, currIdx - 5), Math.min(total, currIdx + 10))
      )
      for (const loadedUrl of Array.from(loadedUrlsRef.current)) {
        if (!activeWindowSet.has(loadedUrl)) {
          loadedUrlsRef.current.delete(loadedUrl)
        }
      }
    }

    // 2. Filter out already loaded or currently fetching URLs
    const newQueue: PreloadItem[] = []
    for (const item of prioritizedIndices) {
      const url = pages[item.index]
      if (url && !loadedUrlsRef.current.has(url)) {
        newQueue.push({ url, priority: item.priority })
      }
    }

    queueRef.current = newQueue

    // 3. Queue Processor
    const processQueue = () => {
      if (isCancelledRef.current) return

      while (activeCountRef.current < CONCURRENCY_LIMIT && queueRef.current.length > 0) {
        const next = queueRef.current.shift()
        if (!next || loadedUrlsRef.current.has(next.url)) continue

        activeCountRef.current++
        const img = new Image()
        img.referrerPolicy = 'no-referrer'
        
        // Use browser fetchPriority if available
        if ('fetchPriority' in img) {
          ;(img as any).fetchPriority = next.priority <= 2 ? 'high' : 'low'
        }

        const handleComplete = () => {
          loadedUrlsRef.current.add(next.url)
          activeCountRef.current = Math.max(0, activeCountRef.current - 1)
          processQueue()
        }

        img.onload = handleComplete
        img.onerror = handleComplete
        img.src = next.url
      }
    }

    processQueue()

    return () => {
      isCancelledRef.current = true
    }
  }, [pages, currentPage])
}
