import { useState, useEffect, useMemo } from 'react'
import { ArrowLeft, Share2, MoreVertical, ShieldAlert } from 'lucide-react'
import {
  useUIStore,
  useLibraryStore,
  useExtensionStore,
  useProgressStore,
  useDownloadStore
} from '@renderer/shared/model'
import { DataService } from '@renderer/shared/api'
import { DownloadEntry } from '@common/types'
import { Button, HeroSkeleton } from '@renderer/shared/ui'
import { normalizeManga } from '@common/utils/mangaNormalizer'
import { isFullySupported } from '@renderer/shared/api/sources'
import { Chapter as Episode } from '@renderer/shared/api/sources/types'

// Sub-components
import { HeroSection } from '../components/HeroSection'
import { ActionBar } from '../components/ActionBar'
import { SynopsisCard } from '../components/SynopsisCard'
import { ContinueBanner } from '../components/ContinueBanner'
import { ChapterEpisodeList } from '../components/ChapterEpisodeList'

export type DownloadStatus = 'pending' | 'downloading' | 'completed' | 'error' | 'paused' | 'none'

interface AnimeDetailsViewProps {
  mergedMedia: any // Refined type pending further refactoring
  items: Episode[]
  isLoading: boolean
  error: string | null
  isInLibrary: boolean
  toggleLibrary: () => void
  isToggling: boolean
  refetch: () => void
}

