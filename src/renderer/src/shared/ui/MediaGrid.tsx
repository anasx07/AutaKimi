import { ReactNode } from 'react'
import { Card, CardContent, Badge } from './'
import { cn } from '@renderer/shared/lib/utils'
import { BookOpen, Play } from 'lucide-react'

interface MediaGridProps {
  children: ReactNode
  className?: string
}

export function MediaGrid({ children, className }: MediaGridProps) {
  return (
    <div className={cn(
      "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 items-start content-start",
      className
    )}>
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
        "group relative cursor-pointer overflow-hidden border-border/40 hover:border-primary/40 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 bg-card/40 backdrop-blur-sm",
        "animate-in fade-in slide-in-from-bottom-4",
        className
      )}
      style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
    >
      <div className="aspect-[3/4] relative overflow-hidden bg-secondary/20">
        {coverUrl ? (
          <img 
            src={coverUrl} 
            alt={title} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Icon className="h-10 w-10 text-muted-foreground/30" />
          </div>
        )}
        
        {/* Hover Description overlay (Browse pattern) */}
        {description && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
            <p className="text-[11px] text-white/80 line-clamp-4 leading-relaxed transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
              {description}
            </p>
          </div>
        )}

        {!description && (
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        )}
      </div>

      <CardContent className="p-3 bg-card/50">
        <h3 className="font-semibold text-sm line-clamp-1 group-hover:text-primary transition-colors">{title}</h3>
        <div className="flex items-center justify-between mt-1 min-h-[1.5rem]">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider font-semibold opacity-70 group-hover:opacity-100 transition-opacity overflow-hidden truncate">
             {badge || (status && (
                <Badge variant="secondary" className="px-1.5 py-0 text-[10px] uppercase font-bold tracking-wider opacity-80">
                  {status}
                </Badge>
             ))}
          </div>
          {footerBadge}
        </div>
      </CardContent>
    </Card>
  )
}
