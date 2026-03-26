import { Heart, RefreshCw, Globe } from 'lucide-react'
import { Button } from '@renderer/shared/ui'
import { cn } from '@renderer/shared/lib/utils'
import { DataService } from '@renderer/shared/api'

interface ActionBarProps {
  isInLibrary: boolean
  isPending: boolean
  onToggleLibrary: () => void
  mediaUrl?: string
}

export const ActionBar = ({ 
  isInLibrary, 
  isPending, 
  onToggleLibrary, 
  mediaUrl 
}: ActionBarProps) => {
  return (
    <div className="grid grid-cols-3 gap-3 py-4 px-6 max-w-7xl mx-auto w-full border-b border-border/10">
      <Button
        variant="outline"
        onClick={onToggleLibrary}
        disabled={isPending}
        className={cn(
          "h-14 flex flex-col items-center justify-center gap-1 bg-secondary/10 backdrop-blur-sm border-border/30 hover:bg-secondary/20 rounded-xl transition-all font-semibold",
          isInLibrary ? "border-primary/40 bg-primary/5 text-primary hover:bg-primary/10" : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Heart className={cn("h-5 w-5", isInLibrary && "fill-current")} />
        <span className="text-[11px]">{isInLibrary ? 'In Library' : 'Add to Library'}</span>
      </Button>

      <Button
        variant="outline"
        disabled
        className="h-14 flex-col items-center justify-center gap-1 bg-secondary/10 backdrop-blur-sm border-border/30 rounded-xl opacity-50 cursor-not-allowed font-semibold text-muted-foreground hidden sm:flex"
      >
        <RefreshCw className="h-5 w-5" />
        <span className="text-[11px]">Tracking</span>
      </Button>

      <Button
        variant="outline"
        onClick={() => mediaUrl && DataService.openExternal(mediaUrl)}
        className="h-14 flex flex-col items-center justify-center gap-1 bg-secondary/10 backdrop-blur-sm border-border/30 hover:bg-secondary/20 rounded-xl transition-all font-semibold text-muted-foreground hover:text-foreground"
      >
        <Globe className="h-5 w-5" />
        <span className="text-[11px]">Web View</span>
      </Button>
    </div>
  )
}
