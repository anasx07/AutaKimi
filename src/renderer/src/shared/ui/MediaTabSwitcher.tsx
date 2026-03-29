import { cn } from '@renderer/shared/lib/utils'
import { BookOpen, Play } from 'lucide-react'

interface MediaTabSwitcherProps {
  activeTab: 'manga' | 'anime'
  onTabChange: (tab: 'manga' | 'anime') => void
  className?: string
}

export function MediaTabSwitcher({ activeTab, onTabChange, className }: MediaTabSwitcherProps) {
  return (
    <div className={cn("relative flex items-center bg-secondary/60 p-1 rounded-xl w-fit border border-white/5", className)}>
      <div 
        className={cn(
          "absolute top-1 bottom-1 w-[104px] bg-card rounded-lg shadow-sm border border-border/50 transition-transform duration-300 ease-in-out pointer-events-none",
          activeTab === 'anime' ? "translate-x-full" : "translate-x-0"
        )}
      />
      <button
        onClick={() => onTabChange('manga')}
        className={cn(
          "relative z-10 flex items-center justify-center gap-2 h-9 w-[104px] rounded-lg text-xs font-bold transition-colors duration-300 select-none focus:outline-none",
          activeTab === 'manga' ? "text-primary" : "text-muted-foreground hover:text-foreground"
        )}
      >
        <BookOpen className="w-3.5 h-3.5" />
        Manga
      </button>
      <button
        onClick={() => onTabChange('anime')}
        className={cn(
          "relative z-10 flex items-center justify-center gap-2 h-9 w-[104px] rounded-lg text-xs font-bold transition-colors duration-300 select-none focus:outline-none",
          activeTab === 'anime' ? "text-primary" : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Play className="w-3.5 h-3.5" />
        Anime
      </button>
    </div>
  )
}
