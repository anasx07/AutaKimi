import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { DataService } from '@renderer/shared/api'
import { useUIStore } from '@renderer/shared/model'
import { ExtensionResolver } from '@renderer/shared/api/sources/resolver'
import { Chapter } from '@renderer/shared/api/sources/types'
import { NormalizedManga as Media, NormalizedManga } from '@common/utils/mangaNormalizer'
import { HistoryEntry } from '@common/types'

export type MediaType = 'manga' | 'anime'

export const mediaKeys = {
  all: ['media'] as const,
  details: (type: MediaType | string, id: string) => [...mediaKeys.all, type, 'details', id] as const,
  items: (type: MediaType | string, id: string) => [...mediaKeys.all, type, 'items', id] as const,
  chapters: (id: string) => ['manga', 'chapters', id] as const,
  pages: (chapterId: string) => ['manga', 'pages', chapterId] as const,
  library: (type?: string) => ['manga', 'library', type].filter(Boolean),
  libraryInfinite: (type?: string) => [...mediaKeys.library(type), 'infinite'] as const,
  libraryCheck: (id: string) => ['manga', 'library-check', id] as const,
  history: (type?: string) => ['manga', 'history', type].filter(Boolean),
  historyInfinite: (type?: string) => [...mediaKeys.history(type), 'infinite'] as const,
  progress: (mediaId: string) => ['manga', 'progress', mediaId] as const
}

// Backward-compatible key aliases
export const mangaKeys = mediaKeys
export const animeKeys = mediaKeys

/**
 * Unified hook to fetch media details (manga or anime) with caching
 */
