import { Clock, Trash2, BookOpen, Play, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useLibraryStore, useHistoryStore, useExtensionStore, HistoryEntry, Manga, Chapter } from '@renderer/shared/model'
import { Button, MediaTabSwitcher, Dialog, EmptyState, HistoryItemSkeleton } from '@renderer/shared/ui'
import { useInfiniteScroll } from '@renderer/shared/lib'
import { cn } from '@renderer/shared/lib/utils'
import { useInfiniteHistoryEntries, mangaKeys } from '@renderer/entities/manga/api/useMangaQueries'

export default function HistoryPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'manga' | 'anime'>('manga')
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false)
  const { setSelectedManga, setActiveChapter } = useLibraryStore()
  const { setActiveExtension } = useExtensionStore()
  const {
    clearHistory,
    deleteHistoryByManga
  } = useHistoryStore()

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage
  } = useInfiniteHistoryEntries(activeTab)

  const loadMoreRef = useInfiniteScroll({
    hasNextPage,
    isFetchingNextPage: !!isFetchingNextPage,
    fetchNextPage
  })

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
  }

  const formatTimeAgo = (isoString: string) => {
    const date = new Date(isoString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSecs = Math.floor(diffMs / 1000)
    const diffMins = Math.floor(diffSecs / 60)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffSecs < 60) return 'Just now'
    if (diffMins < 60) return `${diffMins}m`
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const deriveTitle = (entry: HistoryEntry): string => {
    const raw = entry.mangaTitle?.trim()
    if (raw) return raw
    const source = entry.mangaUrl || entry.mangaId || ''
    const slug = source.split('/').filter(Boolean).pop() || ''
    return slug
      ? slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      : 'Unknown Title'
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

  const handleEntryClick = (entry: HistoryEntry) => {
    if (entry.pkg) {
      setActiveExtension(entry.pkg)
    }
    setSelectedManga(historyToManga(entry))
  }

  const handleContinueReading = (entry: HistoryEntry) => {
    if (entry.pkg) {
      setActiveExtension(entry.pkg)
    }

    setSelectedManga(historyToManga(entry))

    setActiveChapter({
      id: entry.chapterId,
      title: entry.chapterTitle || 'Chapter',
      url: entry.mangaUrl || '',
      number: 0
    } as Chapter)
  }

  const allEntries = (data?.pages.flat() as HistoryEntry[]) || []

  // Group history entries by mangaId
  const groupedHistory = allEntries.reduce((acc, entry) => {
    const mangaId = entry.mangaId
    if (!acc[mangaId]) {
      acc[mangaId] = {
        ...entry,
        totalDuration: entry.durationSeconds,
      }
    } else {
      acc[mangaId].totalDuration += entry.durationSeconds
      // Update with most recent chapter metadata if this entry is newer
      if (new Date(entry.startedAt) > new Date(acc[mangaId].startedAt)) {
        acc[mangaId].chapterTitle = entry.chapterTitle
        acc[mangaId].chapterId = entry.chapterId
        acc[mangaId].startedAt = entry.startedAt
        acc[mangaId].mangaUrl = entry.mangaUrl
      }
    }
    return acc
  }, {} as Record<string, HistoryEntry & { totalDuration: number }>)

  const sortedGroupedHistory = Object.values(groupedHistory).sort((a, b) =>
    new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  )

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 flex-1 flex flex-col h-full animate-in fade-in duration-500">
      <div className="flex flex-col space-y-3">
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
            <p className="text-muted-foreground whitespace-nowrap">Your recently {activeTab === 'anime' ? 'watched anime' : 'read manga'}.</p>
          </div>
          <MediaTabSwitcher activeTab={activeTab} onTabChange={setActiveTab} />
        </div>
      </div>

      {isLoading && allEntries.length === 0 ? (
        <div className="flex-1 overflow-y-auto pr-2">
          <div className="flex flex-col gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <HistoryItemSkeleton key={i} />
            ))}
          </div>
        </div>
      ) : sortedGroupedHistory.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 pb-40">
          <EmptyState 
            icon={<Clock className="h-8 w-8 text-primary" />}
            title={`No ${activeTab} history`}
            description={`Your recently ${activeTab === 'anime' ? 'watched anime' : 'read manga'} will appear here.`}
          />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pr-2">
          <div className="flex flex-col gap-4">
            {sortedGroupedHistory.map((entry, idx) => (
              <div
                key={entry.mangaId}
                className={cn(
                  "flex items-start rounded-md gap-4 p-4 bg-card/40 backdrop-blur-sm hover:bg-secondary/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg border border-border/40 cursor-pointer group relative",
                  "animate-in fade-in slide-in-from-bottom-4"
                )}
                style={{ animationDelay: `${Math.min(idx * 30, 500)}ms` }}
                onClick={() => handleEntryClick(entry)}
              >
                {entry.mangaCover ? (
                  <img
                    src={entry.mangaCover}
                    alt={entry.mangaTitle}
                    className="w-24 h-32 object-cover rounded shadow-sm bg-secondary flex-shrink-0 group-hover:scale-[1.02] transition-transform duration-300"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-24 h-32 rounded bg-secondary flex items-center justify-center flex-shrink-0">
                    {activeTab === 'anime' ? (
                      <Play className="h-8 w-8 text-muted-foreground/40" />
                    ) : (
                      <BookOpen className="h-8 w-8 text-muted-foreground/40" />
                    )}
                  </div>
                )}

                <div className="flex-1 min-w-0 flex flex-col justify-center space-y-0.5">
                  <h3 dir='auto' className="text-sm font-bold truncate text-foreground group-hover:text-primary transition-colors">
                    {deriveTitle(entry)}
                  </h3>

                  <span className="text-xs text-muted-foreground truncate">
                    {entry.type === 'anime' ? 'Episode ' : 'Chapter '}
                    {entry.chapterTitle || entry.chapterId}
                  </span>

                  <div className="flex flex-col pt-0.5 space-y-0.5">
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/80">
                      {entry.type === 'anime' ? (
                        <Play className="h-3.5 w-3.5 inline text-muted-foreground/60" />
                      ) : (
                        <BookOpen className="h-3.5 w-3.5 inline text-muted-foreground/60" />
                      )}
                      <span>{formatDuration(entry.totalDuration)}</span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/80">
                      <Clock className="h-3.5 w-3.5 inline text-muted-foreground/60" />
                      <span>{formatTimeAgo(entry.startedAt)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 h-8 gap-1 px-3 text-xs bg-primary hover:bg-primary/90 text-primary-foreground transition-all flex items-center"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleContinueReading(entry)
                    }}
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    Continue
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0 rounded-full transition-all"
                    onClick={async (e) => {
                      e.stopPropagation()
                      await deleteHistoryByManga(entry.mangaId)
                      queryClient.invalidateQueries({ queryKey: mangaKeys.history() })
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Intersection Observer Anchor */}
          <div ref={loadMoreRef} className="h-20 flex items-center justify-center mt-4">
            {isFetchingNextPage && (
              <Loader2 className="h-6 w-6 animate-spin text-primary opacity-50" />
            )}
            {!hasNextPage && allEntries.length > 0 && (
              <p className="text-xs text-muted-foreground opacity-50 italic">No more history</p>
            )}
          </div>
        </div>
      )}

      <Dialog 
        isOpen={isConfirmClearOpen} 
        onClose={() => setIsConfirmClearOpen(false)}
        title="Clear History"
      >
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to clear your entire {activeTab} history? This action cannot be undone.
          </p>
          <div className="flex gap-3 justify-end">
            <Button 
              variant="outline" 
              onClick={() => setIsConfirmClearOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={async () => {
                await clearHistory()
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
