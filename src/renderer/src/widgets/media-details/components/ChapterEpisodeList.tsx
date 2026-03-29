import { useState, useMemo } from 'react'
import {
  Search, RefreshCw, Play, Download,
  CheckCircle, Loader2, Trash2, CalendarDays
} from 'lucide-react'
import { Button, Input, ErrorState, ChapterItemSkeleton } from '@renderer/shared/ui'
import { DataService } from '@renderer/shared/api'
import { cn } from '@renderer/shared/lib/utils'
import { Chapter } from '@renderer/shared/api/sources/types'

interface ChapterEpisodeListProps {
  items: Chapter[]
  readChapterIds: string[]
  pageProgress?: Record<string, number>
  downloadStatuses: Record<string, 'pending' | 'downloading' | 'completed' | 'error' | 'paused' | 'none'>
  mediaType: 'manga' | 'anime'
  isLoading?: boolean
  error?: string | null
  extLang: string
  onItemClick: (item: Chapter) => void
  onDownload: (item: Chapter) => void
  onRemoveDownload: (item: Chapter) => void
  onRefresh: () => void
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
  onRemoveDownload,
  onRefresh
}: ChapterEpisodeListProps) => {
  const [search, setSearch] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const isAnime = mediaType === 'anime'
  const prefix = isAnime ? (extLang === 'ar' ? 'الحلقة' : 'Episode') : (extLang === 'ar' ? 'الفصل' : 'Chapter')

  const filteredItems = useMemo(() => {
    const safeItems = Array.isArray(items) ? items : []
    let result = [...safeItems]
    if (search) {
      result = result.filter(item =>
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
        <h2 className="text-lg font-semibold">{(items || []).length} {isAnime ? 'Episodes' : 'Chapters'}</h2>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-8 w-8 hover:bg-primary/10", showSearch && "text-primary bg-primary/10")}
            onClick={() => setShowSearch(!showSearch)}
          >
            <Search className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-8 gap-1 text-muted-foreground hover:text-primary"
            onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
          >
            <RefreshCw className={cn("h-3.5 w-3.5 transition-transform", sortOrder === 'asc' && "rotate-180")} />
            {sortOrder === 'desc' ? 'Newest' : 'Oldest'}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRefresh}>
            <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
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
          const isRead = readChapterIds.includes(item.id)
          const downloadStatus = downloadStatuses[item.id] || 'none'

          return (
            <div
              key={item.id}
              className={cn(
                "flex items-center justify-between w-full px-4 py-4 hover:bg-primary/5 transition-all duration-200 group cursor-pointer",
                isRead && "opacity-60"
              )}
              onClick={() => onItemClick(item)}
            >
              <div className="flex-1 flex flex-col items-start text-left min-w-0 pr-4">
                <div className="flex items-center gap-2 max-w-full">
                  <span className={cn(
                    "font-semibold text-sm transition-colors truncate",
                    isRead ? "text-muted-foreground" : "text-foreground group-hover:text-primary"
                  )}>
                    {prefix} {item.number}
                  </span>
                  {isRead && <CheckCircle className="h-3 w-3 text-primary fill-primary/10 flex-shrink-0" />}

                  {/* Partial Progress */}
                  {pageProgress[item.id] > 1 && !isRead && (
                    <span className="text-[9px] uppercase font-bold bg-primary/20 text-primary px-1.5 py-0.5 rounded ml-1 whitespace-nowrap flex-shrink-0">
                      {isAnime ? `${Math.floor(pageProgress[item.id] / 60)}m` : `Page ${pageProgress[item.id]}`}
                    </span>
                  )}

                  {/* Most Recently Read */}
                  {isRead && readChapterIds[readChapterIds.length - 1] === item.id && (
                    <span className="text-[9px] uppercase font-bold bg-secondary/80 text-secondary-foreground px-1.5 py-0.5 rounded ml-1 whitespace-nowrap flex-shrink-0">
                      Last Read
                    </span>
                  )}
                </div>
                {item.title && (
                  <p className="text-[11px] text-muted-foreground truncate w-full mt-0.5 opacity-80 group-hover:opacity-100 transition-opacity">
                    {item.title}
                  </p>
                )}
                {item.date && (
                  <div className="flex items-center gap-1.5 mt-1 text-[10px] text-muted-foreground opacity-70 group-hover:opacity-100 transition-opacity font-medium">
                    <CalendarDays className="h-3 w-3" />
                    <span dir='auto'>{item.date}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {!isAnime && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-muted-foreground hover:text-primary transition-all opacity-0 group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation()
                      downloadStatus === 'completed' ? onRemoveDownload(item) : onDownload(item)
                    }}
                  >
                    {downloadStatus === 'downloading' ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
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
                  className="h-9 w-9 text-primary opacity-0 group-hover:opacity-100"
                >
                  <Play className={cn("h-4 w-4", !isAnime && "fill-current")} />
                </Button>
              </div>
            </div>
          )
        })}
        {!isLoading && filteredItems.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm italic">
            {search ? `No ${isAnime ? 'episodes' : 'chapters'} matching "${search}"` : `No ${isAnime ? 'episodes' : 'chapters'} available.`}
          </div>
        )}
      </div>
    </div>
  )
}
