import * as React from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@renderer/shared/lib/utils'

interface SheetProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  className?: string
}

export function Sheet({
  isOpen,
  onClose,
  title,
  children,
  className
}: SheetProps): React.JSX.Element | null {
  // Handle escape key to close
  React.useEffect((): (() => void) => {
    const handleEscape = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex justify-end overflow-hidden animate-in fade-in duration-500">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Sheet Content */}
      <div
        className={cn(
          'relative w-full max-w-md bg-card/95 backdrop-blur-2xl border-l border-border/50 shadow-2xl h-full flex flex-col animate-in slide-in-from-right duration-700 ease-in-out',
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border/50 shrink-0">
          <div>
            {title && <h2 className="text-xl font-bold tracking-tight text-foreground">{title}</h2>}
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all duration-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">{children}</div>
      </div>
    </div>,
    document.body
  )
}
