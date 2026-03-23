import * as React from "react"
import { X } from "lucide-react"
import { cn } from '@renderer/shared/lib/utils'

interface DialogProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  className?: string
}

export function Dialog({ isOpen, onClose, title, children, className }: DialogProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div 
        className="absolute inset-0 bg-background/80 backdrop-blur-sm" 
        onClick={onClose}
      />
      <div className={cn(
        "relative w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200",
        className
      )}>
        <div className="p-6 space-y-4">
          {title && (
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
              <button onClick={onClose} className="rounded-full p-1 hover:bg-secondary transition-colors">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  )
}
