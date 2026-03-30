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
    <Card className={cn('p-5 backdrop-blur-md rounded-xl space-y-4 shadow-none', bgClass)}>
      <div className="flex items-center justify-between">
        <h2 className={cn('text-lg font-semibold', titleColor)}>Synopsis</h2>
        <Button
          variant="ghost"
          size="sm"
          className={cn('h-8 text-xs gap-1 text-muted-foreground', isAnime && 'hover:text-primary')}
          onClick={() => setDescExpanded(!descExpanded)}
        >
          {descExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {descExpanded ? 'Show less' : 'Show more'}
        </Button>
      </div>

      <div className="relative">
        <p
          className={cn(
            'text-sm text-foreground/90 leading-relaxed whitespace-pre-line transition-all duration-300',
            !descExpanded && 'line-clamp-3'
          )}
        >
          {description || 'No description available.'}
        </p>
        {!descExpanded && (description?.length || 0) > 200 && (
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background via-background/0 to-transparent pointer-events-none"></div>
        )}
      </div>

      {genres && genres.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-3 border-t border-border/10 mt-1">
          {genres.map((genre) => (
            <Badge
              key={genre}
              variant="secondary"
              className="px-3 py-1 rounded-full text-xs font-medium border-border/40 hover:bg-secondary/80 transition-colors"
            >
              {genre}
            </Badge>
          ))}
        </div>
      )}
    </Card>
  )
}
