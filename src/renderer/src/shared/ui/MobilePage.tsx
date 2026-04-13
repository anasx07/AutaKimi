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
                    <h1 className="text-4xl font-black tracking-tighter bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent italic">
                      {title}
                    </h1>
                  )}
                  {subtitle && (
                    <p className="text-muted-foreground text-[10px] font-black uppercase tracking-[0.2em] opacity-40">
                      {subtitle}
                    </p>
                  )}
                </div>
              </div>
              {actions && <div className="flex items-center gap-3">{actions}</div>}
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
      {/* Dynamic Kinetic Header (Mobile) */}
      {(title || actions || headerExtra) && (
        <header 
          className={cn(
            'shrink-0 pt-safe transition-all duration-500 sticky top-0 z-40 border-b',
            isScrolled ? 'glass-panel border-border/50' : 'bg-transparent border-transparent'
          )}
        >
          {(title || actions) && (
            <div className="px-4 h-14 flex items-center justify-between gap-4 relative">
              <div className="flex items-center gap-3 min-w-0 flex-1 z-10">
                {onBack && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={onBack} 
                    className={cn(
                      "h-9 w-9 shrink-0 rounded-full transition-all",
                      isScrolled ? "bg-secondary/40" : "bg-card/40 backdrop-blur-md"
                    )}
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                )}
                
                {/* Compact Title (Visible on scroll) */}
                <div 
                  className="flex flex-col min-w-0 transition-opacity duration-300"
                  style={{ opacity: scrollProgress }}
                >
                  {title && <h1 className="text-sm font-black tracking-widest uppercase truncate">{title}</h1>}
                  {subtitle && (
                    <p className="text-[9px] text-muted-foreground font-black uppercase tracking-widest opacity-60 truncate">
                      {subtitle}
                    </p>
                  )}
                </div>
              </div>
              
              {/* Centered Large Title (Visible at top) */}
              {!onBack && (
                 <div 
                   className="absolute left-1/2 -translate-x-1/2 transition-all duration-300 pointer-events-none"
                   style={{ 
                     opacity: 1 - scrollProgress,
                     transform: `scale(${1 - scrollProgress * 0.2}) translateY(${scrollProgress * 20}px)`
                   }}
                 >
                   <h1 className="text-sm font-black tracking-[0.3em] uppercase opacity-20">{title}</h1>
                 </div>
              )}

              {actions && <div className="flex items-center gap-2 shrink-0 z-10">{actions}</div>}
            </div>
          )}
          {headerExtra && (
            <div 
              className="px-4 pb-3 transition-all duration-300"
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
        <div className="px-5 pb-4 flex flex-col flex-1">
          {/* Large Header Title (Top of content) */}
          {title && !isScrolled && (
            <div className="pt-2 pb-6 animate-in fade-in slide-in-from-left-4 duration-700">
               <h1 className="text-4xl font-black tracking-tighter bg-gradient-to-br from-foreground to-foreground/40 bg-clip-text text-transparent italic leading-[0.9]">
                 {title}
               </h1>
               {subtitle && (
                 <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.3em] mt-2 opacity-50">
                    {subtitle}
                 </p>
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
