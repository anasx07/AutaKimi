import { useState, useRef, useEffect, useMemo } from 'react'
import { ArrowLeft, Share2, Download, MoreVertical, ShieldAlert } from 'lucide-react'
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

interface MangaDetailsViewProps {
  mergedMedia: any // Will be refined in future cleanup
  items: Chapter[]
  isLoading: boolean
  error: string | null
  isInLibrary: boolean
  toggleLibrary: () => void
  isToggling: boolean
  refetch: () => void
}

export function MangaDetailsView({
  mergedMedia,
  items,
  isLoading,
  error,
  isInLibrary,
  toggleLibrary,
  isToggling,
  refetch
}: MangaDetailsViewProps): React.JSX.Element {
  const { setActiveTab } = useUIStore()
  const { setSelectedManga, setActiveChapter } = useLibraryStore()
  const { activeExtension, installedExtensions } = useExtensionStore()
  const { readingProgress, pageProgress } = useProgressStore()
  const { downloadQueue, addToDownloadQueue, activeTasks } = useDownloadStore()
  const { defaultChapterSort } = useReaderStore()

  const { addToast } = useUIStore()

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
      const mangaToCache = {
        ...mergedMedia,
        mediaType: mergedMedia.mediaType || 'manga'
      }
      DataService.db.saveMangaCache(mangaToCache).catch((err) => {
        console.error('[MangaDetailsView] Failed to auto-cache manga metadata:', err)
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
      console.log(`[MangaDetailsView] ActiveTasks updated:`, activeTasks)
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

  const handleDownload = async (chapter: Chapter): Promise<void> => {
    if (!mergedMedia || !activeExtension) return
    try {
      setDownloadStatuses((prev) => ({ ...prev, [chapter.id]: 'downloading' }))
      const runner = await ExtensionResolver.resolve(activeExtension)
      if (!runner) throw new Error('Extension not found')
      const pages = (await runner.fetchPages(chapter.url)) as string[]
      if (!pages || pages.length === 0) throw new Error('No pages found')
      await DataService.download.start({
        mangaId: mergedMedia.id,
        chapterId: chapter.id,
        pageUrls: pages,
        type: 'manga',
        mangaTitle: mergedMedia.title,
        extensionName: extension?.name || activeExtension || 'Source',
        chapterTitle: chapter.title || `Chapter ${chapter.number}`
      })
      addToast({
        type: 'success',
        message: `Download Started: Chapter ${chapter.number} is being downloaded.`
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[MangaDetailsView] Download failed: ${msg}`)
      setDownloadStatuses((prev) => ({ ...prev, [chapter.id]: 'error' }))
      addToast({ type: 'error', message: `Download Failed: ${msg}` })
    }
  }

  const handleCancelDownload = async (chapter: Chapter): Promise<void> => {
    if (!mergedMedia) return
    try {
      await DataService.download.cancel({
        mangaId: mergedMedia.id,
        chapterId: chapter.id
      })
      setDownloadStatuses((prev) => ({ ...prev, [chapter.id]: 'none' }))
      addToast({
        type: 'info',
        message: `Download Canceled: Chapter ${chapter.number}`
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[MangaDetailsView] Cancel failed: ${msg}`)
      addToast({ type: 'error', message: `Cancel Failed: ${msg}` })
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
        message: 'All selected chapters are already downloaded or in queue.'
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
        type: 'manga'
      }))
    )
    addToast({
      type: 'success',
      message: `Bulk Download: Added ${toDownload.length} chapters to the queue.`
    })
  }

  const nextToRead = (() => {
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
              <div className="absolute top-10 right-0 z-50 w-48 bg-card border border-border shadow-md rounded-md overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="p-1 space-y-0.5">
                  {['unread', 'next-5', 'next-10', 'all'].map((type) => (
                    <button
                      key={type}
                      onClick={() => {
                        handleBulkDownload(type as 'all' | 'unread' | 'next-5' | 'next-10')
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-secondary/50 rounded-sm transition-colors font-medium capitalize"
                    >
                      Download {type.replace('-', ' ')}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
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
          mediaType="manga"
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
          isAnime={false}
        />

        <ContinueBanner
          nextToRead={nextToRead}
          mediaId={mergedMedia.id}
          pageProgress={pageProgress}
          readChapterIds={readIds}
          mediaType="manga"
          onContinue={setActiveChapter}
        />

        <ChapterEpisodeList
          items={items}
          readChapterIds={readIds}
          pageProgress={pageProgress[mergedMedia.id] || {}}
          downloadStatuses={effectiveStatuses}
          downloadProgress={downloadProgress}
          mediaType="manga"
          isLoading={isLoading}
          error={error}
          extLang={extLang}
          onItemClick={setActiveChapter}
          onDownload={handleDownload}
          onCancelDownload={handleCancelDownload}
          onRemoveDownload={async (chapter) => {
            if (!mergedMedia) return
            try {
              await DataService.download.remove({ mangaId: mergedMedia.id, chapterId: chapter.id })
              setDownloadStatuses((prev) => {
                const updated = { ...prev }
                delete updated[chapter.id]
                return updated
              })
              addToast({
                type: 'success',
                message: `Removed download for Chapter ${chapter.number}`
              })
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err)
              console.error(`[MangaDetailsView] Remove download failed:`, err)
              addToast({ type: 'error', message: `Removal Failed: ${msg}` })
            }
          }}
          onRefresh={refetch}
          defaultSortOrder={defaultChapterSort}
        />
      </div>
    </div>
  )
}
