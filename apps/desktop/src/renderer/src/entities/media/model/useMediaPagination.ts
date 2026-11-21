import { useState, useEffect, useCallback, useRef } from 'react'
import { NormalizedManga as Media, normalizeManga, isValidMediaCatalogItem } from '@common/utils/mangaNormalizer'
import { ExtensionResolver } from '@renderer/shared/api/sources/resolver'
import { useBrowseCacheStore } from '@renderer/shared/model'
import { useInfiniteScroll } from '@renderer/shared/lib'
import { isAnimeExtension } from '@renderer/shared/lib/constants'

export interface UseMediaPaginationProps {
  activeExtension: string | null
  activeFeed: 'popular' | 'latest' | 'search'
  debouncedSearch: string
  filters: Record<string, string[]>
}

export function useMediaPagination({
  activeExtension,
  activeFeed,
  debouncedSearch,
  filters
}: UseMediaPaginationProps) {
  const {
    listCache,
    pageCache,
    hasMoreCache,
    setListCache,
    setPageCache,
    setHasMoreCache,
    invalidateGroup
  } = useBrowseCacheStore()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [paginationError, setPaginationError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const searchToWatch = activeFeed === 'search' ? debouncedSearch : ''

  // Identity Caching Strategy: Generate a unique key for the current browsing context.
  const contextKey = `${activeExtension}:${activeFeed}:${searchToWatch}:${JSON.stringify(filters)}`

  // Derived state — tied to contextKey identity
  const mediaList = listCache.get(contextKey)?.data || []
  const page = pageCache[contextKey] || 1
  const hasMore = hasMoreCache[contextKey] !== false

  const isInitialMountForContext = useRef<string>('')
  const lastFetchedPageRef = useRef<number>(0)

  // Helper setters — keyed to the current context
  const setMediaList = (
    val: Media[] | ((prev: Media[]) => Media[])
  ) => {
    const current = listCache.get(contextKey)?.data || []
    const next = typeof val === 'function' ? val(current) : val
    setListCache(contextKey, next)
  }

  const setPage = (val: number | ((prev: number) => number)) => {
    const current = pageCache[contextKey] || 1
    const next = typeof val === 'function' ? val(current) : val
    setPageCache(contextKey, next)
  }

  const setHasMore = (val: boolean) => {
    setHasMoreCache(contextKey, val)
  }

  // Use unified infinite scroll hook
  const lastElementRef = useInfiniteScroll({
    hasNextPage: hasMore,
    isFetchingNextPage: loading,
    fetchNextPage: () => {
      setPage((prev) => prev + 1)
    }
  })

  useEffect(() => {
    const fetchMedia = async () => {
      if (!activeExtension) return

      // If switching to an already loaded context, avoid unnecessary re-fetch
      if (isInitialMountForContext.current !== contextKey) {
        isInitialMountForContext.current = contextKey
        if (mediaList.length > 0) {
          lastFetchedPageRef.current = page
          setLoading(false)
          return
        }
      } else if (mediaList.length > 0 && lastFetchedPageRef.current === page) {
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)
      setPaginationError(null)

      try {
        const pkgParts = activeExtension.split('.')
        const extLang =
          pkgParts.length >= 5 ? pkgParts[4] : pkgParts.length >= 3 ? pkgParts[2] : 'all'

        const runner = await ExtensionResolver.resolve(activeExtension)
        if (!runner) {
          setError('Extension not found')
          setLoading(false)
          return
        }

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
          if (page === 1) setError(cfMsg)
          else setPaginationError(cfMsg)
          return
        }

        if (res && res.manga) {
          const isAnimeExt = isAnimeExtension({ pkg: activeExtension })
          const validManga = res.manga.filter(isValidMediaCatalogItem)
          const normalized = validManga.map((m: any) => ({
            ...normalizeManga(m, extLang),
            pkg: activeExtension,
            mediaType: m.mediaType || (isAnimeExt ? 'anime' : 'manga')
          }))
          setMediaList((prev) => {
            if (page === 1) return normalized
            const existingIds = new Set(prev.map((item) => item.id))
            const newItems = normalized.filter((item: any) => !existingIds.has(item.id))
            return [...prev, ...newItems]
          })
          lastFetchedPageRef.current = page
          setHasMore(Boolean(res.hasNextPage))
        } else {
          if (page === 1) setError('No content found')
          else setPaginationError('End of results')
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Source error'
        if (page === 1) setError(msg)
        else setPaginationError(msg)
      } finally {
        setLoading(false)
      }
    }

    fetchMedia()
  }, [contextKey, page, refreshKey])

  const refresh = useCallback(async () => {
    invalidateGroup('browse_lists', contextKey)
    setPage(1)
    lastFetchedPageRef.current = 0
    setError(null)
    setPaginationError(null)
    setRefreshKey((prev) => prev + 1)
  }, [contextKey])

  const retryPagination = useCallback(async () => {
    setPaginationError(null)
    lastFetchedPageRef.current = 0
    setRefreshKey((prev) => prev + 1)
  }, [])

  return {
    mediaList,
    mangaList: mediaList,
    loading,
    error,
    paginationError,
    hasMore,
    lastElementRef,
    refresh,
    retryPagination
  }
}

export const useMangaPagination = useMediaPagination
