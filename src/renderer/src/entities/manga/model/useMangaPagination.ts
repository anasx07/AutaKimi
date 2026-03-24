import { useState, useEffect, useCallback } from 'react'
import { NormalizedManga, normalizeManga } from '@common/utils/mangaNormalizer'
import { ExtensionResolver } from '@renderer/shared/api/sources/resolver'
import { useBrowseCacheStore } from '@renderer/shared/model'

interface UseMangaPaginationProps {
  activeExtension: string | null
  activeFeed: 'popular' | 'latest' | 'search'
  debouncedSearch: string
  filters: {
    selectedDemographics: string[]
    selectedStatus: string[]
    selectedTags: string[]
  }
}

export function useMangaPagination({ 
  activeExtension, 
  activeFeed, 
  debouncedSearch,
  filters
}: UseMangaPaginationProps) {
  const { 
    listCache, offsetCache, hasMoreCache, batchCountCache,
    setListCache, setOffsetCache, setHasMoreCache, setBatchCountCache,
    clearFeedCache
  } = useBrowseCacheStore()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [paginationError, setPaginationError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const searchToWatch = activeFeed === 'search' ? debouncedSearch : ''

  // Derived state
  const mangaList = listCache[activeFeed] || []
  const offset = offsetCache[activeFeed] || 0
  const hasMore = hasMoreCache[activeFeed] !== false
  const lastBatchCount = batchCountCache[activeFeed] || 0

  // Helper setters that transparently update the current feed cache
  const setMangaList = (val: NormalizedManga[] | ((prev: NormalizedManga[]) => NormalizedManga[])) => {
    const current = listCache[activeFeed] || []
    const next = typeof val === 'function' ? val(current) : val
    setListCache(activeFeed, next)
  }

  const setOffset = (val: number | ((prev: number) => number)) => {
    const current = offsetCache[activeFeed] || 0
    const next = typeof val === 'function' ? val(current) : val
    setOffsetCache(activeFeed, next)
  }

  const setHasMore = (val: boolean) => {
    setHasMoreCache(activeFeed, val)
  }

  const setLastBatchCount = (val: number) => {
    setBatchCountCache(activeFeed, val)
  }

  // Intersection Observer callback
  const lastElementRef = useCallback((node: HTMLDivElement | null) => {
    if (loading) return
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setOffset(prev => prev + (lastBatchCount || (prev === 0 ? 15 : 10)))
      }
    })
    if (node) observer.observe(node)
    return () => observer.disconnect()
  }, [loading, hasMore, lastBatchCount])

  // Consolidate filter reset logic
  useEffect(() => {
    // Reset ALL caches when filters or extension changes
    clearFeedCache()
  }, [activeExtension, filters, searchToWatch])

  useEffect(() => {
    const fetchManga = async () => {
      if (!activeExtension) return
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
        const extLang = pkgParts.length >= 5 ? pkgParts[4] : (pkgParts.length >= 3 ? pkgParts[2] : 'all')
        
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
        } else if (activeFeed === 'latest' && runner.fetchLatest) {
          res = await runner.fetchLatest(page, { ...filters })
        } else if (activeFeed === 'search') {
          res = await runner.searchManga(searchToWatch, page, { ...filters })
        }

          if (res && res.error && (res.error.includes('403') || res.error.includes('Forbidden'))) {
            const cfMsg = 'Cloudflare block detected. Please use the Shield icon to solve the challenge.'
            if (offset === 0) setError(cfMsg)
            else setPaginationError(cfMsg)
            return
          }
          
          if (res && res.manga) {
          const normalized = res.manga.map((m: any) => ({
            ...normalizeManga(m, extLang),
            pkg: activeExtension
          }))
          setMangaList(prev => {
            if (offset === 0) return normalized
            const existingIds = new Set(prev.map(item => item.id))
            const newItems = normalized.filter((item: any) => !existingIds.has(item.id))
            return [...prev, ...newItems]
          })
          setLastBatchCount(res.manga.length)
          setHasMore(res.hasNextPage)
        } else {
          if (offset === 0) {
            setError(res?.manga ? 'No data returned' : 'Malformed response')
          } else {
            setPaginationError('Failed to load next page')
          }
        }
      } catch (err) {
        let msg = err instanceof Error ? err.message : 'Error fetching manga'
        if (msg.includes('403') || msg.toLowerCase().includes('forbidden')) {
          msg = 'Access Blocked (403). Try solving the Cloudflare challenge in Web View.'
        }
        
        if (offset === 0) {
          setError(msg)
        } else {
          setPaginationError(msg)
        }
      } finally {
        setLoading(false)
      }
    }

    fetchManga()
  }, [activeExtension, activeFeed, searchToWatch, filters, offset, refreshKey])

  const refresh = useCallback(async () => {
    clearFeedCache()
    setOffset(0)
    setError(null)
    setPaginationError(null)
    setRefreshKey(prev => prev + 1)
  }, [clearFeedCache, activeFeed])

  const retryPagination = useCallback(async () => {
    setPaginationError(null)
    setRefreshKey(prev => prev + 1)
  }, [])

  return { mangaList, loading, error, paginationError, hasMore, lastElementRef, refresh, retryPagination }
}
