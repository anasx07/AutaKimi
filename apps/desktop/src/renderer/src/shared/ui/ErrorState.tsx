import { RotateCcw, Globe, AlertTriangle } from 'lucide-react'
import { cn } from '../lib/utils'

interface ErrorStateProps {
  title?: string
  message?: string
  onRetry?: () => void
  onWebView?: () => void
  onReport?: () => void
  details?: Record<string, any>
  className?: string
}

export function ErrorState({
  title = 'HTTP Error',
  message = "This source doesn't seem to be working right now for various reasons; please check the help for troubleshooting and consider migrating to other sources.",
  onRetry,
  onWebView,
  onReport,
  details,
  className
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-20 px-6 text-center space-y-8 animate-in fade-in zoom-in-95 duration-500',
        className
      )}
    >
      {/* Tachimanga-style Face */}
      <div className="text-6xl font-medium text-muted-foreground/40 select-none tracking-widest">
        (˘･_･˘)
      </div>

      <div className="space-y-4 max-w-sm">
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>
        </div>

        {details && (
          <div className="text-left bg-[#1a1b1e] rounded-xl p-6 border border-white/5 font-mono text-[13px] leading-relaxed shadow-2xl">
            <div className="text-muted-foreground mb-3 font-sans font-semibold flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary/50" />
              Technical Details
            </div>
            <div className="space-y-1 text-blue-400/90 overflow-hidden">
              <p>Details: {'{'}</p>
              {Object.entries(details).map(([key, value]) => (
                <p key={key} className="pl-4 break-all">
                  <span className="text-gray-400">"{key}"</span>:{' '}
                  <span className="text-orange-300">"{String(value)}"</span>,
                </p>
              ))}
              <p>{'}'}</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-8 pt-4">
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex flex-col items-center gap-2 group transition-all"
          >
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
              <RotateCcw className="h-5 w-5" />
            </div>
            <span className="text-xs font-bold text-primary tracking-wide uppercase">Retry</span>
          </button>
        )}

        {onWebView && (
          <button
            onClick={onWebView}
            className="flex flex-col items-center gap-2 group transition-all"
          >
            <div className="w-12 h-12 rounded-full bg-secondary/80 flex items-center justify-center text-foreground group-hover:bg-foreground group-hover:text-background transition-all duration-300">
              <Globe className="h-5 w-5" />
            </div>
            <span className="text-xs font-bold text-muted-foreground group-hover:text-foreground tracking-wide uppercase">
              Web View
            </span>
          </button>
        )}

        {onReport && (
          <button
            onClick={onReport}
            className="flex flex-col items-center gap-2 group transition-all"
          >
            <div className="w-12 h-12 rounded-full bg-secondary/80 flex items-center justify-center text-foreground group-hover:bg-red-500/20 group-hover:text-red-500 transition-all duration-300">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <span className="text-xs font-bold text-muted-foreground group-hover:text-red-500 tracking-wide uppercase">
              Report
            </span>
          </button>
        )}
      </div>
    </div>
  )
}
