import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  useLibraryStore,
  useDownloadStore,
  useSettingsStore,
  useUIStore,
  useExtensionStore
} from '@renderer/shared/model'
import { Download, Loader2, Play, Trash2 } from 'lucide-react'
import { DataService } from '@renderer/shared/api'
import { Manga } from '@common/types'
import { resolveExtensionBadge } from '@common/services/repoIdentity'
import {
  MediaTabSwitcher,
  MediaGrid,
  MediaGridItem,
  Button,
  Badge,
  Dialog,
  EmptyState,
  LayoutSwitcher,
  MediaList,
  MediaListItem,
  MobilePage
} from '@renderer/shared/ui'
import { DownloadManager } from '@renderer/widgets/download-queue'
import { cn } from '@renderer/shared/lib/utils'

export default function DownloadsPage(): React.JSX.Element {
  const { downloadsMediaType: activeTab, setDownloadsMediaType: setActiveTab } = useSettingsStore()
  const { setSelectedManga } = useLibraryStore()
  const { installedExtensions } = useExtensionStore()
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
    <MobilePage
      title="Downloads"
      subtitle={activeTab === 'anime' ? 'Offline Anime' : 'Offline Manga'}
      actions={
        <div className="flex items-center gap-2">
          {downloads.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-destructive transition-colors shrink-0"
              onClick={() => setIsConfirmClearOpen(true)}
            >
              <Trash2 className="h-4.5 w-4.5" />
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'h-8 gap-2 font-medium px-3 transition-colors',
              pendingCount > 0
                ? 'text-primary bg-primary/10 border-primary/40'
                : 'text-muted-foreground'
            )}
            onClick={() => setIsManagerOpen(true)}
          >
            <Download className="h-3.5 w-3.5" />
            {pendingCount > 0 && (
              <Badge variant="default" className="h-4 px-1.5 min-w-[18px] bg-primary text-[10px]">
                {pendingCount}
              </Badge>
            )}
            <span className="hidden sm:inline">Queue</span>
          </Button>
        </div>
      }
      headerExtra={
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1">
          <div className="flex-1 min-w-fit">
            <MediaTabSwitcher
              activeTab={activeTab}
              onTabChange={(t) => setActiveTab(t as 'manga' | 'anime')}
            />
          </div>
          <div className="shrink-0">
            <LayoutSwitcher />
          </div>
        </div>
      }
    >
      <DownloadManager isOpen={isManagerOpen} onClose={() => setIsManagerOpen(false)} />

      <Dialog
        isOpen={isConfirmClearOpen}
        onClose={() => setIsConfirmClearOpen(false)}
        title={`Clear ${activeTab === 'anime' ? 'Anime' : 'Manga'} Downloads?`}
      >
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Are you sure you want to clear your entire {activeTab} downloads? This will remove all
            downloaded {activeTab === 'anime' ? 'episodes' : 'chapters'} from this list.
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

      <div className="flex-1 flex flex-col">
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
              description={`You haven't downloaded any ${activeTab} yet. Go to a title to start downloading ${activeTab === 'anime' ? 'episodes' : 'chapters'}.`}
            />
          </div>
        ) : (
          <div className="flex-1 pb-6">
            {viewMode === 'grid' ? (
              <MediaGrid>
                {downloads.map((manga, idx) => {
                  const src = resolveExtensionBadge(manga.pkg, installedExtensions)
                  return (
                    <MediaGridItem
                      key={manga.id}
                      title={manga.title}
                      coverUrl={manga.coverUrl}
                      mediaType={activeTab}
                      sourceName={src?.name}
                      sourceColor={src?.color}
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
                  const src = resolveExtensionBadge(manga.pkg, installedExtensions)
                  return (
                    <MediaListItem
                      key={manga.id}
                      title={manga.title}
                      coverUrl={manga.coverUrl}
                      mediaType={activeTab}
                      sourceName={src?.name}
                      sourceColor={src?.color}
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
        )}
      </div>
    </MobilePage>
  )
}
