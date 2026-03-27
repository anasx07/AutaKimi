import { useEffect, useState, useRef } from 'react'
import { ArrowLeft, Share2, Download, MoreVertical, ShieldAlert } from 'lucide-react'
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
import { cn } from '@renderer/shared/lib/utils'
import { normalizeManga } from '@common/utils/mangaNormalizer'
import { 
  useMangaDetails, 
  useMangaChapters, 
  useToggleLibrary, 
  useIsMangaInLibrary 
} from '@renderer/entities/manga/api/useMangaQueries'
import {
  useAnimeDetails,
  useAnimeEpisodes,
  useToggleAnimeLibrary,
  useIsAnimeInLibrary
} from '@renderer/entities/anime/api/useAnimeQueries'
import { ExtensionResolver } from '@renderer/shared/api/sources/resolver'
import { isFullySupported } from '@renderer/shared/api/sources'
import { Chapter } from '@renderer/shared/api/sources/types'

// Sub-components
import { HeroSection } from './components/HeroSection'
import { ActionBar } from './components/ActionBar'
import { SynopsisCard } from './components/SynopsisCard'
import { ContinueBanner } from './components/ContinueBanner'
import { ChapterEpisodeList } from './components/ChapterEpisodeList'

export type DownloadStatus = 'pending' | 'downloading' | 'completed' | 'error' | 'paused' | 'none'

interface MediaDetailsProps {
  mediaType: 'manga' | 'anime'
}

