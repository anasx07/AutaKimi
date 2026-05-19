import { useState, useEffect, useCallback } from 'react'
import { NormalizedManga, normalizeManga } from '@common/utils/mangaNormalizer'
import { ExtensionResolver } from '@renderer/shared/api/sources/resolver'
import { useBrowseCacheStore } from '@renderer/shared/model'
import { useInfiniteScroll } from '@renderer/shared/lib'

interface UseMangaPaginationProps {
  activeExtension: string | null
  activeFeed: 'popular' | 'latest' | 'search'
  debouncedSearch: string
  filters: Record<string, string[]>
}

export function useMangaPagination({
  activeExtension,
  activeFeed,
  debouncedSearch,
  filters
}: UseMangaPaginationProps) {
  const {
    listCache,
    offsetCache,
    hasMoreCache,
    batchCountCache,
    setListCache,
    setOffsetCache,
    setHasMoreCache,
    setBatchCountCache,
    invalidateGroup
  } = useBrowseCacheStore()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [paginationError, setPaginationError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const searchToWatch = activeFeed === 'search' ? debouncedSearch : ''

  // Identity Caching Strategy: Generate a unique key for the current browsing context.
  // This is the industry-standard way (used by React Query/SWR) to prevent state leakage.
  const contextKey = `${activeExtension}:${activeFeed}:${searchToWatch}:${JSON.stringify(filters)}`

  // Derived state — tied to contextKey identity
  const mangaList = listCache.get(contextKey)?.data || []
  const offset = offsetCache[contextKey] || 0
  const hasMore = hasMoreCache[contextKey] !== false
  const lastBatchCount = batchCountCache[contextKey] || 0

  // Helper setters — keyed to the current context
  const setMangaList = (
    val: NormalizedManga[] | ((prev: NormalizedManga[]) => NormalizedManga[])
  ) => {
    const current = listCache.get(contextKey)?.data || []
    const next = typeof val === 'function' ? val(current) : val
    setListCache(contextKey, next)
  }

  const setOffset = (val: number | ((prev: number) => number)) => {
    const current = offsetCache[contextKey] || 0
    const next = typeof val === 'function' ? val(current) : val
    setOffsetCache(contextKey, next)
  }

  const setHasMore = (val: boolean) => {
    setHasMoreCache(contextKey, val)
  }

  const setLastBatchCount = (val: number) => {
    setBatchCountCache(contextKey, val)
  }

  // Use unified infinite scroll hook
  const lastElementRef = useInfiniteScroll({
    hasNextPage: hasMore,
    isFetchingNextPage: loading,
    fetchNextPage: () => {
      setOffset((prev) => prev + (lastBatchCount || (prev === 0 ? 15 : 10)))
    }
  })

  useEffect(() => {
    const fetchManga = async () => {
      if (!activeExtension) return

      // If we already have data for this identity, avoid unnecessary re-fetch
      if (mangaList.length > 0 && offset === 0) {
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)
      setPaginationError(null)

      try {
        const limit = offset === 0 ? 15 : 10
        const pkgParts = activeExtension.split('.')
        const extLang =
          pkgParts.length >= 5 ? pkgParts[4] : pkgParts.length >= 3 ? pkgParts[2] : 'all'

        const runner = await ExtensionResolver.resolve(activeExtension)
        if (!runner) {
          setError('Extension not found')
          setLoading(false)
          return
        }

        const page = Math.floor(offset / limit) + 1
        let res: any

        if (activeFeed === 'popular') {
          res = await runner.fetchPopular(page, { ...filters })
        } else if (activeFeed === 'latest') {
          res = await runner.fetchLatest(page, { ...filters })
        } else if (activeFeed === 'search') {
          res = await runner.searchManga(searchToWatch, page, { ...filters })
        }

        if (res && res.error && (res.error.includes('403') || res.error.includes('Forbidden'))) {
          const cfMsg = 'Access Blocked (Cloudflare). Use the Web View to resolve.'
          if (offset === 0) setError(cfMsg)
          else setPaginationError(cfMsg)
          return
        }

        if (res && res.manga) {
          const normalized = res.manga.map((m: any) => ({
            ...normalizeManga(m, extLang),
            pkg: activeExtension
          }))
          setMangaList((prev) => {
            if (offset === 0) return normalized
            const existingIds = new Set(prev.map((item) => item.id))
            const newItems = normalized.filter((item: any) => !existingIds.has(item.id))
            return [...prev, ...newItems]
          })
          setLastBatchCount(res.manga.length)
          setHasMore(res.hasNextPage)
        } else {
          if (offset === 0) setError('No content found')
          else setPaginationError('End of results')
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Source error'
        if (offset === 0) setError(msg)
        else setPaginationError(msg)
      } finally {
        setLoading(false)
      }
    }

    fetchManga()
  }, [contextKey, offset, refreshKey])

  const refresh = useCallback(async () => {
    invalidateGroup('browse_lists', contextKey)
    setOffset(0)
    setError(null)
    setPaginationError(null)
    setRefreshKey((prev) => prev + 1)
  }, [contextKey])

  const retryPagination = useCallback(async () => {
    setPaginationError(null)
    setRefreshKey((prev) => prev + 1)
  }, [])

  return {
    mangaList,
    loading,
    error,
    paginationError,
    hasMore,
    lastElementRef,
    refresh,
    retryPagination
  }
}
