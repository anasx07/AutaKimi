import { Layers } from 'lucide-react'
import { cn } from '@renderer/shared/lib/utils'
import { MediaSeason } from '@common/types'

interface SeasonSelectorProps {
  seasons?: MediaSeason[]
  activeSeasonUrl?: string | null
  onSelectSeason?: (season: MediaSeason) => void
  compact?: boolean
  className?: string
}

/**
 * Horizontal pill bar to switch between linked seasons/parts of a series.
 */
export function SeasonSelector({
  seasons,
  activeSeasonUrl,
  onSelectSeason,
  compact = false,
  className
}: SeasonSelectorProps) {
  if (!seasons || seasons.length <= 1 || !onSelectSeason) return null

  const currentUrl =
    activeSeasonUrl || seasons.find((s) => s.isCurrent)?.url || seasons[0]?.url

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 overflow-x-auto no-scrollbar',
        compact ? 'px-3 py-2 border-b border-border/60 bg-background/40 shrink-0' : 'pb-1',
        className
      )}
    >
      <div className="flex items-center gap-1 text-muted-foreground shrink-0 mr-1">
        <Layers className="h-3.5 w-3.5" />
        {!compact && <span className="text-xs font-medium">Seasons:</span>}
      </div>
      {seasons.map((season) => {
        const isActive = season.url === currentUrl
        return (
          <button
            key={season.id || season.url}
            type="button"
            onClick={() => onSelectSeason(season)}
            dir="auto"
            className={cn(
              'shrink-0 rounded-lg border font-medium transition-colors whitespace-nowrap',
              compact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs',
              isActive
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card border-border text-muted-foreground hover:text-foreground hover:bg-secondary/60'
            )}
          >
            {season.title}
          </button>
        )
      })}
    </div>
  )
}
