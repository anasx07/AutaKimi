import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DataService } from '@renderer/shared/api'
import { useUIStore } from '@renderer/shared/model'
import { ExtensionResolver } from '@renderer/shared/api/sources/resolver'
import { Chapter } from '@renderer/shared/api/sources/types'
import { NormalizedManga as Media } from '@common/utils/mangaNormalizer'

export type MediaType = 'manga' | 'anime'

export const mediaKeys = {
  all: ['media'] as const,
  details: (type: MediaType, id: string) => [...mediaKeys.all, type, 'details', id] as const,
  items: (type: MediaType, id: string) => [...mediaKeys.all, type, 'items', id] as const,
  libraryCheck: (type: MediaType, id: string) =>
    [...mediaKeys.all, type, 'library-check', id] as const
}

/**
 * Unified hook to fetch media details (manga or anime)
 */
export function useMediaDetails(type: MediaType, id: string, pkg: string | null, url?: string) {
  return useQuery({
    queryKey: mediaKeys.details(type, id),
    queryFn: async () => {
      // 1. Check DB Cache (Shared between types in our DB schema)
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
              title: cached?.title || ''
            })
            if (fresh) {
              const hasValidTitle =
                fresh.title && fresh.title !== 'Untitled' && !/^\d+$/.test(fresh.title)
              const finalMedia = {
                ...cached,
                ...fresh,
                title: hasValidTitle ? fresh.title : cached?.title || fresh.title,
                pkg,
                mediaType: type
              } as Media
              // Save to cache asynchronously
              DataService.db.saveMangaCache(finalMedia)
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

/**
 * Unified hook to check if a media item is in the library
 */
export function useIsMediaInLibrary(type: MediaType, id: string) {
  return useQuery({
    queryKey: mediaKeys.libraryCheck(type, id),
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

/**
 * Unified mutation to toggle media library status
 */
export function useToggleMediaLibrary(type: MediaType) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (media: Media) => DataService.db.toggleLibrary({ ...media, mediaType: type }),
    onMutate: async (media) => {
      const checkKey = mediaKeys.libraryCheck(type, media.id)
      await queryClient.cancelQueries({ queryKey: checkKey })
      // Generic library key to invalidate global views
      await queryClient.cancelQueries({ queryKey: ['manga', 'library'] })

      const previousInLibrary = queryClient.getQueryData(checkKey)
      queryClient.setQueryData(checkKey, (old: boolean | undefined) => !old)
      return { previousInLibrary }
    },
    onError: (err, media, context) => {
      if (context?.previousInLibrary !== undefined) {
        queryClient.setQueryData(mediaKeys.libraryCheck(type, media.id), context.previousInLibrary)
      }
      console.error(`${type} library toggle failed`, err)
    },
    onSettled: (_data, _error, media) => {
      queryClient.invalidateQueries({ queryKey: ['manga', 'library'] })
      queryClient.invalidateQueries({ queryKey: mediaKeys.libraryCheck(type, media.id) })

      const isInLibrary = queryClient.getQueryData(mediaKeys.libraryCheck(type, media.id))
      useUIStore.getState().addToast({
        type: 'success',
        message: `${media.title || 'Item'} ${!isInLibrary ? 'removed from' : 'added to'} library`
      })
    }
  })
}
