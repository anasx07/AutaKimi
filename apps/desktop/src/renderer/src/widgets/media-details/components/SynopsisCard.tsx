import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Button, Badge, Card } from '@renderer/shared/ui'
import { cn } from '@renderer/shared/lib/utils'

interface SynopsisCardProps {
  description?: string
  genres?: string[]
  isAnime?: boolean
  inSidebar?: boolean
}

export const SynopsisCard = ({
  description,
  genres,
  isAnime,
  inSidebar = false
}: SynopsisCardProps) => {
  const [descExpanded, setDescExpanded] = useState(false)
  const bgClass = isAnime ? 'bg-primary/5 border-primary/15' : 'bg-card border-border'
  const titleColor = isAnime ? 'text-primary' : ''
  const textContent = description?.trim() || 'No description available.'
  const canExpand = !inSidebar && textContent.length > 160

  return (
    <Card
      className={cn(
        'p-4 rounded-xl shadow-none border flex flex-col gap-2.5',
        inSidebar && 'flex-1 min-h-0',
        bgClass
      )}
    >
      <div className="flex items-center justify-between shrink-0">
        <h2 className={cn('text-sm font-semibold', titleColor)}>Synopsis</h2>
        {canExpand && (
          <Button
            variant="ghost"
            size="sm"
            className={cn('h-7 text-xs gap-1 text-muted-foreground', isAnime && 'hover:text-primary')}
            onClick={() => setDescExpanded(!descExpanded)}
          >
            {descExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {descExpanded ? 'Show less' : 'Show more'}
          </Button>
        )}
      </div>

      <div
        className={cn(
          'relative',
          inSidebar
            ? 'flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1'
            : descExpanded && 'max-h-32 overflow-y-auto custom-scrollbar pr-1'
        )}
      >
        <p
          className={cn(
            'text-xs sm:text-sm text-foreground/90 leading-relaxed whitespace-pre-line',
            !inSidebar && !descExpanded && 'line-clamp-2'
          )}
          dir="auto"
        >
          {textContent}
        </p>
      </div>

      {genres && genres.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-2.5 border-t border-border/40 shrink-0">
          {genres.map((genre) => (
            <Badge
              key={genre}
              variant="secondary"
              className="px-2.5 py-0.5 rounded-full text-[11px] font-medium border-border hover:bg-secondary/80 transition-colors"
            >
              {genre}
            </Badge>
          ))}
        </div>
      )}
    </Card>
  )
}
