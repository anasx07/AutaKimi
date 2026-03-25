import { Clock, Trash2, BookOpen, Play, Loader2 } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useLibraryStore, useHistoryStore, useExtensionStore } from '@renderer/shared/model'
import { Button } from '@renderer/shared/ui'
import { cn } from '@renderer/shared/lib'
import { useInfiniteHistoryEntries } from '@renderer/entities/manga/api/useMangaQueries'

export default function HistoryPage() {
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
  } = useInfiniteHistoryEntries()

  const loadMoreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { threshold: 0.1 }
    )

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current)
    }

    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

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

  const handleEntryClick = (entry: any) => {
    if (entry.pkg) {
      setActiveExtension(entry.pkg)
    }

    setSelectedManga({
      id: entry.mangaId,
      title: entry.mangaTitle || 'Unknown',
      coverUrl: entry.mangaCover || '',
      url: entry.mangaUrl || entry.mangaId,
      status: '',
      description: '',
      genres: [],
    })
  }

  const handleContinueReading = (entry: any) => {
    if (entry.pkg) {
      setActiveExtension(entry.pkg)
    }

    setSelectedManga({
      id: entry.mangaId,
      title: entry.mangaTitle || 'Unknown',
      coverUrl: entry.mangaCover || '',
      url: entry.mangaUrl || entry.mangaId,
      status: '',
      description: '',
      genres: [],
    })

    setActiveChapter({
      id: entry.chapterId,
      attributes: {
        chapter: '',
        title: entry.chapterTitle || 'Chapter',
        createdAt: new Date().toISOString()
      }
    } as any)
  }

  const allEntries = data?.pages.flat() || []

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
  }, {} as Record<string, any>)

  const sortedGroupedHistory = Object.values(groupedHistory).sort((a: any, b: any) =>
    new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  )

  if (isLoading && allEntries.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" />
      </div>
    )
  }

  return (
    <div className="p-4 space-y-5 max-w-3xl mx-auto border-0 flex flex-col h-full">
      <div className="flex items-center justify-between pb-2">
        <h1 className="text-2xl font-bold tracking-tight">History</h1>

        {allEntries.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive gap-1 px-2 h-8"
            onClick={clearHistory}
            title="Clear All"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {sortedGroupedHistory.length === 0 && !isLoading ? (
        <div className="flex flex-col items-center justify-center py-32 text-muted-foreground space-y-3">
          <Clock className="h-14 w-14 stroke-[1.25] text-muted-foreground/30" />
          <p className="text-sm font-medium">No reading history</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pr-2">
          <div className="flex flex-col gap-4">
            {sortedGroupedHistory.map((entry: any) => (
              <div
                key={entry.mangaId}
                className={cn(
                  "flex items-start rounded-md gap-4 p-4 bg-card hover:bg-secondary/30 transition-all duration-200 hover:shadow-md border border-border/40 cursor-pointer group relative",
                  "animate-in fade-in slide-in-from-bottom-4"
                )}
                onClick={() => handleEntryClick(entry)}
              >
                {entry.mangaCover ? (
                  <img
                    src={entry.mangaCover}
                    alt={entry.mangaTitle}
                    className="w-24 h-30 object-cover rounded shadow-sm bg-secondary flex-shrink-0"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-24 h-32 rounded bg-secondary flex items-center justify-center flex-shrink-0">
                    <BookOpen className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                )}

                <div className="flex-1 min-w-0 flex flex-col justify-center space-y-0.5">
                  <h3 dir='auto' className="text-sm font-bold truncate text-foreground group-hover:text-primary transition-colors">
                    {entry.mangaTitle || 'Unknown Manga'}
                  </h3>

                  <span className="text-xs text-muted-foreground truncate">
                    {entry.chapterTitle || 'Chapter ' + entry.chapterId}
                  </span>

                  <div className="flex flex-col pt-0.5 space-y-0.5">
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/80">
                      <BookOpen className="h-3.5 w-3.5 inline text-muted-foreground/60" />
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
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteHistoryByManga(entry.mangaId)
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
    </div>
  )
}
