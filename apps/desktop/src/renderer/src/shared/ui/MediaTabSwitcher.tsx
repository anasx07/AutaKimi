import { cn } from '@renderer/shared/lib/utils'
import { BookOpen, Play } from 'lucide-react'
import { motion } from 'framer-motion'

interface MediaTabSwitcherProps {
  activeTab: 'manga' | 'anime'
  onTabChange: (tab: 'manga' | 'anime') => void
  className?: string
}

export function MediaTabSwitcher({ activeTab, onTabChange, className }: MediaTabSwitcherProps) {
  return (
    <div
      className={cn(
        'relative flex items-center bg-secondary/60 p-1 rounded-lg w-fit border border-border',
        className
      )}
    >
      <button
        type="button"
        onClick={() => onTabChange('manga')}
        className={cn(
          'relative z-10 flex items-center justify-center gap-2 h-8 px-4 rounded-md text-xs font-medium transition-colors duration-150 select-none focus:outline-none',
          activeTab === 'manga' ? 'text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'
        )}
      >
        {activeTab === 'manga' && (
          <motion.div
            layoutId="activeMediaTabPill"
            className="absolute inset-0 bg-card rounded-md shadow-sm border border-border -z-10"
            transition={{ type: 'spring', stiffness: 500, damping: 38 }}
          />
        )}
        <BookOpen className={cn('w-3.5 h-3.5', activeTab === 'manga' && 'text-primary')} />
        <span>Manga</span>
      </button>
      <button
        type="button"
        onClick={() => onTabChange('anime')}
        className={cn(
          'relative z-10 flex items-center justify-center gap-2 h-8 px-4 rounded-md text-xs font-medium transition-colors duration-150 select-none focus:outline-none',
          activeTab === 'anime' ? 'text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'
        )}
      >
        {activeTab === 'anime' && (
          <motion.div
            layoutId="activeMediaTabPill"
            className="absolute inset-0 bg-card rounded-md shadow-sm border border-border -z-10"
            transition={{ type: 'spring', stiffness: 500, damping: 38 }}
          />
        )}
        <Play className={cn('w-3.5 h-3.5', activeTab === 'anime' && 'text-primary')} />
        <span>Anime</span>
      </button>
    </div>
  )
}
