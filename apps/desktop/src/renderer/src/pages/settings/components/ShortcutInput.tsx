import { useState, useEffect } from 'react'
import { Button } from '@renderer/shared/ui'
import { cn } from '@renderer/shared/lib/utils'

interface ShortcutInputProps {
  label: string
  value: string
  onSave: (key: string) => void
}

export function ShortcutInput({ label, value, onSave }: ShortcutInputProps): React.JSX.Element {
  const [isCapturing, setIsCapturing] = useState(false)

  useEffect(() => {
    if (!isCapturing) return
    const handleDown = (e: KeyboardEvent): void => {
      if (e.code === 'Escape') {
        setIsCapturing(false)
        return
      }
      e.preventDefault()
      e.stopPropagation()
      onSave(e.code)
      setIsCapturing(false)
    }
    window.addEventListener('keydown', handleDown)
    return () => window.removeEventListener('keydown', handleDown)
  }, [isCapturing, onSave])

  return (
    <div className="flex items-center justify-between p-3 border rounded-xl bg-secondary/20 border-border/50 hover:border-border transition-colors">
      <div className="flex flex-col">
        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-tight">
          {label}
        </span>
      </div>
      <Button
        variant={isCapturing ? 'secondary' : 'ghost'}
        onClick={() => setIsCapturing(true)}
        className={cn(
          'font-mono text-[10px] uppercase min-w-[100px] border border-border shadow-inner text-foreground',
          isCapturing &&
            'animate-pulse ring-1 ring-primary bg-primary/10 text-primary border-primary/20'
        )}
      >
        {isCapturing ? 'Listening...' : value.replace('Arrow', '')}
      </Button>
    </div>
  )
}
