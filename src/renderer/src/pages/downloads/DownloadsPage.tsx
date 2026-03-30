import { useState, useEffect, useMemo, useCallback } from 'react'
import { useLibraryStore, useDownloadStore } from '@renderer/shared/model'
import { Download, Loader2, Play, Trash2, LayoutList } from 'lucide-react'
import { DataService } from '@renderer/shared/api'
import { useUIStore } from '@renderer/shared/model'
import { Manga } from '@common/types'
import {
  MediaTabSwitcher,
  MediaGrid,
  MediaGridItem,
  Button,
  Dialog,
  EmptyState,
  LayoutSwitcher,
  MediaList,
  MediaListItem
} from '@renderer/shared/ui'
import { DownloadManager } from '@renderer/widgets/download-queue'

export default function DownloadsPage(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<'manga' | 'anime'>('manga')
  const { setSelectedManga } = useLibraryStore()
  const { viewMode } = useUIStore()
  const { activeTasks, downloadQueue } = useDownloadStore()
  const [downloads, setDownloads] = useState<Manga[]>([])
  const [loading, setLoading] = useState(true)
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false)
  const [isManagerOpen, setIsManagerOpen] = useState(false)

  const pendingCount = useMemo(() => {
    return Object.keys(activeTasks).length + downloadQueue.length
  }, [activeTasks, downloadQueue])

  const fetchDownloads = useCallback(async (): Promise<void> => {
    try {
      setLoading(true)
      const mangaList = (await DataService.download.getAllMangaDownloads(
        activeTab
      )) as unknown as Manga[]
      setDownloads(mangaList || [])
    } catch (e) {
      console.error('Failed to fetch downloaded manga', e)
      setDownloads([])
    } finally {
      setLoading(false)
    }
  }, [activeTab])

  const handleClearDownloads = async (): Promise<void> => {
    try {
      await DataService.download.clearAll(activeTab)
      await fetchDownloads()
      setIsConfirmClearOpen(false)
    } catch (error) {
      console.error('Failed to clear downloads:', error)
    }
  }

  useEffect((): void => {
    fetchDownloads()
  }, [fetchDownloads])

  return (
    <div className="flex flex-col h-full w-full p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 overflow-hidden">
      <div className="shrink-0 flex flex-col space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex flex-col space-y-1.5">
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">Downloads</h1>
              {downloads.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive transition-colors"
                  onClick={() => setIsConfirmClearOpen(true)}
                  title={`Clear all ${activeTab}`}
                >
                  <Trash2 className="h-4.5 w-4.5" />
                </Button>
              )}
            </div>
            <p className="text-muted-foreground whitespace-nowrap">
              {activeTab === 'anime' ? 'Anime' : 'Manga'} available for offline{' '}
              {activeTab === 'anime' ? 'viewing' : 'reading'}.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative group">
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-2 font-bold px-3 border-primary/20 hover:border-primary/40 text-primary"
                onClick={() => setIsManagerOpen(true)}
              >
                <LayoutList className="h-4 w-4" />
                Manager
              </Button>
              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground shadow-sm ring-2 ring-background animate-in zoom-in-50 duration-300">
                  {pendingCount}
                </span>
              )}
            </div>
            <LayoutSwitcher />
            <MediaTabSwitcher activeTab={activeTab} onTabChange={setActiveTab} />
          </div>
        </div>
      </div>

      <DownloadManager isOpen={isManagerOpen} onClose={() => setIsManagerOpen(false)} />

      <Dialog
        isOpen={isConfirmClearOpen}
        onClose={() => setIsConfirmClearOpen(false)}
        title={`Clear ${activeTab === 'anime' ? 'Anime' : 'Manga'} Downloads?`}
      >
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Are you sure you want to clear your entire {activeTab} downloads? This will remove all
            downloaded chapters from this list.
          </p>
          <div className="flex gap-3 justify-end w-full">
            <Button variant="outline" onClick={() => setIsConfirmClearOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleClearDownloads}>
              Clear All
            </Button>
          </div>
        </div>
      </Dialog>

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 pb-40">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">Loading downloaded {activeTab}...</p>
          </div>
        ) : downloads.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 pb-40">
            <EmptyState
              icon={
                activeTab === 'anime' ? (
                  <Play className="h-8 w-8 text-primary ml-1" />
                ) : (
                  <Download className="h-8 w-8 text-primary" />
                )
              }
              title={`No ${activeTab} downloaded`}
              description={`You haven't downloaded any ${activeTab} yet. Go to a title to start downloading chapters.`}
            />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto pr-2 scroll-smooth">
            <div className="pb-20">
              {viewMode === 'grid' ? (
                <MediaGrid>
                  {downloads.map((manga, idx) => {
                    return (
                      <MediaGridItem
                        key={manga.id}
                        title={manga.title}
                        coverUrl={manga.coverUrl}
                        mediaType={activeTab}
                        index={idx}
                        onClick={() =>
                          setSelectedManga({
                            ...manga,
                            mediaType: manga.mediaType || activeTab
                          })
                        }
                      />
                    )
                  })}
                </MediaGrid>
              ) : (
                <MediaList>
                  {downloads.map((manga, idx) => {
                    return (
                      <MediaListItem
                        key={manga.id}
                        title={manga.title}
                        coverUrl={manga.coverUrl}
                        mediaType={activeTab}
                        index={idx}
                        onClick={() =>
                          setSelectedManga({
                            ...manga,
                            mediaType: manga.mediaType || activeTab
                          })
                        }
                      />
                    )
                  })}
                </MediaList>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
