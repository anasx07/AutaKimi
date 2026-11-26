import { useEffect, useState } from 'react'
import { Play, BookOpen, CheckCircle, ShieldCheck, ShieldAlert, ExternalLink } from 'lucide-react'
import { Badge, Card, Tooltip } from '@renderer/shared/ui'
import { cn } from '@renderer/shared/lib/utils'
import {
  buildAmbientGradientStyle,
  sampleElementAmbientPalette,
  type AmbientColorPalette
} from '@renderer/shared/lib/ambientColors'
import { DataService } from '@renderer/shared/api'
import { NormalizedManga } from '@common/utils/mangaNormalizer'
import { ExtensionMetadata } from '@renderer/shared/model'

interface HeroSectionProps {
  manga: NormalizedManga
  mediaType: 'manga' | 'anime'
  extension?: ExtensionMetadata
  isFullySupported: boolean
  extLang: string
  onBrowseSource: () => void
  layout?: 'banner' | 'sidebar'
}

export const HeroSection = ({
  manga,
  mediaType,
  extension,
  isFullySupported,
  extLang,
  onBrowseSource,
  layout = 'banner'
}: HeroSectionProps) => {
  const iconColor = mediaType === 'manga' ? 'text-green-500' : 'text-primary'
  const Icon = mediaType === 'manga' ? BookOpen : Play
  const StatusIcon = mediaType === 'manga' ? CheckCircle : Play
  const [ambientPalette, setAmbientPalette] = useState<AmbientColorPalette | null>(null)

  useEffect(() => {
    setAmbientPalette(null)
  }, [manga.coverUrl])

  if (layout === 'sidebar') {
    return (
      <div className="relative overflow-hidden rounded-xl border border-border bg-card p-4 shrink-0">
        {manga.coverUrl && (
          <div className="absolute inset-0 z-0 pointer-events-none">
            <img
              src={manga.coverUrl}
              alt=""
              className="w-full h-full object-cover blur-3xl opacity-30 saturate-150 scale-125"
            />
            {ambientPalette && (
              <div
                aria-hidden="true"
                className="absolute inset-0 opacity-40 blur-2xl saturate-150 transition-opacity duration-500"
                style={{ background: buildAmbientGradientStyle(ambientPalette) }}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-card via-card/85 to-card/30" />
          </div>
        )}

        <div className="relative z-10 flex flex-col items-center text-center gap-3">
          <Card
            className={cn(
              'w-44 sm:w-48 aspect-[2/3] flex-shrink-0 shadow-xl overflow-hidden rounded-xl',
              mediaType === 'manga' ? 'border-border' : 'border-primary/25'
            )}
          >
            {manga.coverUrl ? (
              <img
                src={manga.coverUrl}
                alt={manga.title}
                onLoad={(e) => {
                  const { palette } = sampleElementAmbientPalette(e.currentTarget)
                  if (palette) setAmbientPalette(palette)
                }}
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className={cn(
                  'w-full h-full flex items-center justify-center',
                  mediaType === 'manga' ? 'bg-secondary/50' : 'bg-primary/10 text-primary'
                )}
              >
                <Icon className="h-10 w-10 text-muted-foreground/40" />
              </div>
            )}
          </Card>

          <div className="w-full min-w-0 flex flex-col items-center gap-1.5">
            <h1
              className="text-base sm:text-lg font-bold tracking-tight text-foreground line-clamp-2 leading-snug"
              dir="auto"
            >
              {manga.title}
            </h1>

            {manga.author && (
              <p className="text-xs font-medium text-muted-foreground truncate max-w-full" dir="auto">
                {manga.author}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs">
              <div className={cn('flex items-center gap-1 font-semibold', iconColor)}>
                <StatusIcon className="h-3 w-3 fill-current shrink-0" />
                <span dir="auto">{manga.status?.split(' • ')[0] || manga.status}</span>
              </div>
              <span className="text-muted-foreground/40">•</span>
              <Tooltip
                content={`Browse ${extension?.name || manga.pkg?.split('.').pop()}`}
                position="top"
              >
                <button
                  onClick={onBrowseSource}
                  className="text-muted-foreground font-medium hover:text-primary hover:underline underline-offset-2 transition-colors truncate max-w-[180px]"
                >
                  {extension?.name || manga.pkg?.split('.').pop()} ({extLang.toUpperCase()})
                </button>
              </Tooltip>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-1.5 pt-0.5">
              {manga.pkg &&
                (isFullySupported ? (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 h-4.5 bg-emerald-500/10 text-emerald-500 border-emerald-500/20 gap-1 font-semibold"
                  >
                    <ShieldCheck className="h-3 w-3" />
                    SUPPORTED
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 h-4.5 bg-amber-500/10 text-amber-500 border-amber-500/20 gap-1 font-semibold"
                  >
                    <ShieldAlert className="h-3 w-3" />
                    NOT YET SUPPORTED
                  </Badge>
                ))}
            </div>

            {manga.url && (
              <button
                onClick={() => DataService.openExternal(manga.url!)}
                className="text-[11px] text-muted-foreground/70 hover:text-primary transition-colors truncate max-w-full flex items-center justify-center gap-1 mt-0.5 underline underline-offset-2"
                title={manga.url}
              >
                <ExternalLink className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{manga.url}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full overflow-hidden flex-shrink-0 pt-3 px-6 pb-4 border-b border-border/40">
      {manga.coverUrl && (
        <div className="absolute inset-0 z-0 pointer-events-none">
          <img
            src={manga.coverUrl}
            alt=""
            className="w-full h-full object-cover blur-3xl opacity-40 saturate-150 scale-125"
          />
          {ambientPalette && (
            <div
              aria-hidden="true"
              className="absolute inset-0 opacity-55 blur-2xl saturate-150 transition-opacity duration-700"
              style={{ background: buildAmbientGradientStyle(ambientPalette) }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/75 to-transparent"></div>
        </div>
      )}

      <div className="relative z-10 flex gap-5 max-w-7xl mx-auto w-full">
        <Card
          className={cn(
            'w-28 h-40 sm:w-32 sm:h-44 flex-shrink-0 shadow-lg overflow-hidden rounded-lg',
            mediaType === 'manga' ? 'border-border' : 'border-primary/25'
          )}
        >
          {manga.coverUrl ? (
            <img
              src={manga.coverUrl}
              alt={manga.title}
              onLoad={(e) => {
                const { palette } = sampleElementAmbientPalette(e.currentTarget)
                if (palette) setAmbientPalette(palette)
              }}
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              className={cn(
                'w-full h-full flex items-center justify-center',
                mediaType === 'manga' ? 'bg-secondary/50' : 'bg-primary/10 text-primary'
              )}
            >
              <Icon className="h-12 w-12 text-muted-foreground/40" />
            </div>
          )}
        </Card>

        <div className="flex-1 flex flex-col justify-end pb-1 space-y-1.5 min-w-0">
          <h1
            className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground line-clamp-2 leading-snug"
            dir="auto"
          >
            {manga.title}
          </h1>

          <div className="space-y-1">
            {manga.author && (
              <p className="text-sm font-medium text-muted-foreground truncate" dir="auto">
                {manga.author}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm">
              <div className={cn('flex items-center gap-1 font-semibold', iconColor)}>
                <StatusIcon className="h-3.5 w-3.5 fill-current" />
                <span dir="auto">{manga.status?.split(' • ')[0] || manga.status}</span>
                {manga.status?.includes(' • ') && <span className="opacity-40">•</span>}
                <span dir="auto">{manga.status?.split(' • ')[1]}</span>
              </div>
              <span className="text-muted-foreground/40">•</span>
              <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                <Tooltip
                  content={`Browse ${extension?.name || manga.pkg?.split('.').pop()}`}
                  position="top"
                >
                  <button
                    onClick={onBrowseSource}
                    className="hover:text-primary hover:underline underline-offset-2 transition-colors duration-150"
                  >
                    {extension?.name || manga.pkg?.split('.').pop()} ({extLang.toUpperCase()})
                  </button>
                </Tooltip>
                {manga.pkg &&
                  (isFullySupported ? (
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 h-4.5 bg-emerald-500/10 text-emerald-500 border-emerald-500/20 gap-1 font-bold"
                    >
                      <ShieldCheck className="h-3 w-3" />
                      SUPPORTED
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 h-4.5 bg-amber-500/10 text-amber-500 border-amber-500/20 gap-1 font-bold"
                    >
                      <ShieldAlert className="h-3 w-3" />
                      NOT YET SUPPORTED
                    </Badge>
                  ))}
              </span>
            </div>

            {manga.url && (
              <button
                onClick={() => DataService.openExternal(manga.url!)}
                className="text-xs text-muted-foreground/60 hover:text-primary transition-colors truncate max-w-full flex items-center gap-1 mt-1 underline underline-offset-2"
              >
                <ExternalLink className="h-3 w-3 flex-shrink-0" />
                {manga.url}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
