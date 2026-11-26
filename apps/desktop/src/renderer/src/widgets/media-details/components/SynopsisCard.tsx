import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Button, Badge, Card } from '@renderer/shared/ui'
import { cn } from '@renderer/shared/lib/utils'

interface SynopsisCardProps {
  description?: string
  genres?: string[]
  isAnime?: boolean
}

export const SynopsisCard = ({ description, genres, isAnime }: SynopsisCardProps) => {
  const [descExpanded, setDescExpanded] = useState(false)
  const bgClass = isAnime ? 'bg-primary/5 border-primary/10' : 'bg-secondary/10 border-border/20'
  const titleColor = isAnime ? 'text-primary' : ''

  return (
    <Card className={cn('p-4 rounded-xl space-y-2.5 shadow-none border', bgClass)}>
      <div className="flex items-center justify-between">
        <h2 className={cn('text-sm font-semibold', titleColor)}>Synopsis</h2>
        <Button
          variant="ghost"
          size="sm"
          className={cn('h-7 text-xs gap-1 text-muted-foreground', isAnime && 'hover:text-primary')}
          onClick={() => setDescExpanded(!descExpanded)}
        >
          {descExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {descExpanded ? 'Show less' : 'Show more'}
        </Button>
      </div>

      <div className={cn('relative', descExpanded && 'max-h-32 overflow-y-auto custom-scrollbar pr-1')}>
        <p
          className={cn(
            'text-xs sm:text-sm text-foreground/90 leading-relaxed whitespace-pre-line',
            !descExpanded && 'line-clamp-2'
          )}
          dir="auto"
        >
          {description || 'No description available.'}
        </p>
      </div>

      {genres && genres.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-2.5 border-t border-border/40">
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
