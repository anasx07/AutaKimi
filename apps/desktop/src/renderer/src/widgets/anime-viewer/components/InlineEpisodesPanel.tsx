import { memo, ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { Play, Search, ArrowUpDown, CheckCircle } from 'lucide-react'
import { Button, Input, SeasonSelector } from '@renderer/shared/ui'
import { cn } from '@renderer/shared/lib/utils'
import { Chapter, MediaSeason } from '@renderer/shared/api/sources/types'

export interface InlineEpisodesPanelProps {
  episodes: Chapter[]
  activeChapterId: string
  readChapterIds: string[]
  pageProgress?: Record<string, number>
  extLang: string
  onSelectEpisode: (ep: Chapter) => void
  topContent?: ReactNode
  seasons?: MediaSeason[]
  activeSeasonUrl?: string | null
  onSelectSeason?: (url: string) => void
}

export const InlineEpisodesPanel = memo(function InlineEpisodesPanel({
  episodes,
  activeChapterId,
  readChapterIds,
  pageProgress = {},
  extLang,
  onSelectEpisode,
  topContent,
  seasons,
  activeSeasonUrl,
  onSelectSeason
}: InlineEpisodesPanelProps) {
  const [search, setSearch] = useState('')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const activeItemRef = useRef<HTMLButtonElement | null>(null)

  const prefix = extLang === 'ar' ? 'الحلقة' : 'Episode'

  const filteredEpisodes = useMemo(() => {
    const q = search.trim().toLowerCase()
    return episodes
      .filter((ep) => {
        if (!q) return true
        return (
          String(ep.number).toLowerCase().includes(q) ||
          (ep.title && ep.title.toLowerCase().includes(q))
        )
      })
      .sort((a, b) => {
        const na = parseFloat(String(a.number || '0'))
        const nb = parseFloat(String(b.number || '0'))
        return sortOrder === 'asc' ? na - nb : nb - na
      })
  }, [episodes, search, sortOrder])

  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [activeChapterId])

  return (
    <div className="rounded-xl border border-border bg-card flex flex-col overflow-hidden h-[420px] lg:h-full min-h-0">
      {topContent}

      <SeasonSelector
        compact
        seasons={seasons}
        activeSeasonUrl={activeSeasonUrl}
        onSelectSeason={onSelectSeason}
      />

      {/* Header */}
      <div className="px-3.5 py-2.5 border-b border-border flex items-center justify-between gap-2 bg-card shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold text-foreground">
            Episodes
          </span>
          <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[11px] font-semibold">
            {episodes.length}
          </span>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
          className="h-7 px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground gap-1"
          title={sortOrder === 'asc' ? 'Showing Oldest First' : 'Showing Latest First'}
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          {sortOrder === 'asc' ? 'Oldest' : 'Latest'}
        </Button>
      </div>

      {/* Quick Search for large series */}
      {episodes.length >= 12 && (
        <div className="px-3 py-2 border-b border-border/60 bg-background/40 shrink-0">
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Jump to episode..."
              className="h-8 pl-8 text-xs bg-background border-border"
            />
          </div>
        </div>
      )}

      {/* Episode List */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1 custom-scrollbar">
        {filteredEpisodes.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
            No matching episodes
          </div>
        ) : (
          filteredEpisodes.map((ep) => {
            const isActive = ep.id === activeChapterId
            const isRead = readChapterIds.includes(ep.id)
            const savedSec = pageProgress[ep.id] || 0

            return (
              <button
                key={ep.id}
                ref={isActive ? activeItemRef : null}
                type="button"
                onClick={() => onSelectEpisode(ep)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors border',
                  isActive
                    ? 'bg-primary text-primary-foreground border-primary'
                    : isRead
                      ? 'bg-secondary/30 border-transparent text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                      : 'bg-background/60 border-border/60 text-foreground hover:bg-secondary/60 hover:border-border'
                )}
              >
                <div
                  className={cn(
                    'h-7 w-7 rounded-md flex items-center justify-center shrink-0 text-xs font-semibold',
                    isActive
                      ? 'bg-white/20 text-white'
                      : isRead
                        ? 'bg-secondary text-muted-foreground'
                        : 'bg-primary/10 text-primary'
                  )}
                >
                  {ep.number}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold truncate">
                      {prefix} {ep.number}
                    </span>
                    {!isActive && isRead && (
                      <CheckCircle className="h-3 w-3 text-emerald-500 shrink-0" />
                    )}
                  </div>
                  {ep.title ? (
                    <p
                      className={cn(
                        'text-[11px] truncate mt-0.5',
                        isActive ? 'text-white/80' : 'text-muted-foreground'
                      )}
                    >
                      {ep.title}
                    </p>
                  ) : !isActive && savedSec > 10 && !isRead ? (
                    <p className="text-[11px] text-primary font-medium mt-0.5">
                      Resume at {Math.floor(savedSec / 60)}:
                      {String(Math.floor(savedSec % 60)).padStart(2, '0')}
                    </p>
                  ) : null}
                </div>

                {isActive && <Play className="h-3.5 w-3.5 fill-current shrink-0" />}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
})
