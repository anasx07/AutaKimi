import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { DataService } from '@renderer/shared/api'
import { ExtensionResolver } from '@renderer/shared/api/sources/resolver'
import { Chapter as Episode } from '@renderer/shared/api/sources/types'
import { NormalizedManga as NormalizedAnime } from '@common/utils/mangaNormalizer'
import { HistoryEntry } from '@common/types'

export const animeKeys = {
  all: ['anime'] as const,
  details: (id: string) => [...animeKeys.all, 'details', id] as const,
  episodes: (id: string) => [...animeKeys.all, 'episodes', id] as const,
  streams: (episodeId: string) => [...animeKeys.all, 'streams', episodeId] as const,
  library: (type: string = 'anime') => ['manga', 'library', type].filter(Boolean),
  libraryInfinite: (type: string = 'anime') => [...animeKeys.library(type), 'infinite'] as const,
  libraryCheck: (id: string) => ['manga', 'library-check', id] as const,
  history: (type: string = 'anime') => ['manga', 'history', type].filter(Boolean),
  historyInfinite: (type: string = 'anime') => [...animeKeys.history(type), 'infinite'] as const,
  progress: (animeId: string) => [...animeKeys.all, 'progress', animeId] as const
}

/**
 * Hook to fetch anime details with caching
 */
export function useAnimeDetails(animeId: string, pkg: string | null, animeUrl?: string) {
  return useQuery({
    queryKey: animeKeys.details(animeId),
    queryFn: async () => {
      // 1. Check DB Cache
      const cached = (await DataService.db.getMangaCache(animeId)) as NormalizedAnime | null

      // 2. Fetch from extension if needed or to refresh
      if (pkg) {
        try {
          const runner = await ExtensionResolver.resolve(pkg)
          if (runner) {
            const urlToFetch = animeUrl || cached?.url || animeId
            const fresh = await runner.fetchMangaDetails({
              id: animeId,
              url: urlToFetch,
              title: cached?.title || '',
              pkg
            })
            if (fresh) {
              // Preserve existing title if fresh one is missing or "Untitled" or purely numeric
              const hasValidTitle =
                fresh.title && fresh.title !== 'Untitled' && !/^\d+$/.test(fresh.title)
              const finalAnime = {
                ...cached,
                ...fresh,
                title: hasValidTitle ? fresh.title : cached?.title || fresh.title,
                pkg,
                mediaType: 'anime' as const
              } as NormalizedAnime
              // Save to cache asynchronously
              DataService.db.saveMangaCache(finalAnime as any)
              return finalAnime
            }
          }
        } catch (e) {
          console.error('Failed to fetch fresh anime details', e)
        }
      }

      if (!cached) throw new Error('Anime not found and no extension provided')
      return cached
    },
    enabled: !!animeId,
    staleTime: 1000 * 60 * 60 // 1 hour for details
  })
}

/**
 * Hook to check if an anime is in library
 */
export function useIsAnimeInLibrary(animeId: string) {
  return useQuery({
    queryKey: animeKeys.libraryCheck(animeId),
    queryFn: async () => {
      try {
        const library = await DataService.db.getLibrary({ type: 'anime' })
        return (library as NormalizedAnime[]).some((m) => m.id === animeId)
      } catch {
        return false
      }
    },
    enabled: !!animeId,
    staleTime: 1000 * 60 // 1 minute
  })
}

/**
 * Hook to fetch episodes for an anime
 */
export function useAnimeEpisodes(animeId: string, pkg: string | null, animeUrl?: string) {
  return useQuery({
    queryKey: animeKeys.episodes(animeId),
    queryFn: async () => {
      // 1. Get from DB
      const cached = await DataService.db.getChapters(animeId)

      // 2. Refresh from extension if pkg provided
      if (pkg) {
        try {
          const runner = await ExtensionResolver.resolve(pkg)
          if (runner) {
            // We need the anime URL for the extension
            const anime = await DataService.db.getMangaCache(animeId)
            const urlToFetch = animeUrl || (anime as any)?.url || animeId
            const fresh = await runner.fetchChapters(urlToFetch)
            if (fresh && fresh.length > 0) {
              await DataService.db.saveChapters({ mangaId: animeId, chapters: fresh })
              return fresh
            }
          }
        } catch (e) {
          console.error('Failed to fetch fresh episodes', e)
        }
      }
      return (cached as Episode[]) || []
    },
    enabled: !!animeId,
    staleTime: 1000 * 60 * 15 // 15 minutes for episodes
  })
}

/**
 * Hook to fetch user anime library (infinite scroll)
 */
export function useInfiniteAnimeLibrary() {
  return useInfiniteQuery({
    queryKey: animeKeys.libraryInfinite('anime'),
    queryFn: async ({ pageParam = 0 }): Promise<NormalizedAnime[]> => {
      try {
        const result = await DataService.db.getLibrary({
          limit: 50,
          offset: pageParam as number,
          type: 'anime'
        })
        return (result as NormalizedAnime[]) || []
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
 * Hook to fetch watching progress
 */
export function useWatchingProgress(animeId: string) {
  return useQuery({
    queryKey: animeKeys.progress(animeId),
    queryFn: () => DataService.db.getProgress(animeId),
    enabled: !!animeId
  })
}

/**
 * Hook to fetch anime history entries (infinite scroll)
 */
export function useInfiniteAnimeHistory() {
  return useInfiniteQuery({
    queryKey: animeKeys.historyInfinite('anime'),
    queryFn: async ({ pageParam = 0 }): Promise<HistoryEntry[]> => {
      try {
        const result = await DataService.db.getHistory({
          limit: 50,
          offset: pageParam as number,
          type: 'anime'
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
 * Hook to fetch episode stream sources
 */
export function useEpisodeStreams(pkg: string, episode: Episode | null) {
  return useQuery({
    queryKey: animeKeys.streams(episode?.id || ''),
    queryFn: async () => {
      if (!episode || !pkg) return []

      const runner = await ExtensionResolver.resolve(pkg)
      if (!runner) throw new Error('Extension not found')
      const sources = await runner.fetchPages(episode.url)
      return sources // These will be video URLs
    },
    enabled: !!episode && !!pkg,
    staleTime: 1000 * 60 * 60 * 1 // 1 hour for streams
  })
}

/**
 * Mutation to toggle anime library status with optimistic updates
 */
export function useToggleAnimeLibrary() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (anime: NormalizedAnime) =>
      DataService.db.toggleLibrary({ ...anime, mediaType: 'anime' } as any),
    onMutate: async (anime) => {
      const checkKey = animeKeys.libraryCheck(anime.id)

      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey: checkKey })
      await queryClient.cancelQueries({ queryKey: ['manga', 'library'] })

      // Snapshot the previous value
      const previousInLibrary = queryClient.getQueryData(checkKey)

      // Optimistically update to the new value
      queryClient.setQueryData(checkKey, (old: boolean | undefined) => !old)

      return { previousInLibrary }
    },
    onError: (err, anime, context) => {
      // Rollback on error
      if (context?.previousInLibrary !== undefined) {
        queryClient.setQueryData(animeKeys.libraryCheck(anime.id), context.previousInLibrary)
      }
      console.error('Anime Library toggle failed', err)
    },
    onSettled: (_data, _error, anime) => {
      // Invalidate all library-related keys (using both manga and anime prefixes if shared)
      queryClient.invalidateQueries({ queryKey: ['manga', 'library'] })
      queryClient.invalidateQueries({ queryKey: animeKeys.libraryCheck(anime.id) })
    }
  })
}
