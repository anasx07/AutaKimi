import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { DataService } from '@renderer/shared/api'
import { ExtensionResolver } from '@renderer/shared/api/sources/resolver'
import { Chapter } from '@renderer/shared/api/sources/types'
import { NormalizedManga } from '@common/utils/mangaNormalizer'
import { HistoryEntry } from '@common/types'

export const mangaKeys = {
  all: ['manga'] as const,
  details: (id: string) => [...mangaKeys.all, 'details', id] as const,
  chapters: (id: string) => [...mangaKeys.all, 'chapters', id] as const,
  pages: (chapterId: string) => [...mangaKeys.all, 'pages', chapterId] as const,
  library: (type?: string) => [...mangaKeys.all, 'library', type].filter(Boolean),
  libraryInfinite: (type?: string) => [...mangaKeys.library(type), 'infinite'] as const,
  libraryCheck: (id: string) => [...mangaKeys.all, 'library-check', id] as const,
  history: (type?: string) => [...mangaKeys.all, 'history', type].filter(Boolean),
  historyInfinite: (type?: string) => [...mangaKeys.history(type), 'infinite'] as const,
  progress: (mangaId: string) => [...mangaKeys.all, 'progress', mangaId] as const
}

/**
 * Hook to fetch manga details with caching
 */
export function useMangaDetails(mangaId: string, pkg: string | null, mangaUrl?: string) {
  return useQuery({
    queryKey: mangaKeys.details(mangaId),
    queryFn: async () => {
      // 1. Check DB Cache
      const cached = (await DataService.db.getMangaCache(mangaId)) as NormalizedManga | null

      // 2. Fetch from extension if needed or to refresh
      if (pkg) {
        try {
          const runner = await ExtensionResolver.resolve(pkg)
          if (runner) {
            const urlToFetch = mangaUrl || cached?.url || mangaId
            const fresh = await runner.fetchMangaDetails({
              id: mangaId,
              url: urlToFetch,
              title: cached?.title || ''
            })
            if (fresh) {
              // Preserve existing title if fresh one is missing or "Untitled" or purely numeric
              const hasValidTitle =
                fresh.title && fresh.title !== 'Untitled' && !/^\d+$/.test(fresh.title)
              const finalManga = {
                ...cached,
                ...fresh,
                title: hasValidTitle ? fresh.title : cached?.title || fresh.title,
                pkg
              } as NormalizedManga
              // Save to cache asynchronously
              DataService.db.saveMangaCache(finalManga)
              return finalManga
            }
          }
        } catch (e) {
          console.error('Failed to fetch fresh manga details', e)
        }
      }

      if (!cached) throw new Error('Manga not found and no extension provided')
      return cached
    },
    enabled: !!mangaId,
    staleTime: 1000 * 60 * 60 // 1 hour for details
  })
}

/**
 * Hook to check if a manga is in library
 */
export function useIsMangaInLibrary(mangaId: string) {
  return useQuery({
    queryKey: mangaKeys.libraryCheck(mangaId),
    queryFn: async () => {
      try {
        const library = await DataService.db.getLibrary()
        return (library as NormalizedManga[]).some((m) => m.id === mangaId)
      } catch {
        return false
      }
    },
    enabled: !!mangaId,
    staleTime: 1000 * 60 // 1 minute
  })
}

/**
 * Hook to fetch chapters for a manga
 */
export function useMangaChapters(mangaId: string, pkg: string | null, mangaUrl?: string) {
  return useQuery({
    queryKey: mangaKeys.chapters(mangaId),
    queryFn: async () => {
      // 1. Get from DB
      const cached = await DataService.db.getChapters(mangaId)

      // 2. Refresh from extension if pkg provided
      if (pkg) {
        try {
          const runner = await ExtensionResolver.resolve(pkg)
          if (runner) {
            // We need the manga URL for the extension
            const manga = await DataService.db.getMangaCache(mangaId)
            const urlToFetch = mangaUrl || (manga as any)?.url || mangaId
            const fresh = await runner.fetchChapters(urlToFetch)
            if (fresh && fresh.length > 0) {
              await DataService.db.saveChapters({ mangaId, chapters: fresh })
              return fresh
            }
          }
        } catch (e) {
          console.error('Failed to fetch fresh chapters', e)
        }
      }
      return (cached as Chapter[]) || []
    },
    enabled: !!mangaId,
    staleTime: 1000 * 60 * 15 // 15 minutes for chapters
  })
}

/**
 * Hook to fetch user library (infinite scroll)
 */
