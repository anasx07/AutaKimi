import { ReactNode, useState, useEffect } from 'react'
import { Card, CardContent } from './'
import { cn } from '@renderer/shared/lib/utils'
import { BookOpen, Play } from 'lucide-react'

interface MediaGridProps {
  children: ReactNode
  className?: string
}

export function MediaGrid({ children, className }: MediaGridProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 items-start content-start',
        className
      )}
    >
      {children}
    </div>
  )
}

interface MediaGridItemProps {
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

export function MediaGridItem({
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
}: MediaGridItemProps) {
  const Icon = mediaType === 'anime' ? Play : BookOpen
  const [imgError, setImgError] = useState(false)

  useEffect(() => {
    setImgError(false)
  }, [coverUrl])

  return (
    <Card
      onClick={onClick}
      className={cn(
        'group relative cursor-pointer overflow-hidden rounded-xl border border-border bg-card hover:border-primary/50 hover:shadow-md transition-colors duration-150',
        className
      )}
    >
      <div className="aspect-[3/4] relative overflow-hidden bg-secondary/40">
        {coverUrl && !imgError ? (
          <img
            src={coverUrl}
            alt={title}
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300 ease-out"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-3 bg-secondary/30 select-none text-center">
            <div className="w-10 h-10 rounded-xl bg-secondary border border-border flex items-center justify-center mb-2">
              <Icon className="h-5 w-5 text-muted-foreground" />
            </div>
            <span
              className="text-xs font-medium line-clamp-2 text-muted-foreground leading-snug px-1"
              dir="auto"
            >
              {title}
            </span>
          </div>
        )}

        {/* Top-left Extension Source Pill */}
        {sourceName && (
          <div className="pointer-events-none absolute top-2 left-2 right-2 z-20 flex items-center">
            <span className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-black/75 px-1.5 py-0.5 text-[10px] font-medium text-white/95 border border-white/10">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: sourceColor || 'hsl(var(--primary))' }}
              />
              <span className="truncate">{sourceName}</span>
            </span>
          </div>
        )}

        {/* Subtle description reveal on hover */}
        {description && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/65 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-3 pt-8">
            <p className="text-[11px] text-white/90 line-clamp-3 leading-snug" dir="auto">
              {description}
            </p>
          </div>
        )}
      </div>

      <CardContent className="p-3 bg-card border-t border-border/50 relative z-10">
        <h3
          className="font-semibold text-[13px] line-clamp-1 group-hover:text-primary transition-colors leading-snug"
          dir="auto"
        >
          {title}
        </h3>
        <div className="flex items-center justify-between mt-1 min-h-[1.1rem]">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium overflow-hidden truncate">
            {badge ||
              (status && (
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />
                  <span className="truncate">{status}</span>
                </div>
              ))}
          </div>
          {footerBadge && <div className="shrink-0">{footerBadge}</div>}
        </div>
      </CardContent>
    </Card>
  )
}
