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
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 text-center space-y-4',
        className
      )}
    >
      <div className="w-14 h-14 rounded-2xl bg-secondary border border-border flex items-center justify-center">
        {/* We expect the icon to have its own sizing, e.g. h-7 w-7 text-primary */}
        {icon}
      </div>
      <div className="space-y-1.5 max-w-sm">
        <h3 className="text-lg font-semibold text-foreground tracking-tight">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        )}
      </div>
      {action && <div className="pt-1">{action}</div>}
    </div>
  )
}
