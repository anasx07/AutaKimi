import { lazy, Suspense, useState, useRef, useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { ArrowLeft, Share2, Download, ShieldAlert, AlignLeft } from 'lucide-react'
import { usePipPlayerStore } from '@renderer/app/components/pipPlayerStore'
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
import { isMobile } from '@renderer/shared/platform'
import { normalizeManga } from '@common/utils/mangaNormalizer'
import { ExtensionResolver } from '@renderer/shared/api/sources/resolver'
import { isFullySupported } from '@renderer/shared/api/sources'
import { Chapter, MediaSeason } from '@renderer/shared/api/sources/types'
import { InlineEpisodesPanel } from '@renderer/widgets/anime-viewer/components/InlineEpisodesPanel'

const AnimeViewer = lazy(() => import('@renderer/widgets/anime-viewer/AnimeViewer'))

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
  activeSeasonUrl?: string | null
  onSelectSeason?: (season: MediaSeason) => void
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
  mediaType: propMediaType,
  activeSeasonUrl,
  onSelectSeason
}: MediaDetailsViewProps): React.JSX.Element {
  const mediaType = propMediaType || mergedMedia?.mediaType || 'manga'
  const isAnime = mediaType === 'anime'
  const itemNoun = isAnime ? 'Episode' : 'Chapter'
  const itemsNoun = isAnime ? 'Episodes' : 'Chapters'

  const mobile = isMobile()
  const location = useLocation()
  const { setActiveTab, addToast } = useUIStore()
  const { setSelectedManga, activeChapter, setActiveChapter } = useLibraryStore()
  const { activeExtension, installedExtensions } = useExtensionStore()
  const { readingProgress, pageProgress, markAllChaptersRead } = useProgressStore()
  const { downloadQueue, addToDownloadQueue, activeTasks } = useDownloadStore()
  const { defaultChapterSort } = useReaderStore()

  const [downloadStatuses, setDownloadStatuses] = useState<Record<string, DownloadStatus>>({})
  const [showDownloadMenu, setShowDownloadMenu] = useState(false)
  const [isTheaterMode, setIsTheaterMode] = useState(false)
  const [showWatchSynopsis, setShowWatchSynopsis] = useState(false)
  const downloadMenuRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const isInlineWatchActive = isAnime && Boolean(activeChapter) && !mobile
  const pinDetailsHeader = !mobile && !isInlineWatchActive
  const lockWatchViewport = isInlineWatchActive && !isTheaterMode

  useEffect(() => {
    if (isInlineWatchActive && usePipPlayerStore.getState().pipSession) {
      usePipPlayerStore.getState().clearPip()
    }
  }, [isInlineWatchActive, activeChapter?.id])

  useEffect(() => {
    if (isInlineWatchActive && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [isInlineWatchActive, activeChapter?.id])

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
        ? `Marked all ${itemsNoun.toLowerCase()} ${isAnime ? 'unwatched' : 'unread'}`
        : `Marked all ${itemsNoun.toLowerCase()} as ${isAnime ? 'watched' : 'read'}`
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

  const episodesListNode = (
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
      fillHeight={pinDetailsHeader}
      seasons={normalized.seasons}
      activeSeasonUrl={activeSeasonUrl}
      onSelectSeason={onSelectSeason}
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
  )

  return (
    <div
      ref={scrollContainerRef}
      className={cn(
        'flex-1 flex flex-col h-full min-h-0 bg-background overflow-x-hidden anime-details-page',
        pinDetailsHeader || lockWatchViewport
          ? 'overflow-y-auto lg:overflow-hidden'
          : 'overflow-y-auto'
      )}
    >
      <div className="sticky top-0 z-50 shrink-0 flex items-center justify-between px-4 py-2.5 bg-background/80 backdrop-blur-md border-b border-border/50 gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              const live = usePipPlayerStore.getState().livePlayback
              if (isInlineWatchActive && activeChapter && live?.isPlaying) {
                usePipPlayerStore.getState().enterPip({
                  manga: normalized,
                  chapter: activeChapter,
                  pkg: normalized.pkg || activeExtension || '',
                  returnPath: location.pathname
                })
              }
              setActiveChapter(null)
              setSelectedManga(null)
            }}
            className="h-8 w-8 shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          {isInlineWatchActive && activeChapter && (
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-bold truncate text-foreground">{normalized.title}</span>
              <span className="px-2 py-0.5 rounded-md bg-primary/15 text-primary text-xs font-bold shrink-0">
                EP {activeChapter.number}
              </span>
            </div>
          )}
        </div>
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
                    Download {isAnime ? 'Unwatched' : 'Unread'} {itemsNoun}
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

      {isInlineWatchActive && activeChapter && (
        <div
          className={cn(
            'w-full px-5 pt-4 pb-4',
            !isTheaterMode && 'flex-1 min-h-0 flex flex-col'
          )}
        >
          <div
            className={cn(
              'grid gap-4',
              isTheaterMode
                ? 'grid-cols-1 max-w-6xl mx-auto w-full items-start'
                : 'grid-cols-1 lg:grid-cols-[minmax(0,1fr)_350px] flex-1 min-h-0 items-stretch'
            )}
          >
            <div className={cn('min-w-0', !isTheaterMode && 'flex flex-col justify-center min-h-0')}>
              <Suspense
                fallback={
                  <div className="w-full aspect-video max-h-[76vh] rounded-xl bg-black flex items-center justify-center border border-white/10">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
                  </div>
                }
              >
                <AnimeViewer
                  variant="inline"
                  isTheaterMode={isTheaterMode}
                  onToggleTheaterMode={() => setIsTheaterMode((prev) => !prev)}
                  onEnterMiniPip={() => {
                    if (!activeChapter) return
                    usePipPlayerStore.getState().enterPip({
                      manga: normalized,
                      chapter: activeChapter,
                      pkg: normalized.pkg || activeExtension || '',
                      returnPath: location.pathname
                    })
                    setActiveChapter(null)
                  }}
                />
              </Suspense>
            </div>
            {!isTheaterMode && (
              <div className="relative min-h-[420px] lg:min-h-0 flex flex-col">
                <div className="h-full lg:absolute lg:inset-0 flex flex-col">
                  <InlineEpisodesPanel
                    episodes={items}
                    activeChapterId={activeChapter.id}
                    readChapterIds={readIds}
                    pageProgress={pageProgress[mergedMedia.id] || {}}
                    extLang={extLang}
                    onSelectEpisode={(ep) => setActiveChapter(ep)}
                    seasons={normalized.seasons}
                    activeSeasonUrl={activeSeasonUrl}
                    onSelectSeason={onSelectSeason}
                    topContent={
                      <div className="p-3 border-b border-border space-y-2.5 bg-card shrink-0">
                        <div className="flex items-start gap-2.5">
                          {normalized.coverUrl && (
                            <img
                              src={normalized.coverUrl}
                              alt={normalized.title}
                              className="w-11 h-16 rounded-md object-cover border border-border shrink-0"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <button
                              type="button"
                              onClick={() => setActiveChapter(null)}
                              className="text-left text-xs font-semibold text-foreground hover:text-primary transition-colors line-clamp-2 leading-snug"
                              title="Back to anime details"
                              dir="auto"
                            >
                              {normalized.title}
                            </button>
                            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted-foreground truncate">
                              {extension?.name && <span className="truncate">{extension.name}</span>}
                              {normalized.status && (
                                <>
                                  {extension?.name && <span>•</span>}
                                  <span className="truncate" dir="auto">
                                    {normalized.status.split(' • ')[0]}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <ActionBar
                          compact
                          isInLibrary={isInLibrary}
                          isPending={isToggling}
                          onToggleLibrary={toggleLibrary}
                          mediaUrl={normalized.url}
                          manga={normalized}
                          mediaType={mediaType}
                          extraAction={
                            <Button
                              variant="outline"
                              onClick={() => setShowWatchSynopsis((prev) => !prev)}
                              title="Toggle Synopsis & Genres"
                              className={cn(
                                'h-8 w-8 p-0 shrink-0 flex items-center justify-center rounded-lg border transition-colors',
                                showWatchSynopsis
                                  ? 'bg-primary/10 border-primary/40 text-primary'
                                  : 'bg-background border-border text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                              )}
                            >
                              <AlignLeft className="h-3.5 w-3.5" />
                            </Button>
                          }
                        />

                        {showWatchSynopsis && (
                          <div className="pt-2 border-t border-border/60 space-y-2 max-h-36 overflow-y-auto custom-scrollbar pr-1">
                            <p
                              className="text-[11px] text-muted-foreground leading-relaxed whitespace-pre-line"
                              dir="auto"
                            >
                              {normalized.description || 'No description available.'}
                            </p>
                            {normalized.genres && normalized.genres.length > 0 && (
                              <div className="flex flex-wrap gap-1 pt-1">
                                {normalized.genres.map((genre: string) => (
                                  <span
                                    key={genre}
                                    className="px-2 py-0.5 rounded-full bg-secondary text-[10px] text-secondary-foreground font-medium"
                                  >
                                    {genre}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    }
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {(!isInlineWatchActive || isTheaterMode) && (
        pinDetailsHeader ? (
          <div className="max-w-[1440px] mx-auto w-full flex-1 lg:min-h-0 px-6 py-4 grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] gap-5 items-stretch">
            {/* Left Fixed Info Column */}
            <div className="flex flex-col lg:min-h-0 lg:overflow-y-auto no-scrollbar gap-3">
              {isLoading ? (
                <div className="h-80 rounded-xl bg-card border border-border animate-pulse shrink-0" />
              ) : (
                <HeroSection
                  layout="sidebar"
                  manga={normalized}
                  mediaType={mediaType}
                  extension={extension}
                  isFullySupported={isFullySupported(extension || normalized.pkg || activeExtension || undefined)}
                  extLang={extLang}
                  onBrowseSource={() => {
                    setActiveChapter(null)
                    setActiveTab('browse')
                    setSelectedManga(null)
                  }}
                />
              )}

              <div className="shrink-0">
                <ActionBar
                  compact
                  isInLibrary={isInLibrary}
                  isPending={isToggling}
                  onToggleLibrary={toggleLibrary}
                  mediaUrl={normalized.url}
                  manga={normalized}
                  mediaType={mediaType}
                />
              </div>

              <SynopsisCard
                inSidebar
                description={normalized.description}
                genres={normalized.genres}
                isAnime={isAnime}
              />
            </div>

            {/* Right Episodes Stack */}
            <div className="flex flex-col min-h-[420px] lg:min-h-0 gap-3.5">
              <div className="shrink-0">
                <ContinueBanner
                  nextToRead={nextItem}
                  mediaId={mergedMedia.id}
                  pageProgress={pageProgress}
                  readChapterIds={readIds}
                  mediaType={mediaType}
                  onContinue={setActiveChapter}
                />
              </div>

              {episodesListNode}
            </div>
          </div>
        ) : (
          <>
            {isLoading ? (
              <div className="shrink-0">
                <HeroSkeleton />
              </div>
            ) : (
              <div className="shrink-0">
                <HeroSection
                  manga={normalized}
                  mediaType={mediaType}
                  extension={extension}
                  isFullySupported={isFullySupported(extension || normalized.pkg || activeExtension || undefined)}
                  extLang={extLang}
                  onBrowseSource={() => {
                    setActiveChapter(null)
                    setActiveTab('browse')
                    setSelectedManga(null)
                  }}
                />
              </div>
            )}

            <div className="shrink-0">
              <ActionBar
                isInLibrary={isInLibrary}
                isPending={isToggling}
                onToggleLibrary={toggleLibrary}
                mediaUrl={normalized.url}
                manga={normalized}
                mediaType={mediaType}
              />
            </div>

            <div className="p-6 max-w-7xl mx-auto w-full flex-1 flex flex-col space-y-6">
              <div className="shrink-0">
                <SynopsisCard
                  description={normalized.description}
                  genres={normalized.genres}
                  isAnime={isAnime}
                />
              </div>

              {!isInlineWatchActive && (
                <div className="shrink-0">
                  <ContinueBanner
                    nextToRead={nextItem}
                    mediaId={mergedMedia.id}
                    pageProgress={pageProgress}
                    readChapterIds={readIds}
                    mediaType={mediaType}
                    onContinue={setActiveChapter}
                  />
                </div>
              )}

              {episodesListNode}
            </div>
          </>
        )
      )}
    </div>
  )
}
