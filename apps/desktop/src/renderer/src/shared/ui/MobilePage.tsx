import React, { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { isMobile } from '@renderer/shared/platform'
import { Button } from './Button'
import { cn } from '@renderer/shared/lib/utils'

interface MobilePageProps {
  title?: string
  subtitle?: string
  onBack?: () => void
  actions?: ReactNode
  headerExtra?: ReactNode
  children: ReactNode
  className?: string
  scrollable?: boolean
}

export function MobilePage({
  title,
  subtitle,
  onBack,
  actions,
  headerExtra,
  children,
  className,
  scrollable = true
}: MobilePageProps): React.JSX.Element {
  const mobile = isMobile()
  const [isScrolled, setIsScrolled] = React.useState(false)
  const [scrollProgress, setScrollProgress] = React.useState(0)

  const handleScroll = (e: React.UIEvent<HTMLElement>) => {
    const scrollTop = e.currentTarget.scrollTop
    setIsScrolled(scrollTop > 20)
    setScrollProgress(Math.min(scrollTop / 60, 1))
  }

  if (!mobile) {
    return (
      <div className={cn('flex flex-col h-full w-full', className)}>
        {(title || actions || headerExtra) && (
          <div className="w-full max-w-7xl mx-auto px-6 pt-5 pb-3 shrink-0">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                {onBack && (
                  <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8 shrink-0">
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                )}
                <div className="flex flex-col min-w-0">
                  {title && (
                    <h1 className="text-2xl font-bold tracking-tight text-foreground truncate select-none">
                      {title}
                    </h1>
                  )}
                  {subtitle && (
                    <p className="text-muted-foreground text-xs mt-0.5 truncate">
                      {subtitle}
                    </p>
                  )}
                </div>
              </div>
              {actions && <div className="flex items-center gap-2">{actions}</div>}
            </div>
            {headerExtra && <div className="mt-3.5">{headerExtra}</div>}
          </div>
        )}
        <div
          className={cn(
            'flex-1 min-h-0 flex flex-col w-full',
            scrollable ? 'overflow-y-auto custom-scrollbar' : 'overflow-hidden'
          )}
        >
          <div className="w-full max-w-7xl mx-auto px-6 pb-6 flex-1 min-h-0 flex flex-col">
            {children}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col h-full w-full overflow-hidden bg-background', className)}>
      {/* Sticky Header (Mobile) */}
      {(title || actions || headerExtra) && (
        <header
          className={cn(
            'shrink-0 pt-safe transition-colors duration-200 sticky top-0 z-40 border-b',
            isScrolled ? 'bg-background/95 backdrop-blur-md border-border' : 'bg-transparent border-transparent'
          )}
        >
          {(title || actions) && (
            <div className="px-4 h-13 flex items-center justify-between gap-4 relative">
              <div className="flex items-center gap-3 min-w-0 flex-1 z-10">
                {onBack && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onBack}
                    className={cn(
                      'h-9 w-9 shrink-0 rounded-lg transition-colors',
                      isScrolled ? 'bg-secondary/60' : 'bg-card border border-border'
                    )}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                )}

                {/* Compact Title (Visible on scroll) */}
                <div
                  className="flex flex-col min-w-0 transition-opacity duration-200"
                  style={{ opacity: scrollProgress }}
                >
                  {title && <h1 className="text-sm font-semibold tracking-tight truncate">{title}</h1>}
                  {subtitle && (
                    <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>
                  )}
                </div>
              </div>

              {!onBack && (
                <div
                  className="absolute left-1/2 -translate-x-1/2 transition-opacity duration-200 pointer-events-none"
                  style={{ opacity: 1 - scrollProgress }}
                >
                  <h1 className="text-xs font-medium text-muted-foreground">{title}</h1>
                </div>
              )}

              {actions && <div className="flex items-center gap-2 shrink-0 z-10">{actions}</div>}
            </div>
          )}
          {headerExtra && (
            <div
              className="px-4 pb-3 transition-opacity duration-200"
              style={{ opacity: 1 - scrollProgress * 0.5 }}
            >
              {headerExtra}
            </div>
          )}
        </header>
      )}

      {/* Main Content Area */}
      <main
        onScroll={handleScroll}
        className={cn(
          'flex-1 min-h-0 flex flex-col',
          scrollable ? 'overflow-y-auto' : 'overflow-hidden',
          !title && !headerExtra && 'pt-safe'
        )}
      >
        <div className="px-4 pb-4 flex flex-col flex-1">
          {/* Header Title (Top of content) */}
          {title && !isScrolled && (
            <div className="pt-2 pb-4">
              <h1 className="text-2xl font-bold tracking-tight text-foreground leading-tight">
                {title}
              </h1>
              {subtitle && (
                <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
              )}
            </div>
          )}
          
          <div className={cn('flex flex-col flex-1', !title && 'pt-2')}>
             {children}
          </div>
          
          <div className="h-24 shrink-0" />
        </div>
      </main>
    </div>
  )
}
