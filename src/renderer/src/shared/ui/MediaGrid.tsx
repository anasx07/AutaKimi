import { ReactNode } from 'react'
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
        'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 items-start content-start',
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
  className,
  index = 0
}: MediaGridItemProps) {
  const Icon = mediaType === 'anime' ? Play : BookOpen

  return (
    <Card
      onClick={onClick}
      className={cn(
        'group relative cursor-pointer overflow-hidden glass-card aura-shimmer hover:-translate-y-2 hover:aura-glow-hover transition-all duration-500 rounded-2xl',
        'animate-in fade-in slide-in-from-bottom-6',
        className
      )}
      style={{ animationDelay: `${Math.min(index * 40, 400)}ms` }}
    >
      <div className="aspect-[3/4] relative overflow-hidden bg-secondary/10">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Icon className="h-10 w-10 text-muted-foreground/20" />
          </div>
        )}

        {/* Premium Edge Lighting (Inset Shadow) */}
        <div className="absolute inset-0 shadow-[inset_0_0_40px_rgba(0,0,0,0.2)] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

        {/* Elegant metadata reveal (Glass Frost) */}
        {description && (
          <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col justify-end p-4 border-t border-white/10 translate-y-4 group-hover:translate-y-0">
            <p className="text-[10px] text-white/90 line-clamp-4 leading-relaxed font-medium drop-shadow-md">
              {description}
            </p>
          </div>
        )}

        {/* Fallback glow for sites without description */}
        {!description && (
          <div className="absolute inset-0 bg-gradient-to-t from-primary/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        )}
      </div>

      <CardContent className="p-3.5 bg-card/40 backdrop-blur-md relative z-10">
        <h3 className="font-bold text-[13px] line-clamp-1 group-hover:text-primary transition-colors leading-snug">
          {title}
        </h3>
        <div className="flex items-center justify-between mt-1.5 min-h-[1.2rem]">
          <div className="flex items-center gap-2 text-[9px] text-muted-foreground uppercase tracking-[0.1em] font-black opacity-60 group-hover:opacity-100 transition-all overflow-hidden truncate">
            {badge ||
              (status && (
                <div className="flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-primary/40" />
                  <span className="truncate">{status}</span>
                </div>
              ))}
          </div>
          <div className="transform scale-90 origin-right transition-transform group-hover:scale-100">
             {footerBadge}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
