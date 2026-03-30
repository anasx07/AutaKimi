import * as React from 'react'
import { cn } from '@renderer/shared/lib/utils'

export interface TooltipProps {
  content: React.ReactNode
  children: React.ReactNode
  className?: string
  position?: 'top' | 'bottom' | 'left' | 'right'
}

export function Tooltip({ content, children, className, position = 'top' }: TooltipProps) {
  const [isOpen, setIsOpen] = React.useState(false)

  const positions = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2'
  }

  const arrowPositions = {
    top: 'bottom-[-4px] left-1/2 -translate-x-1/2 border-t-popover border-l-transparent border-r-transparent border-b-transparent',
    bottom:
      'top-[-4px] left-1/2 -translate-x-1/2 border-b-popover border-l-transparent border-r-transparent border-t-transparent',
    left: 'right-[-4px] top-1/2 -translate-y-1/2 border-l-popover border-t-transparent border-b-transparent border-r-transparent',
    right:
      'left-[-4px] top-1/2 -translate-y-1/2 border-r-popover border-t-transparent border-b-transparent border-l-transparent'
  }

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      onFocus={() => setIsOpen(true)}
      onBlur={() => setIsOpen(false)}
    >
      {children}
      {isOpen && (
        <div
          className={cn(
            'absolute z-50 px-2 py-1 text-xs font-medium text-popover-foreground bg-popover border border-border rounded shadow-md pointer-events-none whitespace-nowrap animate-in fade-in zoom-in-95 duration-100',
            positions[position],
            className
          )}
        >
          {content}
          <div className={cn('absolute w-0 h-0 border-4', arrowPositions[position])} />
        </div>
      )}
    </div>
  )
}
