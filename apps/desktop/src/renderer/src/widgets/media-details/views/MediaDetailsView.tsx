import { useState, useRef, useEffect, useMemo } from 'react'
import { ArrowLeft, Share2, Download, ShieldAlert } from 'lucide-react'
import {
  useUIStore,
  useLibraryStore,
  useExtensionStore,
  useProgressStore,
  useDownloadStore,
  useReaderStore
} from '@renderer/shared/model'
import { DataService } from '@renderer/shared/api'
import { DownloadEntry } from '@common/types'
import { Button, HeroSkeleton } from '@renderer/shared/ui'
import { cn } from '@renderer/shared/lib/utils'
import { normalizeManga } from '@common/utils/mangaNormalizer'
import { ExtensionResolver } from '@renderer/shared/api/sources/resolver'
import { isFullySupported } from '@renderer/shared/api/sources'
import { Chapter } from '@renderer/shared/api/sources/types'

// Sub-components
import { HeroSection } from '../components/HeroSection'
import { ActionBar } from '../components/ActionBar'
import { SynopsisCard } from '../components/SynopsisCard'
import { ContinueBanner } from '../components/ContinueBanner'
import { ChapterEpisodeList } from '../components/ChapterEpisodeList'

export type DownloadStatus = 'pending' | 'downloading' | 'completed' | 'error' | 'paused' | 'none'

export interface MediaDetailsViewProps {
  mergedMedia: any
  items: Chapter[]
  isLoading: boolean
  error: string | null
  isInLibrary: boolean
  toggleLibrary: () => void
  isToggling: boolean
  refetch: () => void
  mediaType?: 'manga' | 'anime'
}

