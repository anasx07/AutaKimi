import { cn } from '@renderer/shared/lib/utils'
import { LayoutGrid, List } from 'lucide-react'
import { useUIStore } from '@renderer/shared/model'
import { motion } from 'framer-motion'

interface LayoutSwitcherProps {
  className?: string
}

export function LayoutSwitcher({ className }: LayoutSwitcherProps) {
  const { viewMode, setViewMode } = useUIStore()

  return (
    <div
      className={cn(
        'relative flex items-center bg-secondary/60 p-1 rounded-lg w-fit border border-border',
        className
      )}
    >
      <button
        type="button"
        onClick={() => setViewMode('grid')}
        className={cn(
          'relative z-10 flex items-center justify-center h-8 w-8 rounded-md transition-colors duration-150 select-none focus:outline-none',
          viewMode === 'grid' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
        )}
        title="Grid View"
      >
        {viewMode === 'grid' && (
          <motion.div
            layoutId="activeLayoutPill"
            className="absolute inset-0 bg-card rounded-md shadow-sm border border-border -z-10"
            transition={{ type: 'spring', stiffness: 500, damping: 38 }}
          />
        )}
        <LayoutGrid className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => setViewMode('list')}
        className={cn(
          'relative z-10 flex items-center justify-center h-8 w-8 rounded-md transition-colors duration-150 select-none focus:outline-none',
          viewMode === 'list' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
        )}
        title="List View"
      >
        {viewMode === 'list' && (
          <motion.div
            layoutId="activeLayoutPill"
            className="absolute inset-0 bg-card rounded-md shadow-sm border border-border -z-10"
            transition={{ type: 'spring', stiffness: 500, damping: 38 }}
          />
        )}
        <List className="w-4 h-4" />
      </button>
    </div>
  )
}
