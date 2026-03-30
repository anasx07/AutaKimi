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
  MediaListItem
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
    <div className="flex flex-col h-full w-full p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 overflow-hidden">
      <div className="shrink-0 flex flex-col space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex flex-col space-y-1.5">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">History</h1>
              {allEntries.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 w-8 rounded-full mt-1"
                  onClick={() => setIsConfirmClearOpen(true)}
                  title="Clear All"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <p className="text-muted-foreground whitespace-nowrap">
              Your recently {activeTab === 'anime' ? 'watched anime' : 'read manga'}.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <LayoutSwitcher />
            <MediaTabSwitcher activeTab={activeTab} onTabChange={setActiveTab} />
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {isLoading && allEntries.length === 0 ? (
          <div className="flex-1 overflow-y-auto pr-2 pb-6">
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
          <div className="flex-1 overflow-y-auto pr-2 scroll-smooth">
            <div className="pb-20">
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
          </div>
        )}
      </div>

      <Dialog
        isOpen={isConfirmClearOpen}
        onClose={() => setIsConfirmClearOpen(false)}
        title="Clear History"
      >
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to clear your entire {activeTab} history? This action cannot be
            undone.
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setIsConfirmClearOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                await clearHistory(activeTab)
                queryClient.invalidateQueries({ queryKey: mangaKeys.history() })
                setIsConfirmClearOpen(false)
              }}
            >
              Clear All
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