export function MediaDetailsView({
  mergedMedia,
  items,
  isLoading,
  error,
  isInLibrary,
  toggleLibrary,
  isToggling,
  refetch,
  mediaType: propMediaType
}: MediaDetailsViewProps): React.JSX.Element {
  const mediaType = propMediaType || mergedMedia?.mediaType || 'manga'
  const isAnime = mediaType === 'anime'
  const itemNoun = isAnime ? 'Episode' : 'Chapter'
  const itemsNoun = isAnime ? 'Episodes' : 'Chapters'

  const { setActiveTab, addToast } = useUIStore()
  const { setSelectedManga, setActiveChapter } = useLibraryStore()
  const { activeExtension, installedExtensions } = useExtensionStore()
  const { readingProgress, pageProgress, markAllChaptersRead } = useProgressStore()
  const { downloadQueue, addToDownloadQueue, activeTasks } = useDownloadStore()
  const { defaultChapterSort } = useReaderStore()

  const [downloadStatuses, setDownloadStatuses] = useState<Record<string, DownloadStatus>>({})
  const [showDownloadMenu, setShowDownloadMenu] = useState(false)
  const downloadMenuRef = useRef<HTMLDivElement>(null)

  const readIds = mergedMedia ? readingProgress[mergedMedia.id] || [] : []
  const extension = installedExtensions.find((e) => e.pkg === (mergedMedia?.pkg || activeExtension))
  const pkgParts = (mergedMedia?.pkg || activeExtension)?.split('.') || []
  const extLang = extension?.lang || (pkgParts.length >= 4 ? pkgParts[3] : 'all')
  const normalized = normalizeManga(mergedMedia, extLang)

  useEffect(() => {
    if (!mergedMedia) return

    const updateStatuses = async (): Promise<void> => {
      if (!mergedMedia?.id) return

      // Auto-cache metadata for Downloads page and other lists
      const mediaToCache = {
        ...mergedMedia,
        mediaType
      }
      DataService.db.saveMangaCache(mediaToCache).catch((err) => {
        console.error(`[MediaDetailsView] Failed to auto-cache ${mediaType} metadata:`, err)
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
  }, [mergedMedia, mediaType])

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

  // Click outside download menu
  useEffect((): (() => void) => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(event.target as Node)) {
        setShowDownloadMenu(false)
      }
    }
    if (showDownloadMenu) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showDownloadMenu])

  const handleToggleMarkAll = async (): Promise<void> => {
    if (!mergedMedia || !items || items.length === 0) return
    const allRead = items.every((item) => readIds.includes(item.id))
    const chapterIds = items.map((i) => i.id)
    await markAllChaptersRead(mergedMedia.id, chapterIds, !allRead)
    addToast({
      type: 'success',
      message: allRead
        ? `Marked all ${itemsNoun.toLowerCase()} unread`
        : `Marked all ${itemsNoun.toLowerCase()} as read`
    })
  }

  const handleDownload = async (item: Chapter): Promise<void> => {
    if (!mergedMedia || !activeExtension) return

    if (isAnime) {
      addToDownloadQueue([
        {
          mangaId: mergedMedia.id,
          mangaTitle: mergedMedia.title,
          extension: activeExtension,
          extensionName: extension?.name || activeExtension || 'Source',
          chapter: item,
          type: 'anime'
        }
      ])
      addToast({
        type: 'success',
        message: `Added ${itemNoun} ${item.number} to download queue.`
      })
      return
    }

    try {
      setDownloadStatuses((prev) => ({ ...prev, [item.id]: 'downloading' }))
      const runner = await ExtensionResolver.resolve(activeExtension)
      if (!runner) throw new Error('Extension not found')
      const pages = (await runner.fetchPages(item.url)) as string[]
      if (!pages || pages.length === 0) throw new Error('No pages found')
      await DataService.download.start({
        mangaId: mergedMedia.id,
        chapterId: item.id,
        pageUrls: pages,
        type: 'manga',
        mangaTitle: mergedMedia.title,
        extensionName: extension?.name || activeExtension || 'Source',
        chapterTitle: item.title || `${itemNoun} ${item.number}`
      })
      addToast({
        type: 'success',
        message: `Download Started: ${itemNoun} ${item.number} is being downloaded.`
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[MediaDetailsView] Download failed: ${msg}`)
      setDownloadStatuses((prev) => ({ ...prev, [item.id]: 'error' }))
      addToast({ type: 'error', message: `Download Failed: ${msg}` })
    }
  }

  const handleCancelDownload = async (item: Chapter): Promise<void> => {
    if (!mergedMedia) return
    try {
      await DataService.download.cancel({
        mangaId: mergedMedia.id,
        chapterId: item.id
      })
      setDownloadStatuses((prev) => ({ ...prev, [item.id]: 'none' }))
      addToast({
        type: 'info',
        message: `Download Canceled: ${itemNoun} ${item.number}`
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[MediaDetailsView] Cancel failed: ${msg}`)
      addToast({ type: 'error', message: `Cancel Failed: ${msg}` })
    }
  }

  const handleRemoveDownload = async (item: Chapter): Promise<void> => {
    if (!mergedMedia) return
    try {
      await DataService.download.remove({ mangaId: mergedMedia.id, chapterId: item.id })
      setDownloadStatuses((prev) => {
        const updated = { ...prev }
        delete updated[item.id]
        return updated
      })
      addToast({
        type: 'success',
        message: `Removed download for ${itemNoun} ${item.number}`
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[MediaDetailsView] Remove download failed:`, err)
      addToast({ type: 'error', message: `Removal Failed: ${msg}` })
    }
  }

  const handleBulkDownload = (type: 'all' | 'unread' | 'next-5' | 'next-10'): void => {
    setShowDownloadMenu(false)
    if (!mergedMedia || !activeExtension) return

    const ascItems = [...items].sort(
      (a, b) => parseFloat(String(a.number || '0')) - parseFloat(String(b.number || '0'))
    )
    const unreadItems = ascItems.filter((c) => !readIds.includes(c.id))

    let targetItems: Chapter[] = []
    if (type === 'all') targetItems = ascItems
    else if (type === 'unread') targetItems = unreadItems
    else if (type === 'next-5') targetItems = unreadItems.slice(0, 5)
    else if (type === 'next-10') targetItems = unreadItems.slice(0, 10)

    const toDownload = targetItems.filter((c) => {
      const isDownloaded = downloadStatuses[c.id] === 'completed'
      const isQueued = downloadQueue.some((q) => q.chapter.id === c.id)
      const isDownloading = downloadStatuses[c.id] === 'downloading'
      return !isDownloaded && !isQueued && !isDownloading
    })

    if (toDownload.length === 0) {
      addToast({
        type: 'info',
        message: `All selected ${itemsNoun.toLowerCase()} are already downloaded or in queue.`
      })
      return
    }

    addToDownloadQueue(
      toDownload.map((c) => ({
        mangaId: mergedMedia.id,
        mangaTitle: mergedMedia.title,
        extension: activeExtension,
        extensionName: extension?.name || activeExtension || 'Source',
        chapter: c,
        type: isAnime ? 'anime' : 'manga'
      }))
    )
    addToast({
      type: 'success',
      message: `Bulk Download: Added ${toDownload.length} ${itemsNoun.toLowerCase()} to the queue.`
    })
  }

  const nextItem = (() => {
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
          <div className="relative" ref={downloadMenuRef}>
            <Button
              variant="ghost"
              size="icon"
              className={cn('h-8 w-8', showDownloadMenu && 'bg-secondary/40')}
              onClick={() => setShowDownloadMenu(!showDownloadMenu)}
            >
              <Download className="h-4.5 w-4.5" />
            </Button>
            {showDownloadMenu && (
              <div className="absolute top-10 right-0 z-50 w-52 bg-card border border-border shadow-md rounded-md overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="py-1">
                  <button
                    onClick={() => handleBulkDownload('all')}
                    className="w-full text-left px-4 py-2 text-xs hover:bg-secondary/50 text-foreground transition-colors"
                  >
                    Download All {itemsNoun}
                  </button>
                  <button
                    onClick={() => handleBulkDownload('unread')}
                    className="w-full text-left px-4 py-2 text-xs hover:bg-secondary/50 text-foreground transition-colors"
                  >
                    Download Unread / Unwatched
                  </button>
                  <button
                    onClick={() => handleBulkDownload('next-5')}
                    className="w-full text-left px-4 py-2 text-xs hover:bg-secondary/50 text-foreground transition-colors"
                  >
                    Download Next 5 {itemsNoun}
                  </button>
                  <button
                    onClick={() => handleBulkDownload('next-10')}
                    className="w-full text-left px-4 py-2 text-xs hover:bg-secondary/50 text-foreground transition-colors"
                  >
                    Download Next 10 {itemsNoun}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {isLoading ? (
        <HeroSkeleton />
      ) : (
        <HeroSection
          manga={normalized}
          mediaType={mediaType}
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
        manga={normalized}
        mediaType={mediaType}
      />

      <div className="p-6 max-w-7xl mx-auto w-full flex-1 space-y-6">
        <SynopsisCard
          description={normalized.description}
          genres={normalized.genres}
          isAnime={isAnime}
        />

        <ContinueBanner
          nextToRead={nextItem}
          mediaId={mergedMedia.id}
          pageProgress={pageProgress}
          readChapterIds={readIds}
          mediaType={mediaType}
          onContinue={setActiveChapter}
        />

        <ChapterEpisodeList
          items={items}
          readChapterIds={readIds}
          pageProgress={pageProgress[mergedMedia.id] || {}}
          downloadStatuses={effectiveStatuses}
          downloadProgress={downloadProgress}
          mediaType={mediaType}
          isLoading={isLoading}
          error={error}
          extLang={extLang}
          onItemClick={(item) => {
            setActiveChapter(item)
            addToast({ type: 'info', message: `Opening ${itemNoun} ${item.number}` })
          }}
          onDownload={handleDownload}
          onRemoveDownload={handleRemoveDownload}
          onRefresh={refetch}
          onToggleMarkAll={handleToggleMarkAll}
          defaultSortOrder={defaultChapterSort}
          onCancelDownload={handleCancelDownload}
        />
      </div>
    </div>
  )
}
