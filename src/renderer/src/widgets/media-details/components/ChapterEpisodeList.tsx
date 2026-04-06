import { useState, useMemo, useEffect } from 'react'
import {
  Search,
  RefreshCw,
  Play,
  Download,
  CheckCircle,
  Loader2,
  Trash2,
  CalendarDays,
  XCircle
} from 'lucide-react'
import { Button, Input, ErrorState, ChapterItemSkeleton } from '@renderer/shared/ui'
import { DataService } from '@renderer/shared/api'
import { cn } from '@renderer/shared/lib/utils'
import { Chapter } from '@renderer/shared/api/sources/types'

interface ChapterEpisodeListProps {
  items: Chapter[]
  readChapterIds: string[]
  pageProgress?: Record<string, number>
  downloadStatuses: Record<
    string,
    'pending' | 'downloading' | 'completed' | 'error' | 'paused' | 'none'
  >
  downloadProgress?: Record<string, number>
  mediaType: 'manga' | 'anime'
  isLoading?: boolean
  error?: string | null
  extLang: string
  onItemClick: (item: Chapter) => void
  onDownload: (item: Chapter) => void
  onCancelDownload: (item: Chapter) => void
  onRemoveDownload: (item: Chapter) => void
  onRefresh: () => void
  defaultSortOrder?: 'asc' | 'desc'
}