export default function MediaDetails({ mediaType }: MediaDetailsProps) {
  const isAnime = mediaType === 'anime'
  const { setActiveTab } = useUIStore()
  const { selectedManga, setSelectedManga, setActiveChapter } = useLibraryStore()
  const { activeExtension, installedExtensions } = useExtensionStore()
  const { readingProgress, pageProgress, loadProgress } = useProgressStore()
  const { downloadQueue, addToDownloadQueue } = useDownloadStore()
  
  const [downloadStatuses, setDownloadStatuses] = useState<Record<string, DownloadStatus>>({})
  const [showDownloadMenu, setShowDownloadMenu] = useState(false)
  const downloadMenuRef = useRef<HTMLDivElement>(null)

  // Queries
  const { detailQuery, chaptersQuery } = (() => {
    const pkgToUse = selectedManga?.pkg || activeExtension;
    const mangaId = selectedManga?.id || '';
    const mangaUrl = selectedManga?.url;

    if (isAnime) {
      const d = useAnimeDetails(mangaId, pkgToUse, mangaUrl)
      const c = useAnimeEpisodes(mangaId, pkgToUse, mangaUrl)
      return { detailQuery: d, chaptersQuery: c }
    } else {
      const d = useMangaDetails(mangaId, pkgToUse, mangaUrl)
      const c = useMangaChapters(mangaId, pkgToUse, mangaUrl)
      return { detailQuery: d, chaptersQuery: c }
    }
  })()

  const { data: items = [] } = chaptersQuery
  const loading = detailQuery.isLoading || chaptersQuery.isLoading
  const error = (detailQuery.error as Error)?.message || (chaptersQuery.error as Error)?.message || null

  const mangaToggle = useToggleLibrary()
  const animeToggle = useToggleAnimeLibrary()
  const toggleLibraryMutation = isAnime ? animeToggle : mangaToggle

  const mangaInLib = useIsMangaInLibrary(!isAnime ? selectedManga?.id || '' : '')
  const animeInLib = useIsAnimeInLibrary(isAnime ? selectedManga?.id || '' : '')
  const isInLibrary = isAnime ? !!animeInLib.data : !!mangaInLib.data
  const readIds = selectedManga ? (readingProgress[selectedManga.id] || []) : []

  const extension = installedExtensions.find(e => e.pkg === (selectedManga?.pkg || activeExtension))
  const pkgParts = (selectedManga?.pkg || activeExtension)?.split('.') || []
  const extLang = extension?.lang || (pkgParts.length >= 4 ? pkgParts[3] : 'all')
  const normalized = normalizeManga(selectedManga, extLang)

  // Effects
  useEffect(() => {
    if (selectedManga) loadProgress(selectedManga.id)
  }, [selectedManga?.id])

  useEffect(() => {
    if (detailQuery.data && selectedManga) {
      const fresh = detailQuery.data
      const hasChanged = 
        fresh.description !== selectedManga.description ||
        fresh.status !== selectedManga.status ||
        fresh.author !== selectedManga.author
      
      const updatedTitle = (fresh.title && fresh.title !== 'Untitled' && !/^\d+$/.test(fresh.title)) 
        ? fresh.title 
        : (selectedManga.title || fresh.title)

      if (hasChanged) {
        setSelectedManga({ 
          ...selectedManga, 
          ...fresh, 
          title: updatedTitle,
          mediaType: fresh.mediaType as 'manga' | 'anime' 
        })
      }
    }
  }, [detailQuery.data, selectedManga?.id])

  useEffect(() => {
    let interval: any;
    if (selectedManga && !isAnime) {
      const poll = async () => {
        const downloads = await DataService.download.getMangaDownloads(selectedManga.id)
        if (downloads) {
          const statusMap = downloads.reduce((acc: Record<string, DownloadStatus>, d: DownloadEntry) => {
            acc[d.chapterId] = d.status as DownloadStatus
            return acc
          }, {})
          setDownloadStatuses(statusMap)
        }
      }
      poll()
      interval = setInterval(poll, 3000)
    }
    return () => clearInterval(interval)
  }, [selectedManga?.id, isAnime])

  // Click outside download menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(event.target as Node)) {
        setShowDownloadMenu(false)
      }
    }
    if (showDownloadMenu) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showDownloadMenu])

  // Handlers
  const handleDownload = async (chapter: Chapter) => {
    if (!selectedManga || !activeExtension) return
    try {
      setDownloadStatuses(prev => ({ ...prev, [chapter.id]: 'downloading' }))
      const runner = await ExtensionResolver.resolve(activeExtension)
      if (!runner) throw new Error('Extension not found')
      const pages = await runner.fetchPages(chapter.url)
      if (!pages || pages.length === 0) throw new Error('No pages found')
      await DataService.download.start({
        mangaId: selectedManga.id,
        chapterId: chapter.id,
        pageUrls: pages
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[MediaDetails] Download failed: ${msg}`)
      setDownloadStatuses(prev => ({ ...prev, [chapter.id]: 'error' }))
    }
  }

  const handleBulkDownload = (type: 'all' | 'unread' | 'next-5' | 'next-10') => {
    setShowDownloadMenu(false)
    if (!selectedManga || !activeExtension) return

    const ascItems = [...items].sort((a, b) => parseFloat(String(a.number || '0')) - parseFloat(String(b.number || '0')))
    const unreadItems = ascItems.filter(c => !readIds.includes(c.id))

    let targetItems: Chapter[] = []
    if (type === 'all') targetItems = ascItems
    else if (type === 'unread') targetItems = unreadItems
    else if (type === 'next-5') targetItems = unreadItems.slice(0, 5)
    else if (type === 'next-10') targetItems = unreadItems.slice(0, 10)

    const toDownload = targetItems.filter(c => {
      const isDownloaded = downloadStatuses[c.id] === 'completed'
      const isQueued = downloadQueue.some(q => q.chapter.id === c.id)
      const isDownloading = downloadStatuses[c.id] === 'downloading'
      return !isDownloaded && !isQueued && !isDownloading
    })

    if (toDownload.length === 0) return

    addToDownloadQueue(toDownload.map(c => ({
      mangaId: selectedManga.id,
      extension: activeExtension,
      chapter: c
    })))
  }

  const nextToRead = (() => {
    if (items.length === 0) return null
    const progMap = selectedManga ? pageProgress[selectedManga.id] : null
    if (progMap) {
      const itemWithProgress = Object.entries(progMap)
        .filter(([id, page]) => page > 1 && !readIds.includes(id))
        .sort((a, b) => b[1] - a[1])[0]
      if (itemWithProgress) {
        const found = items.find(c => c.id === itemWithProgress[0])
        if (found) return found
      }
    }
    const ascItems = [...items].sort((a, b) => parseFloat(String(a.number || '0')) - parseFloat(String(b.number || '0')))
    return ascItems.find(c => !readIds.includes(c.id)) || ascItems[0] || null
  })()

  if (!selectedManga) return null

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-y-auto anime-details-page">
      {/* Shared Header */}
      <div className="sticky top-0 z-50 flex items-center justify-between p-4 bg-background/60 backdrop-blur-md border-b border-border/50">
        <Button variant="ghost" size="icon" onClick={() => setSelectedManga(null)} className="h-8 w-8">
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
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => normalized.url && DataService.openExternal(normalized.url)}>
            <Share2 className="h-4.5 w-4.5" />
          </Button>
          {!isAnime && (
            <div className="relative" ref={downloadMenuRef}>
              <Button variant="ghost" size="icon" className={cn("h-8 w-8", showDownloadMenu && "bg-secondary/40")} onClick={() => setShowDownloadMenu(!showDownloadMenu)}>
                <Download className="h-4.5 w-4.5" />
              </Button>
              {showDownloadMenu && (
                <div className="absolute top-10 right-0 z-50 w-48 bg-card border border-border shadow-md rounded-md overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-1 space-y-0.5">
                    {['unread', 'next-5', 'next-10', 'all'].map((type) => (
                      <button
                        key={type}
                        onClick={() => handleBulkDownload(type as any)}
                        className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-secondary/50 rounded-sm transition-colors font-medium capitalize"
                      >
                         Download {type.replace('-', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreVertical className="h-4.5 w-4.5" />
          </Button>
        </div>
      </div>

      {detailQuery.isLoading ? (
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
        isPending={toggleLibraryMutation.isPending}
        onToggleLibrary={() => toggleLibraryMutation.mutate(selectedManga)}
        mediaUrl={normalized.url}
      />

      <div className="p-6 max-w-7xl mx-auto w-full flex-1 space-y-6">
        <SynopsisCard 
          description={normalized.description}
          genres={normalized.genres}
          isAnime={isAnime}
        />

        <ContinueBanner 
          nextToRead={nextToRead}
          mediaId={selectedManga.id}
          pageProgress={pageProgress}
          readChapterIds={readIds}
          mediaType={mediaType}
          onContinue={setActiveChapter}
        />

        <ChapterEpisodeList 
          items={items}
          readChapterIds={readIds}
          downloadStatuses={downloadStatuses}
          mediaType={mediaType}
          isLoading={loading}
          error={error}
          extLang={extLang}
          onItemClick={setActiveChapter}
          onDownload={handleDownload}
          onRemoveDownload={() => {}} // TODO: Implement removal
          onRefresh={() => chaptersQuery.refetch()}
        />
      </div>
    </div>
  )
}
