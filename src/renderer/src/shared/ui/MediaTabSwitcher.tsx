import { Button } from './Button'
import { cn } from '@renderer/shared/lib/utils'

interface MediaTabSwitcherProps {
  activeTab: 'manga' | 'anime'
  onTabChange: (tab: 'manga' | 'anime') => void
  className?: string
}

export function MediaTabSwitcher({ activeTab, onTabChange, className }: MediaTabSwitcherProps) {
  return (
    <div className={cn("flex items-center gap-1 bg-secondary/30 p-1 rounded-lg border border-border/40 w-fit", className)}>
      <Button
        variant={activeTab === 'manga' ? 'primary' : 'ghost'}
        size="sm"
        onClick={() => onTabChange('manga')}
        className={cn(
          "h-8 px-4 rounded-md text-xs font-bold transition-all",
          activeTab === 'manga' ? "shadow-md" : "text-muted-foreground"
        )}
      >
        Manga
      </Button>
      <Button
        variant={activeTab === 'anime' ? 'primary' : 'ghost'}
        size="sm"
        onClick={() => onTabChange('anime')}
        className={cn(
          "h-8 px-4 rounded-md text-xs font-bold transition-all",
          activeTab === 'anime' ? "shadow-md" : "text-muted-foreground"
        )}
      >
        Anime
      </Button>
    </div>
  )
}