export const ChapterEpisodeList = ({
  items,
  readChapterIds,
  pageProgress = {},
  downloadStatuses,
  mediaType,
  isLoading,
  error,
  extLang,
  onItemClick,
  onDownload,
  onCancelDownload,
  onRemoveDownload,
  onRefresh,
  downloadProgress = {},
  defaultSortOrder = 'desc'
}: ChapterEpisodeListProps): React.JSX.Element => {
  const [search, setSearch] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(defaultSortOrder)

  // Sync with default sort order when it changes in settings
  useEffect(() => {
    setSortOrder(defaultSortOrder)
  }, [defaultSortOrder])

  const isAnime = mediaType === 'anime'
  const prefix = isAnime
    ? extLang === 'ar'
      ? 'الحلقة'
      : 'Episode'
    : extLang === 'ar'
      ? 'الفصل'
      : 'Chapter'

  const filteredItems = useMemo(() => {
    const safeItems = Array.isArray(items) ? items : []
    let result = [...safeItems]
    if (search) {
      result = result.filter(
        (item) =>
          item.number?.toString().toLowerCase().includes(search.toLowerCase()) ||
          item.title?.toLowerCase().includes(search.toLowerCase())
      )
    }
    return result.sort((a, b) => {
      const numA = parseFloat(String(a.number || '0'))
      const numB = parseFloat(String(b.number || '0'))
      return sortOrder === 'desc' ? numB - numA : numA - numB
    })
  }, [items, search, sortOrder])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {(items || []).length} {isAnime ? 'Episodes' : 'Chapters'}
        </h2>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-8 w-8 hover:bg-primary/10',
              showSearch && 'text-primary bg-primary/10'
            )}
            onClick={() => setShowSearch(!showSearch)}
          >
            <Search className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-8 gap-1 text-muted-foreground hover:text-primary"
            onClick={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
          >
            <RefreshCw
              className={cn(
                'h-3.5 w-3.5 transition-transform',
                sortOrder === 'asc' && 'rotate-180'
              )}
            />
            {sortOrder === 'desc' ? 'Newest' : 'Oldest'}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRefresh}>
            <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {showSearch && (
        <div className="relative animate-in slide-in-from-top-2 duration-200">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={`Search ${isAnime ? 'episodes' : 'chapters'}...`}
            className="pl-9 h-10 border-primary/20 focus:border-primary/40"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>
      )}

      {isLoading && (!items || items.length === 0) && (
        <div className="divide-y divide-border/10 border border-border/10 rounded-xl bg-card/40 overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <ChapterItemSkeleton key={i} />
          ))}
        </div>
      )}

      {error && (!items || !items.length) && (
        <ErrorState
          title="Failed to fetch items"
          message={error}
          onRetry={onRefresh}
          onWebView={() => DataService.openInternalBrowser('https://google.com')} // Fallback, will be improved in MediaDetails
          className="bg-card/40 rounded-xl border border-border/10"
        />
      )}

      <div className="divide-y divide-border/10 border border-border/10 rounded-xl bg-card/40 overflow-hidden max-h-[600px] overflow-y-auto shadow-none scrollbar-thin scrollbar-thumb-primary/10 hover:scrollbar-thumb-primary/20">
        {filteredItems.map((item) => {
          const isFinished = readChapterIds.includes(item.id)
          const hasProgress = (pageProgress[item.id] || 0) > 1
          const isRead = isFinished || hasProgress
          const downloadStatus = downloadStatuses[item.id] || 'none'

          return (
            <div
              key={item.id}
              className={cn(
                'flex items-center justify-between w-full px-5 py-4 hover:bg-primary/5 transition-all duration-300 group cursor-pointer relative',
                'hover:shadow-[0_0_20px_rgba(var(--primary),0.05)] border-l-2 border-transparent hover:border-primary/40'
              )}
              onClick={() => onItemClick(item)}
            >
              <div className="flex-1 flex flex-col items-start text-left min-w-0 pr-4">
                <div className="flex items-center gap-2 max-w-full">
                  <span
                    className={cn(
                      'font-semibold text-sm transition-colors truncate',
                      isRead ? 'text-muted-foreground/70' : 'text-foreground group-hover:text-primary'
                    )}
                  >
                    {prefix} {item.number}
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {isFinished && (
                      <CheckCircle className="h-3.5 w-3.5 text-muted-foreground/40 fill-muted-foreground/10 flex-shrink-0" />
                    )}

                    {/* Partial Progress */}
                    {hasProgress && !isFinished && (
                      <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20 whitespace-nowrap flex-shrink-0">
                        {isAnime
                          ? `${Math.floor(pageProgress[item.id] / 60)}m`
                          : `P. ${pageProgress[item.id]}`}
                      </span>
                    )}

                    {/* Most Recently Read */}
                    {isFinished && readChapterIds[readChapterIds.length - 1] === item.id && (
                      <span className="text-[10px] font-bold bg-secondary/80 text-secondary-foreground px-2 py-0.5 rounded-full border border-secondary whitespace-nowrap flex-shrink-0">
                        Last Read
                      </span>
                    )}
                  </div>
                </div>
                {item.title && (
                  <p
                    className={cn(
                      'text-[11px] text-muted-foreground truncate w-full mt-0.5 opacity-80 group-hover:opacity-100 transition-opacity',
                      isRead && 'text-muted-foreground/50'
                    )}
                  >
                    {item.title}
                  </p>
                )}
                {item.date && (
                  <div
                    className={cn(
                      'flex items-center gap-1.5 mt-1 text-[10px] text-muted-foreground opacity-70 group-hover:opacity-100 transition-opacity font-medium',
                      isRead && 'text-muted-foreground/40'
                    )}
                  >
                    <CalendarDays className="h-3 w-3" />
                    <span dir="auto">{item.date}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {!isAnime && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      'h-10 w-10 text-muted-foreground/60 hover:text-primary transition-all duration-300 transform group-hover:scale-110',
                      isRead && 'opacity-80 bg-acc'
                    )}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (downloadStatus === 'downloading') {
                        onCancelDownload(item)
                      } else if (downloadStatus === 'completed') {
                        onRemoveDownload(item)
                      } else {
                        onDownload(item)
                      }
                    }}
                  >
                    {downloadStatus === 'downloading' ? (
                      <div className="relative flex items-center justify-center group/cancel">
                        {/* Progress State */}
                        <div className="flex items-center justify-center transition-all duration-300 group-hover/cancel:scale-0 group-hover/cancel:opacity-0">
                          <Loader2 className="h-4 w-4 animate-spin text-primary opacity-20" />
                          <span className="absolute text-[8px] font-bold text-primary">
                            {Math.round((downloadProgress?.[item.id] || 0) * 100)}%
                          </span>
                        </div>
                        {/* Cancel State (Visible on Hover) */}
                        <XCircle className="absolute h-5 w-5 text-destructive opacity-0 scale-50 transition-all duration-300 group-hover/cancel:opacity-100 group-hover/cancel:scale-110" />
                      </div>
                    ) : downloadStatus === 'completed' ? (
                      <Trash2 className="h-4 w-4 text-destructive" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'h-10 w-10 text-primary/70 hover:text-primary transition-all duration-300 transform group-hover:scale-110',
                    isRead && 'opacity-80'
                  )}
                >
                  <Play
                    className={cn(
                      'h-4 w-4 transition-transform group-hover:translate-x-0.5',
                      !isAnime && 'fill-current'
                    )}
                  />
                </Button>
              </div>
            </div>
          )
        })}
        {!isLoading && filteredItems.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm italic">
            {search
              ? `No ${isAnime ? 'episodes' : 'chapters'} matching "${search}"`
              : `No ${isAnime ? 'episodes' : 'chapters'} available.`}
          </div>
        )}
      </div>
    </div>
  )
}
