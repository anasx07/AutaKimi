import { Clock, Trash2, Loader2, X } from 'lucide-react'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  useLibraryStore,
  useHistoryStore,
  useExtensionStore,
  useUIStore,
  HistoryEntry,
  Manga
} from '@renderer/shared/model'
import {
  Button,
  MediaTabSwitcher,
  Dialog,
  EmptyState,
  MediaGrid,
  MediaGridItem,
  MediaCardSkeleton,
  Badge,
  LayoutSwitcher,
  MediaList,
  MediaListItem,
  MobilePage
} from '@renderer/shared/ui'
import { useInfiniteScroll } from '@renderer/shared/lib'
import { useInfiniteHistoryEntries, mangaKeys } from '@renderer/entities/manga/api/useMangaQueries'

export default function HistoryPage(): React.JSX.Element {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'manga' | 'anime'>('manga')
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false)
  const { setSelectedManga } = useLibraryStore()
  const { setActiveExtension } = useExtensionStore()
  const { clearHistory, deleteHistoryByManga } = useHistoryStore()
  const { viewMode } = useUIStore()

  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } =
    useInfiniteHistoryEntries(activeTab)

  const loadMoreRef = useInfiniteScroll({
    hasNextPage,
    isFetchingNextPage: !!isFetchingNextPage,
    fetchNextPage
  })

  const formatTimeAgo = (isoString: string): string => {
    const date = new Date(isoString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSecs = Math.floor(diffMs / 1000)
    const diffMins = Math.floor(diffSecs / 60)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffSecs < 60) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  const deriveTitle = (entry: HistoryEntry): string => {
    const raw = entry.mangaTitle?.trim()
    if (raw) return raw
    const source = entry.mangaUrl || entry.mangaId || ''
    const slug = source.split('/').filter(Boolean).pop() || ''
    return slug ? slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Unknown Title'
  }

  const historyToManga = (entry: HistoryEntry): Manga => ({
    id: entry.mangaId,
    title: deriveTitle(entry),
    coverUrl: entry.mangaCover || '',
    url: entry.mangaUrl || entry.mangaId,
    status: '',
    description: '',
    genres: [],
    mediaType: entry.type,
    pkg: entry.pkg
  })

  const handleEntryClick = (entry: HistoryEntry): void => {
    if (entry.pkg) {
      setActiveExtension(entry.pkg)
    }
    setSelectedManga(historyToManga(entry))
  }

  const allEntries = (data?.pages.flat() as HistoryEntry[]) || []

  // Group history entries by mangaId
  const groupedHistory = allEntries.reduce(
    (acc, entry) => {
      const mangaId = entry.mangaId
      if (!acc[mangaId]) {
        acc[mangaId] = {
          ...entry,
          totalDuration: entry.durationSeconds
        }
      } else {
        acc[mangaId].totalDuration += entry.durationSeconds
        if (new Date(entry.startedAt) > new Date(acc[mangaId].startedAt)) {
          acc[mangaId].chapterTitle = entry.chapterTitle
          acc[mangaId].chapterId = entry.chapterId
          acc[mangaId].startedAt = entry.startedAt
          acc[mangaId].mangaUrl = entry.mangaUrl
        }
      }
      return acc
    },
    {} as Record<string, HistoryEntry & { totalDuration: number }>
  )

  const sortedGroupedHistory = Object.values(groupedHistory).sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  )

  const handleDeleteEntry = async (e: React.MouseEvent, mangaId: string): Promise<void> => {
    e.stopPropagation()
    await deleteHistoryByManga(mangaId)
    queryClient.invalidateQueries({ queryKey: mangaKeys.history() })
  }

  return (
    <MobilePage
      title="History"
      subtitle="Continue where you left off"
      actions={
        allEntries.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 bg-secondary/30 rounded-xl hover:text-destructive transition-colors"
            onClick={() => setIsConfirmClearOpen(true)}
          >
            <Trash2 className="h-5 w-5" />
          </Button>
        )
      }
      headerExtra={
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1">
          <div className="flex-1 min-w-fit">
            <MediaTabSwitcher
              activeTab={activeTab === 'manga' ? 'manga' : 'anime'}
              onTabChange={(t) => setActiveTab(t as any)}
            />
          </div>
          <div className="shrink-0 bg-secondary/30 p-1 rounded-xl border border-border/50">
            <LayoutSwitcher />
          </div>
        </div>
      }
    >
      <div className="flex-1 flex flex-col">
        {isLoading && allEntries.length === 0 ? (
          <div className="flex-1 pb-6">
            <MediaGrid>
              {Array.from({ length: 12 }).map((_, i) => (
                <MediaCardSkeleton key={i} />
              ))}
            </MediaGrid>
          </div>
        ) : sortedGroupedHistory.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 pb-40">
            <EmptyState
              icon={<Clock className="h-8 w-8 text-primary" />}
              title={`No ${activeTab} history`}
              description={`Your recently ${activeTab === 'anime' ? 'watched anime' : 'read manga'} will appear here. Browse sources to discover and ${activeTab === 'anime' ? 'watch' : 'read'} to add ${activeTab === 'anime' ? 'anime' : 'manga'} to your history.`}
            />
          </div>
        ) : (
          <div className="flex-1 pb-6">
            {viewMode === 'grid' ? (
              <MediaGrid>
                {sortedGroupedHistory.map((entry, idx) => (
                  <MediaGridItem
                    key={entry.mangaId}
                    title={deriveTitle(entry)}
                    coverUrl={entry.mangaCover}
                    mediaType={activeTab}
                    index={idx}
                    onClick={() => handleEntryClick(entry)}
                    badge={
                      <Badge
                        variant="secondary"
                        className="px-1.5 py-0 text-[10px] uppercase font-bold tracking-wider"
                      >
                        {activeTab === 'anime' ? 'Ep. ' : 'Ch. '}
                        {entry.chapterTitle || entry.chapterId}
                      </Badge>
                    }
                    footerBadge={
                      <div className="flex items-center justify-between w-full">
                        <span className="text-[10px] text-muted-foreground/80 font-medium">
                          {formatTimeAgo(entry.startedAt)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all ml-1"
                          onClick={(e) => handleDeleteEntry(e, entry.mangaId)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    }
                  />
                ))}
              </MediaGrid>
            ) : (
              <MediaList>
                {sortedGroupedHistory.map((entry, idx) => (
                  <MediaListItem
                    key={entry.mangaId}
                    title={deriveTitle(entry)}
                    coverUrl={entry.mangaCover}
                    mediaType={activeTab}
                    index={idx}
                    onClick={() => handleEntryClick(entry)}
                    badge={
                      <Badge
                        variant="secondary"
                        className="px-1.5 py-0 text-[10px] uppercase font-bold tracking-wider"
                      >
                        {activeTab === 'anime' ? 'Ep. ' : 'Ch. '}
                        {entry.chapterTitle || entry.chapterId}
                      </Badge>
                    }
                    footerBadge={
                      <div className="flex items-center justify-between w-full">
                        <span className="text-[10px] text-muted-foreground/80 font-medium">
                          {formatTimeAgo(entry.startedAt)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all ml-1"
                          onClick={(e) => handleDeleteEntry(e, entry.mangaId)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    }
                  />
                ))}
              </MediaList>
            )}
            {/* Intersection Observer Anchor */}
            <div ref={loadMoreRef} className="h-20 flex items-center justify-center mt-6">
              {isFetchingNextPage && (
                <Loader2 className="h-6 w-6 animate-spin text-primary opacity-50" />
              )}
              {!hasNextPage && allEntries.length > 0 && (
                <p className="text-xs text-muted-foreground opacity-50 italic">No more history</p>
              )}
            </div>
          </div>
        )}
      </div>

      <Dialog
        isOpen={isConfirmClearOpen}
        onClose={() => setIsConfirmClearOpen(false)}
        title="Clear History?"
      >
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Are you sure you want to clear your entire history? This action cannot be undone.
          </p>
          <div className="flex gap-3 justify-end w-full">
            <Button variant="outline" onClick={() => setIsConfirmClearOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                await clearHistory()
                setIsConfirmClearOpen(false)
                queryClient.invalidateQueries({ queryKey: mangaKeys.history() })
              }}
            >
              Clear All
            </Button>
          </div>
        </div>
      </Dialog>
    </MobilePage>
  )
}
