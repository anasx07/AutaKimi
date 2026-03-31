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

  if (!mobile) {
    return (
      <div className={cn('flex flex-col h-full w-full max-w-7xl mx-auto p-6', className)}>
        {(title || actions || headerExtra) && (
          <div className="shrink-0 flex flex-col space-y-4 mb-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                {onBack && (
                  <Button variant="ghost" size="icon" onClick={onBack} className="h-9 w-9 shrink-0">
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                )}
                <div className="flex flex-col min-w-0">
                  {title && (
                    <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                      {title}
                    </h1>
                  )}
                  {subtitle && (
                    <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-wider opacity-60">
                      {subtitle}
                    </p>
                  )}
                </div>
              </div>
              {actions && <div className="flex items-center gap-2">{actions}</div>}
            </div>
            {headerExtra}
          </div>
        )}
        <div
          className={cn(
            'flex-1 min-h-0 flex flex-col',
            scrollable ? 'overflow-y-auto pr-2 custom-scrollbar' : 'overflow-hidden'
          )}
        >
          {children}
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col h-full w-full overflow-hidden bg-background', className)}>
      {/* Sticky Mobile Header */}
      {(title || actions || headerExtra) && (
        <header className="shrink-0 pt-safe bg-background/80 backdrop-blur-xl border-b border-border/50 sticky top-0 z-40">
          {(title || actions) && (
            <div className="px-4 h-14 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {onBack && (
                  <Button variant="ghost" size="icon" onClick={onBack} className="h-9 w-9 shrink-0">
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                )}
                <div className="flex flex-col min-w-0">
                  {title && <h1 className="text-xl font-bold tracking-tight truncate">{title}</h1>}
                  {subtitle && (
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider opacity-70 truncate">
                      {subtitle}
                    </p>
                  )}
                </div>
              </div>
              {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
            </div>
          )}
          {headerExtra && <div className="px-4 pb-3 overflow-visible">{headerExtra}</div>}
        </header>
      )}

      {/* Main Content Area */}
      <main
        className={cn(
          'flex-1 min-h-0 flex flex-col',
          scrollable ? 'overflow-y-auto' : 'overflow-hidden',
          !title && !headerExtra && 'pt-safe' // If no header, we still need to respect safe area at the top
        )}
      >
        <div
          className={cn(
            'p-4 flex flex-col flex-1',
            !headerExtra && title && 'pt-2' // Small gap if we have a header but no extra content
          )}
        >
          {children}
          {/* Bottom spacer for nav */}
          <div className="h-24 shrink-0" />
        </div>
      </main>
    </div>
  )
}