export function useMediaDetails(type: MediaType, id: string, pkg: string | null, url?: string) {
  return useQuery({
    queryKey: mediaKeys.details(type, id),
    queryFn: async () => {
      // 1. Check DB Cache
      const cached = (await DataService.db.getMangaCache(id)) as Media | null

      // 2. Fetch from extension if needed or to refresh
      if (pkg) {
        try {
          const runner = await ExtensionResolver.resolve(pkg)
          if (runner) {
            const urlToFetch = url || cached?.url || id
            const fresh = await runner.fetchMangaDetails({
              id,
              url: urlToFetch,
              title: cached?.title || '',
              pkg
            })
            if (fresh) {
              const hasValidTitle =
                fresh.title && fresh.title !== 'Untitled' && !/^\d+$/.test(fresh.title)
              const finalMedia = {
                ...cached,
                ...fresh,
                title: hasValidTitle ? fresh.title : cached?.title || fresh.title,
                coverUrl: fresh.coverUrl || cached?.coverUrl || null,
                pkg,
                mediaType: type
              } as Media
              // Save to cache asynchronously
              DataService.db.saveMangaCache(finalMedia as any)
              return finalMedia
            }
          }
        } catch (e) {
          console.error(`Failed to fetch fresh ${type} details`, e)
        }
      }

      if (!cached)
        throw new Error(
          `${type === 'anime' ? 'Anime' : 'Manga'} not found and no extension provided`
        )
      return cached
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 60 // 1 hour for details
  })
}

export function useMangaDetails(mangaId: string, pkg: string | null, mangaUrl?: string) {
  return useMediaDetails('manga', mangaId, pkg, mangaUrl)
}

export function useAnimeDetails(animeId: string, pkg: string | null, animeUrl?: string) {
  return useMediaDetails('anime', animeId, pkg, animeUrl)
}

/**
 * Unified hook to fetch items (chapters or episodes)
 */
export function useMediaItems(type: MediaType, id: string, pkg: string | null, url?: string) {
  return useQuery({
    queryKey: mediaKeys.items(type, id),
    queryFn: async () => {
      // 1. Get from DB
      const cached = await DataService.db.getChapters(id)

      // 2. Refresh from extension if pkg provided
      if (pkg) {
        try {
          const runner = await ExtensionResolver.resolve(pkg)
          if (runner) {
            const media = await DataService.db.getMangaCache(id)
            const urlToFetch = url || (media as any)?.url || id
            const fresh = await runner.fetchChapters(urlToFetch)
            if (fresh && fresh.length > 0) {
              await DataService.db.saveChapters({ mangaId: id, chapters: fresh })
              return fresh
            }
          }
        } catch (e) {
          console.error(`Failed to fetch fresh items for ${type}`, e)
        }
      }
      return (cached as Chapter[]) || []
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 15 // 15 minutes for items
  })
}

export function useMangaChapters(mangaId: string, pkg: string | null, mangaUrl?: string) {
  return useMediaItems('manga', mangaId, pkg, mangaUrl)
}

/**
 * Unified hook to check if a media item is in the library
 */
export function useIsMediaInLibrary(type: MediaType, id: string) {
  return useQuery({
    queryKey: mediaKeys.libraryCheck(id),
    queryFn: async () => {
      try {
        const library = await DataService.db.getLibrary({ type })
        return (library as Media[]).some((m) => m.id === id)
      } catch {
        return false
      }
    },
    enabled: !!id,
    staleTime: 1000 * 60 // 1 minute
  })
}

export function useIsMangaInLibrary(mangaId: string) {
  return useIsMediaInLibrary('manga', mangaId)
}

/**
 * Hook to fetch user library (infinite scroll)
 */
export function useInfiniteLibraryItems(type?: 'manga' | 'anime') {
  return useInfiniteQuery({
    queryKey: mediaKeys.libraryInfinite(type),
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
    queryKey: mediaKeys.library(type),
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
 * Hook to fetch reading / watching progress
 */
export function useReadingProgress(mediaId: string) {
  return useQuery({
    queryKey: mediaKeys.progress(mediaId),
    queryFn: () => DataService.db.getProgress(mediaId),
    enabled: !!mediaId
  })
}

/**
 * Hook to fetch history entries (infinite scroll)
 */
export function useInfiniteHistoryEntries(type?: 'manga' | 'anime') {
  return useInfiniteQuery({
    queryKey: mediaKeys.historyInfinite(type),
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
    queryKey: [...mediaKeys.history(type), { limit, offset }],
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
    queryKey: mediaKeys.pages(chapter?.id || ''),
    queryFn: async () => {
      if (!chapter || !pkg) return []

      // 1. Check if downloaded
      try {
        const download = await DataService.download.getStatus({
          mangaId,
          chapterId: chapter.id
        })

        if (download && download.status === 'completed') {
          if (download.localPages && download.localPages.length > 0) {
            return download.localPages
          }
          if (download.pageUrls) {
            const cachedUrls = JSON.parse(download.pageUrls)
            if (cachedUrls && cachedUrls.length > 0) {
              return cachedUrls.map((u: string) => (u.startsWith('//') ? `https:${u}` : u))
            }
          }
        }
      } catch (e) {
        console.warn('Download status check failed', e)
      }

      // 2. Fetch from extension
      const runner = await ExtensionResolver.resolve(pkg)
      if (!runner) throw new Error('Extension not found')
      const pages = (await runner.fetchPages(chapter.url)) as string[]
      return (pages || [])
        .map((u: string) => (typeof u === 'string' && u.startsWith('//') ? `https:${u}` : u))
        .filter(Boolean)
    },
    enabled: !!chapter && !!pkg,
    staleTime: 1000 * 60 * 60 * 24 // 24 hours
  })
}

/**
 * Hook for prefetching next chapter pages in the background for zero-pause reading
 */
export function usePrefetchNextChapter(
  mangaId: string,
  pkg: string,
  chapters: Chapter[] = [],
  currentChapter: Chapter | null
) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!currentChapter || !chapters || chapters.length === 0 || !pkg) return

    const currentIndex = chapters.findIndex(
      (c) => c && (c.id === currentChapter.id || c.url === currentChapter.url)
    )
    if (currentIndex === -1) return

    const nextChapter = chapters[currentIndex + 1] || chapters[currentIndex - 1]
    if (!nextChapter || !nextChapter.id || !nextChapter.url) return

    const queryKey = mediaKeys.pages(nextChapter.id)

    if (!queryClient.getQueryData(queryKey)) {
      queryClient.prefetchQuery({
        queryKey,
        queryFn: async () => {
          try {
            const runner = await ExtensionResolver.resolve(pkg)
            if (!runner) return []
            const pages = (await runner.fetchPages(nextChapter.url)) as string[]
            const pageUrls = (pages || []).map((u: string) =>
              u.startsWith('//') ? `https:${u}` : u
            )

            // Warm up image cache in background
            pageUrls.slice(0, 5).forEach((imgUrl) => {
              if (typeof Image !== 'undefined') {
                const img = new Image()
                img.src = imgUrl
              }
            })

            return pageUrls
          } catch {
            return []
          }
        },
        staleTime: 1000 * 60 * 60 * 24
      })
    }
  }, [queryClient, mangaId, pkg, chapters, currentChapter])
}

/**
 * Mutation to toggle library status with optimistic updates
 */
export function useToggleLibrary() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (manga: NormalizedManga) => DataService.db.toggleLibrary(manga as any),
    onMutate: async (manga) => {
      const checkKey = mediaKeys.libraryCheck(manga.id)

      await queryClient.cancelQueries({ queryKey: checkKey })
      await queryClient.cancelQueries({ queryKey: mediaKeys.library() })

      const previousInLibrary = queryClient.getQueryData(checkKey)
      queryClient.setQueryData(checkKey, (old: boolean | undefined) => !old)

      return { previousInLibrary }
    },
    onError: (err, manga, context) => {
      if (context?.previousInLibrary !== undefined) {
        queryClient.setQueryData(mediaKeys.libraryCheck(manga.id), context.previousInLibrary)
      }
      console.error('Library toggle failed', err)
    },
    onSettled: (_data, _error, manga) => {
      queryClient.invalidateQueries({ queryKey: mediaKeys.library() })
      queryClient.invalidateQueries({ queryKey: mediaKeys.libraryCheck(manga.id) })
    }
  })
}

export function useToggleMediaLibrary(type: MediaType) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (media: Media) =>
      DataService.db.toggleLibrary({ ...media, mediaType: type } as any),
    onMutate: async (media) => {
      const checkKey = mediaKeys.libraryCheck(media.id)
      await queryClient.cancelQueries({ queryKey: checkKey })
      await queryClient.cancelQueries({ queryKey: mediaKeys.library() })

      const previousInLibrary = queryClient.getQueryData(checkKey)
      queryClient.setQueryData(checkKey, (old: boolean | undefined) => !old)
      return { previousInLibrary }
    },
    onError: (err, media, context) => {
      if (context?.previousInLibrary !== undefined) {
        queryClient.setQueryData(mediaKeys.libraryCheck(media.id), context.previousInLibrary)
      }
      console.error(`${type} library toggle failed`, err)
    },
    onSettled: (_data, _error, media) => {
      queryClient.invalidateQueries({ queryKey: mediaKeys.library() })
      queryClient.invalidateQueries({ queryKey: mediaKeys.libraryCheck(media.id) })

      const isInLibrary = queryClient.getQueryData(mediaKeys.libraryCheck(media.id))
      useUIStore.getState().addToast({
        type: 'success',
        message: `${media.title || 'Item'} ${!isInLibrary ? 'removed from' : 'added to'} library`
      })
    }
  })
}
