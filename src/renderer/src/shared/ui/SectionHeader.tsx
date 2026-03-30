import { ReactNode, ElementType } from 'react'
import { cn } from '@renderer/shared/lib/utils'

interface SectionHeaderProps {
  title: string
  icon: ElementType
  children?: ReactNode // Right slot
  className?: string
  variant?: 'primary' | 'destructive' | 'yellow'
}

export const SectionHeader = ({
  title,
  icon: Icon,
  children,
  className,
  variant = 'primary'
}: SectionHeaderProps) => {
  const variantClasses = {
    primary: 'text-primary',
    destructive: 'text-destructive',
    yellow: 'text-yellow-500'
  }

  return (
    <div className={cn('flex items-center justify-between px-1', className)}>
      <div
        className={cn(
          'flex items-center gap-3 font-black text-xl uppercase tracking-tighter italic',
          variantClasses[variant]
        )}
      >
        <Icon className="h-6 w-6" />
        {title}
      </div>
      {children}
    </div>
  )
}
