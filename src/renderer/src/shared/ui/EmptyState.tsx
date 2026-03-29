import { ReactNode } from 'react'
import { cn } from '@renderer/shared/lib/utils'

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center p-8 text-center space-y-5 animate-in fade-in zoom-in-95 duration-500", className)}>
      <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center ring-2 ring-primary/20 shadow-inner">
        {/* We expect the icon to have its own sizing, e.g. h-8 w-8 text-primary */}
        {icon}
      </div>
      <div className="space-y-2 max-w-sm">
        <h3 className="text-xl font-semibold text-foreground tracking-tight">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        )}
      </div>
      {action && (
        <div className="pt-2">
          {action}
        </div>
      )}
    </div>
  )
}
