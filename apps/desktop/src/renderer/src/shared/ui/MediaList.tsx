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
  className
}: MediaListItemProps) {
  const Icon = mediaType === 'anime' ? Play : BookOpen

  return (
    <Card
      onClick={onClick}
      className={cn(
        'group relative cursor-pointer overflow-hidden border-border hover:border-primary/40 hover:bg-secondary/20 transition-colors duration-150 bg-card h-20 flex items-center rounded-xl',
        className
      )}
    >
      <div className="h-full aspect-[3/4] relative overflow-hidden bg-secondary/30 shrink-0">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-200"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Icon className="h-5 w-5 text-muted-foreground/40" />
          </div>
        )}
      </div>

      <CardContent className="flex-1 px-4 py-3 flex items-center justify-between min-w-0">
        <div className="flex flex-col gap-1 min-w-0">
          <h3
            className="font-semibold text-sm line-clamp-1 group-hover:text-primary transition-colors"
            dir="auto"
          >
            {title}
          </h3>
          <div className="flex items-center gap-2">
            {sourceName && (
              <Badge
                variant="secondary"
                className="px-1.5 py-0 text-[10px] font-medium inline-flex items-center gap-1 bg-secondary border border-border"
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
                className="px-1.5 py-0 text-[10px] font-medium opacity-90"
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
