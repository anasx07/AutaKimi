import { ReactNode } from 'react'
import { cn } from '@renderer/shared/lib/utils'

interface SettingsRowProps {
  title: string | ReactNode
  description?: string | ReactNode
  children?: ReactNode // Control slot (Switch, Select, etc.)
  className?: string
  onClick?: () => void
}

export const SettingsRow = ({ title, description, children, className, onClick }: SettingsRowProps) => {
  return (
    <div 
      onClick={onClick}
      className={cn(
        "p-5 flex items-center justify-between group hover:bg-secondary/20 transition-colors",
        onClick && "cursor-pointer active:bg-secondary/40",
        className
      )}
    >
      <div className="space-y-1">
        <div className="text-sm font-bold flex items-center gap-2">{title}</div>
        {description && <div className="text-xs text-muted-foreground">{description}</div>}
      </div>
      {children && <div className="shrink-0">{children}</div>}
    </div>
  )
}
