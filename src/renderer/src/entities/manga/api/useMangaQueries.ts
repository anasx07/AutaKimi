import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DataService } from '@renderer/shared/api'
import { ExtensionResolver } from '@renderer/shared/api/sources/resolver'
import { Chapter } from '@renderer/shared/api/sources/types'
import { NormalizedManga } from '@common/utils/mangaNormalizer'

export const mangaKeys = {
  all: ['manga'] as const,
  details: (id: string) => [...mangaKeys.all, 'details', id] as const,
  chapters: (id: string) => [...mangaKeys.all, 'chapters', id] as const,
  pages: (chapterId: string) => [...mangaKeys.all, 'pages', chapterId] as const,
  library: () => [...mangaKeys.all, 'library'] as const,
  history: () => [...mangaKeys.all, 'history'] as const,
  progress: (mangaId: string) => [...mangaKeys.all, 'progress', mangaId] as const,
}

/**
 * Hook to fetch manga details with caching
 */
export function useMangaDetails(mangaId: string, pkg: string | null, mangaUrl?: string) {
  return useQuery({
    queryKey: mangaKeys.details(mangaId),
    queryFn: async () => {
      // 1. Check DB Cache
      const cached = await DataService.db.getMangaCache(mangaId)
      
      // 2. Fetch from extension if needed or to refresh
      if (pkg) {
        try {
          const runner = await ExtensionResolver.resolve(pkg)
          if (runner) {
            const urlToFetch = mangaUrl || (cached as any)?.url || mangaId;
            const fresh = await runner.fetchMangaDetails({ id: mangaId, url: urlToFetch, title: '' })
            if (fresh) {
              // Save to cache asynchronously
              DataService.db.saveMangaCache({ ...fresh, pkg })
              return { ...fresh, pkg }
            }
          }
        } catch (e) {
          console.error('Failed to fetch fresh manga details', e)
        }
      }
      
      if (!cached) throw new Error('Manga not found and no extension provided')
      return cached as NormalizedManga
    },
    enabled: !!mangaId,
    staleTime: 1000 * 60 * 60, // 1 hour for details
  })
}

/**
 * Hook to fetch chapters for a manga
 */
export function useMangaChapters(mangaId: string, pkg: string | null, mangaUrl?: string) {
  // Live Debug Hook Entry
  try {
    const fs = require('fs');
    fs.appendFileSync('d:\\DEV\\Apps\\LManwa\\tmp\\chapters_debug.txt', `\n[Hook Called] mangaId: \${mangaId}, pkg: \${pkg}, url: \${mangaUrl}\n`);
  } catch(err) {}

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
            const urlToFetch = mangaUrl || (manga as any)?.url || mangaId;
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
    staleTime: 1000 * 60 * 15, // 15 minutes for chapters
  })
}

/**
 * Hook to fetch user library
 */
export function useLibraryItems() {
  return useQuery({
    queryKey: mangaKeys.library(),
    queryFn: () => DataService.db.getLibrary(),
    staleTime: 1000 * 60 * 5,
  })
}

/**
 * Hook to fetch reading progress
 */
export function useReadingProgress(mangaId: string) {
  return useQuery({
    queryKey: mangaKeys.progress(mangaId),
    queryFn: () => DataService.db.getProgress(mangaId),
    enabled: !!mangaId,
  })
}

/**
 * Hook to fetch history entries
 */
export function useHistoryEntries(limit = 50, offset = 0) {
  return useQuery({
    queryKey: [...mangaKeys.history(), { limit, offset }],
    queryFn: () => DataService.db.getHistory({ limit, offset }),
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
            return cachedUrls.map((u: string) => u.replace(/^https?:\/\//, 'lmanwa-cache://'))
          }
        }
      } catch (e) {
        console.warn('Download status check failed', e)
      }

      // 2. Fetch from extension
      const runner = await ExtensionResolver.resolve(pkg)
      if (!runner) throw new Error('Extension not found')
      const pages = await runner.fetchPages(chapter.url)
      return pages.map((u: string) => u.replace(/^https?:\/\//, 'lmanwa-cache://'))
    },
    enabled: !!chapter && !!pkg,
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
  })
}

/**
 * Mutation to toggle library status
 */
export function useToggleLibrary() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (manga: NormalizedManga) => DataService.db.toggleLibrary(manga),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mangaKeys.library() })
    }
  })
}
