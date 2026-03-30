import { cn } from '@renderer/shared/lib/utils'
import { LayoutGrid, List } from 'lucide-react'
import { useUIStore } from '@renderer/shared/model'

interface LayoutSwitcherProps {
  className?: string
}

export function LayoutSwitcher({ className }: LayoutSwitcherProps) {
  const { viewMode, setViewMode } = useUIStore()

  return (
    <div
      className={cn(
        'relative flex items-center bg-secondary/40 p-1 rounded-lg w-fit border border-border/40',
        className
      )}
    >
      <div
        className={cn(
          'absolute top-1 bottom-1 w-8 bg-card rounded-md shadow-sm border border-border/50 transition-transform duration-300 ease-in-out pointer-events-none',
          viewMode === 'list' ? 'translate-x-8' : 'translate-x-0'
        )}
      />
      <button
        onClick={() => setViewMode('grid')}
        className={cn(
          'relative z-10 flex items-center justify-center h-8 w-8 rounded-md transition-colors duration-300 select-none focus:outline-none',
          viewMode === 'grid' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
        )}
        title="Grid View"
      >
        <LayoutGrid className="w-4 h-4" />
      </button>
      <button
        onClick={() => setViewMode('list')}
        className={cn(
          'relative z-10 flex items-center justify-center h-8 w-8 rounded-md transition-colors duration-300 select-none focus:outline-none',
          viewMode === 'list' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
        )}
        title="List View"
      >
        <List className="w-4 h-4" />
      </button>
    </div>
  )
}