export function AnimeDetailsView({
  mergedMedia,
  items,
  isLoading,
  error,
  isInLibrary,
  toggleLibrary,
  isToggling,
  refetch
}: AnimeDetailsViewProps): React.JSX.Element {
  const { setActiveTab } = useUIStore()
  const { setSelectedManga, setActiveChapter } = useLibraryStore()
  const { activeExtension, installedExtensions } = useExtensionStore()
  const { readingProgress, pageProgress } = useProgressStore()
  const { activeTasks, addToDownloadQueue } = useDownloadStore()
  const { addToast } = useUIStore()

  const [downloadStatuses, setDownloadStatuses] = useState<Record<string, DownloadStatus>>({})

  const readIds = mergedMedia ? readingProgress[mergedMedia.id] || [] : []
  const extension = installedExtensions.find((e) => e.pkg === (mergedMedia?.pkg || activeExtension))
  const pkgParts = (mergedMedia?.pkg || activeExtension)?.split('.') || []
  const extLang = extension?.lang || (pkgParts.length >= 4 ? pkgParts[3] : 'all')
  const normalized = normalizeManga(mergedMedia, extLang)

  useEffect(() => {
    if (!mergedMedia) return

    // Initial status fetch
    const updateStatuses = async (): Promise<void> => {
      if (!mergedMedia?.id) return

      // Auto-cache metadata for Downloads page and other lists
      const animeToCache = {
        ...mergedMedia,
        mediaType: mergedMedia.mediaType || 'anime'
      }
      DataService.db.saveMangaCache(animeToCache).catch((err) => {
        console.error('[AnimeDetailsView] Failed to auto-cache anime metadata:', err)
      })

      const downloads = await DataService.download.getMangaDownloads(mergedMedia.id)
      if (downloads) {
        const statusMap = downloads.reduce(
          (acc: Record<string, DownloadStatus>, d: DownloadEntry) => {
            acc[d.chapterId] = d.status as DownloadStatus
            return acc
          },
          {}
        )
        setDownloadStatuses(statusMap)
      }
    }

    updateStatuses()
  }, [mergedMedia])

  // Debug: Monitor store updates
  useEffect(() => {
    if (Object.keys(activeTasks).length > 0) {
      console.log(`[AnimeDetailsView] ActiveTasks updated:`, activeTasks)
    }
  }, [activeTasks])

  // Merge synchronized real-time statuses from store
  const effectiveStatuses = useMemo(() => {
    const combined = { ...downloadStatuses }
    Object.values(activeTasks).forEach((task) => {
      if (String(task.mangaId) === String(mergedMedia?.id)) {
        combined[task.chapterId] = task.status as DownloadStatus
      }
    })
    return combined
  }, [downloadStatuses, activeTasks, mergedMedia])

  const downloadProgress = useMemo(() => {
    const progress: Record<string, number> = {}
    Object.values(activeTasks).forEach((task) => {
      if (String(task.mangaId) === String(mergedMedia?.id)) {
        progress[task.chapterId] = task.cached / (task.total || 1)
      }
    })
    return progress
  }, [activeTasks, mergedMedia])

  const nextToWatch = (() => {
    if (items.length === 0) return null
    const progMap = mergedMedia ? pageProgress[mergedMedia.id] : null
    if (progMap) {
      const itemWithProgress = Object.entries(progMap)
        .filter(([id, page]) => (page as number) > 1 && !readIds.includes(id))
        .sort((a, b) => (b[1] as number) - (a[1] as number))[0]
      if (itemWithProgress) {
        const found = items.find((c) => c.id === itemWithProgress[0])
        if (found) return found
      }
    }
    const ascItems = [...items].sort(
      (a, b) => parseFloat(String(a.number || '0')) - parseFloat(String(b.number || '0'))
    )
    return ascItems.find((c) => !readIds.includes(c.id)) || ascItems[0] || null
  })()

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-y-auto anime-details-page">
      <div className="sticky top-0 z-50 flex items-center justify-between p-4 bg-background/60 backdrop-blur-md border-b border-border/50">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSelectedManga(null)}
          className="h-8 w-8"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-amber-500 hover:text-amber-600 hover:bg-amber-500/10"
            onClick={() => normalized.url && DataService.openInternalBrowser(normalized.url)}
          >
            <ShieldAlert className="h-4.5 w-4.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => normalized.url && DataService.openExternal(normalized.url)}
          >
            <Share2 className="h-4.5 w-4.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreVertical className="h-4.5 w-4.5" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <HeroSkeleton />
      ) : (
        <HeroSection
          manga={normalized}
          mediaType="anime"
          extension={extension}
          isFullySupported={activeExtension ? isFullySupported(activeExtension) : false}
          extLang={extLang}
          onBrowseSource={() => {
            setActiveTab('browse')
            setSelectedManga(null)
          }}
        />
      )}

      <ActionBar
        isInLibrary={isInLibrary}
        isPending={isToggling}
        onToggleLibrary={toggleLibrary}
        mediaUrl={normalized.url}
      />

      <div className="p-6 max-w-7xl mx-auto w-full flex-1 space-y-6">
        <SynopsisCard
          description={normalized.description}
          genres={normalized.genres}
          isAnime={true}
        />

        <ContinueBanner
          nextToRead={nextToWatch}
          mediaId={mergedMedia.id}
          pageProgress={pageProgress}
          readChapterIds={readIds}
          mediaType="anime"
          onContinue={setActiveChapter}
        />

        <ChapterEpisodeList
          items={items}
          readChapterIds={readIds}
          pageProgress={pageProgress[mergedMedia.id] || {}}
          downloadStatuses={effectiveStatuses}
          downloadProgress={downloadProgress}
          mediaType="anime"
          isLoading={isLoading}
          error={error}
          extLang={extLang}
          onItemClick={(episode) => {
            setActiveChapter(episode)
            addToast({ type: 'info', message: `Opening Episode ${episode.number}` })
          }}
          onDownload={(episode) => {
            if (!mergedMedia || !activeExtension) return
            addToDownloadQueue([
              {
                mangaId: mergedMedia.id,
                mangaTitle: mergedMedia.title,
                extension: activeExtension,
                extensionName: extension?.name || activeExtension || 'Source',
                chapter: episode,
                type: 'anime'
              }
            ])
            addToast({
              type: 'success',
              message: `Added Episode ${episode.number} to download queue.`
            })
          }}
          onRemoveDownload={async (episode) => {
            if (!mergedMedia) return
            try {
              await DataService.download.remove({ mangaId: mergedMedia.id, chapterId: episode.id })
              setDownloadStatuses((prev) => {
                const updated = { ...prev }
                delete updated[episode.id]
                return updated
              })
              addToast({
                type: 'success',
                message: `Removed download for Episode ${episode.number}`
              })
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : String(err)
              console.error(`[AnimeDetailsView] Remove download failed:`, err)
              addToast({ type: 'error', message: `Removal Failed: ${msg}` })
            }
          }}
          onRefresh={refetch}
          onCancelDownload={async (episode) => {
            if (!mergedMedia) return
            try {
              await DataService.download.cancel({
                mangaId: mergedMedia.id,
                chapterId: episode.id
              })
              setDownloadStatuses((prev) => ({ ...prev, [episode.id]: 'none' }))
              addToast({
                type: 'info',
                message: `Download Canceled: Episode ${episode.number}`
              })
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : String(err)
              console.error(`[AnimeDetailsView] Cancel failed:`, err)
              addToast({ type: 'error', message: `Cancel Failed: ${msg}` })
            }
          }}
        />
      </div>
    </div>
  )
}
