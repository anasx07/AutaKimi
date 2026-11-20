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
        'relative flex items-center bg-secondary/50 p-1 rounded-xl w-fit border border-border/40',
        className
      )}
    >
      <button
        type="button"
        onClick={() => onTabChange('manga')}
        className={cn(
          'relative z-10 flex items-center justify-center gap-2 h-9 px-5 rounded-lg text-xs font-bold transition-colors duration-200 select-none focus:outline-none',
          activeTab === 'manga' ? 'text-primary font-black' : 'text-muted-foreground hover:text-foreground'
        )}
      >
        {activeTab === 'manga' && (
          <motion.div
            layoutId="activeMediaTabPill"
            className="absolute inset-0 bg-card rounded-lg shadow-sm border border-border/50 -z-10"
            transition={{ type: 'spring', stiffness: 450, damping: 35 }}
          />
        )}
        <BookOpen className="w-3.5 h-3.5" />
        <span>Manga</span>
      </button>
      <button
        type="button"
        onClick={() => onTabChange('anime')}
        className={cn(
          'relative z-10 flex items-center justify-center gap-2 h-9 px-5 rounded-lg text-xs font-bold transition-colors duration-200 select-none focus:outline-none',
          activeTab === 'anime' ? 'text-primary font-black' : 'text-muted-foreground hover:text-foreground'
        )}
      >
        {activeTab === 'anime' && (
          <motion.div
            layoutId="activeMediaTabPill"
            className="absolute inset-0 bg-card rounded-lg shadow-sm border border-border/50 -z-10"
            transition={{ type: 'spring', stiffness: 450, damping: 35 }}
          />
        )}
        <Play className="w-3.5 h-3.5" />
        <span>Anime</span>
      </button>
    </div>
  )
}
