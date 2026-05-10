import { useMemo, useEffect } from 'react'
import { useExtensionStore, useProgressStore } from '@renderer/shared/model'
import {
  useMediaDetails,
  useMediaItems,
  useIsMediaInLibrary,
  useToggleMediaLibrary,
  MediaType
} from '@renderer/entities/media/api/useMediaQueries'
import { NormalizedManga as Media } from '@common/utils/mangaNormalizer'

export function useMediaData(type: MediaType, initialMedia: Media | null) {
  const { activeExtension } = useExtensionStore()
  const { loadProgress } = useProgressStore()

  const pkgToUse = initialMedia?.pkg || activeExtension
  const mediaId = initialMedia?.id || ''
  const mediaUrl = initialMedia?.url

  // Queries
  const detailQuery = useMediaDetails(type, mediaId, pkgToUse, mediaUrl)
  const itemsQuery = useMediaItems(type, mediaId, pkgToUse, mediaUrl)
  const libraryCheckQuery = useIsMediaInLibrary(type, mediaId)
  const toggleLibraryMutation = useToggleMediaLibrary(type)

  // Merged state (Selection Intent + Fresh Data)
  const mergedMedia = useMemo(() => {
    if (!initialMedia) return null
    const fresh = detailQuery.data
    if (!fresh) return initialMedia

    return {
      ...initialMedia,
      ...fresh,
      title:
        fresh.title && fresh.title !== 'Untitled' && !/^\d+$/.test(fresh.title)
          ? fresh.title
          : initialMedia.title || fresh.title
    }
  }, [initialMedia, detailQuery.data])

  // Effects
  useEffect(() => {
    if (mergedMedia) loadProgress(mergedMedia.id)
  }, [mergedMedia?.id, loadProgress])

  return {
    mergedMedia,
    items: itemsQuery.data || [],
    isLoading: detailQuery.isLoading || itemsQuery.isLoading,
    error: (detailQuery.error as Error)?.message || (itemsQuery.error as Error)?.message || null,
    isInLibrary: !!libraryCheckQuery.data,
    toggleLibrary: () => mergedMedia && toggleLibraryMutation.mutate(mergedMedia),
    isToggling: toggleLibraryMutation.isPending,
    refetch: () => {
      detailQuery.refetch()
      itemsQuery.refetch()
    }
  }
}
