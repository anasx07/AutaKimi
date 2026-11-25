import { ReactNode } from 'react'
import { Card, CardContent, Badge } from './'
import { cn } from '@renderer/shared/lib/utils'
import { BookOpen, Play } from 'lucide-react'

interface MediaListProps {
  children: ReactNode
  className?: string
}

export function MediaList({ children, className }: MediaListProps) {
  return <div className={cn('flex flex-col gap-3', className)}>{children}</div>
}

interface MediaListItemProps {
  title: string
  coverUrl?: string | null
  mediaType?: 'manga' | 'anime'
  status?: string | null
  description?: string | null
  onClick: () => void
  badge?: ReactNode
  footerBadge?: ReactNode
  sourceName?: string | null
  sourceColor?: string | null
  className?: string
  index?: number
}

export function MediaListItem({
  title,
  coverUrl,
  mediaType = 'manga',
  status,
  description,
  onClick,
  badge,
  footerBadge,
  sourceName,
  sourceColor,
  className,
  index = 0
}: MediaListItemProps) {
  const Icon = mediaType === 'anime' ? Play : BookOpen

  return (
    <Card
      onClick={onClick}
      className={cn(
        'group relative cursor-pointer overflow-hidden border-border/40 hover:border-primary/40 hover:shadow-lg transition-all duration-300 hover:translate-x-1 bg-card/40 backdrop-blur-sm h-24 flex items-center',
        'animate-in fade-in slide-in-from-left-4',
        className
      )}
      style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
    >
      <div className="h-full aspect-[3/4] relative overflow-hidden bg-secondary/20 shrink-0">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Icon className="h-6 w-6 text-muted-foreground/30" />
          </div>
        )}
      </div>

      <CardContent className="flex-1 p-4 flex items-center justify-between min-w-0">
        <div className="flex flex-col gap-1 min-w-0">
          <h3
            className="font-semibold text-base line-clamp-1 group-hover:text-primary transition-colors"
            dir="auto"
          >
            {title}
          </h3>
          <div className="flex items-center gap-2">
            {sourceName && (
              <Badge
                variant="secondary"
                className="px-1.5 py-0 text-[10px] font-bold tracking-wide inline-flex items-center gap-1 bg-secondary/40 border border-border/50"
              >
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: sourceColor || 'hsl(var(--primary))' }}
                />
                <span className="truncate max-w-[120px]">{sourceName}</span>
              </Badge>
            )}
            {status && (
              <Badge
                variant="secondary"
                className="px-1.5 py-0 text-[10px] uppercase font-bold tracking-wider opacity-80"
                dir="auto"
              >
                {status}
              </Badge>
            )}
            {description && (
              <p
                className="text-xs text-muted-foreground line-clamp-1 opacity-70 group-hover:opacity-100 transition-opacity"
                dir="auto"
              >
                {description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <div className="flex flex-col items-end gap-1 text-[10px] text-muted-foreground uppercase tracking-wider font-semibold opacity-70 group-hover:opacity-100 transition-opacity">
            {badge}
          </div>
          {footerBadge}
        </div>
      </CardContent>
    </Card>
  )
}