export function useInfiniteLibraryItems(type?: 'manga' | 'anime') {
  return useInfiniteQuery({
    queryKey: mangaKeys.libraryInfinite(type),
    queryFn: async ({ pageParam = 0 }): Promise<NormalizedManga[]> => {
      try {
        const result = await DataService.db.getLibrary({
          limit: 50,
          offset: pageParam as number,
          type
        })
        return (result as NormalizedManga[]) || []
      } catch {
        return []
      }
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage || !Array.isArray(lastPage) || lastPage.length < 50) return undefined
      if (!allPages || !Array.isArray(allPages)) return undefined
      const totalItems = allPages.reduce((acc, page) => acc + (page?.length || 0), 0)
      return totalItems
    },
    staleTime: 1000 * 60 * 5
  })
}

/**
 * Hook to fetch user library
 */
export function useLibraryItems(type?: 'manga' | 'anime') {
  return useQuery({
    queryKey: mangaKeys.library(type),
    queryFn: async () => {
      try {
        const result = await DataService.db.getLibrary({ type })
        return (result as NormalizedManga[]) || []
      } catch {
        return []
      }
    },
    staleTime: 1000 * 60 * 5
  })
}

/**
 * Hook to fetch reading progress
 */
export function useReadingProgress(mangaId: string) {
  return useQuery({
    queryKey: mangaKeys.progress(mangaId),
    queryFn: () => DataService.db.getProgress(mangaId),
    enabled: !!mangaId
  })
}

/**
 * Hook to fetch history entries (infinite scroll)
 */
export function useInfiniteHistoryEntries(type?: 'manga' | 'anime') {
  return useInfiniteQuery({
    queryKey: mangaKeys.historyInfinite(type),
    queryFn: async ({ pageParam = 0 }): Promise<HistoryEntry[]> => {
      try {
        const result = await DataService.db.getHistory({
          limit: 50,
          offset: pageParam as number,
          type
        })
        return result || []
      } catch {
        return []
      }
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage || !Array.isArray(lastPage) || lastPage.length < 50) return undefined
      if (!allPages || !Array.isArray(allPages)) return undefined
      const totalItems = allPages.reduce((acc, page) => acc + (page?.length || 0), 0)
      return totalItems
    }
  })
}

/**
 * Hook to fetch history entries
 */
export function useHistoryEntries(type?: 'manga' | 'anime', limit = 50, offset = 0) {
  return useQuery({
    queryKey: [...mangaKeys.history(type), { limit, offset }],
    queryFn: async () => {
      try {
        const result = await DataService.db.getHistory({ limit, offset, type })
        return result || []
      } catch {
        return []
      }
    }
  })
}

/**
 * Hook to fetch chapter pages
 */
export function useChapterPages(mangaId: string, pkg: string, chapter: Chapter | null) {
  return useQuery({
    queryKey: mangaKeys.pages(chapter?.id || ''),
    queryFn: async () => {
      if (!chapter || !pkg) return []

      // 1. Check if downloaded
      try {
        const download = await DataService.download.getStatus({
          mangaId,
          chapterId: chapter.id
        })

        if (download && download.status === 'completed' && download.pageUrls) {
          const cachedUrls = JSON.parse(download.pageUrls)
          if (cachedUrls && cachedUrls.length > 0) {
            return cachedUrls.map((u: string) => u.replace(/^https?:\/\//, 'autakimi-cache://'))
          }
        }
      } catch (e) {
        console.warn('Download status check failed', e)
      }

      // 2. Fetch from extension
      const runner = await ExtensionResolver.resolve(pkg)
      if (!runner) throw new Error('Extension not found')
      const pages = await runner.fetchPages(chapter.url)
      return pages.map((u: string) => u.replace(/^https?:\/\//, 'autakimi-cache://'))
    },
    enabled: !!chapter && !!pkg,
    staleTime: 1000 * 60 * 60 * 24 // 24 hours
  })
}

/**
 * Mutation to toggle library status with optimistic updates
 */
export function useToggleLibrary() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (manga: NormalizedManga) => DataService.db.toggleLibrary(manga),
    onMutate: async (manga) => {
      const checkKey = mangaKeys.libraryCheck(manga.id)

      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey: checkKey })
      await queryClient.cancelQueries({ queryKey: mangaKeys.library() })

      // Snapshot the previous value
      const previousInLibrary = queryClient.getQueryData(checkKey)

      // Optimistically update to the new value
      queryClient.setQueryData(checkKey, (old: boolean | undefined) => !old)

      return { previousInLibrary }
    },
    onError: (err, manga, context) => {
      // Rollback on error
      if (context?.previousInLibrary !== undefined) {
        queryClient.setQueryData(mangaKeys.libraryCheck(manga.id), context.previousInLibrary)
      }
      console.error('Library toggle failed', err)
    },
    onSettled: (_data, _error, manga) => {
      // Always refetch after error or success to ensure we represent the server state
      queryClient.invalidateQueries({ queryKey: mangaKeys.library() })
      queryClient.invalidateQueries({ queryKey: mangaKeys.libraryCheck(manga.id) })
    }
  })
}
