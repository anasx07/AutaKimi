import { useState, useEffect } from 'react'
import { Heart, RefreshCw, Globe } from 'lucide-react'
import { Button } from '@renderer/shared/ui'
import { cn } from '@renderer/shared/lib/utils'
import { DataService } from '@renderer/shared/api'
import { useTrackerStore } from '@renderer/shared/model'
import { TrackingModal } from './TrackingModal'

interface ActionBarProps {
  isInLibrary: boolean
  isPending: boolean
  onToggleLibrary: () => void
  mediaUrl?: string
  manga?: { id: string; title: string; [key: string]: any }
  mediaType?: 'manga' | 'anime'
}

export const ActionBar = ({
  isInLibrary,
  isPending,
  onToggleLibrary,
  mediaUrl,
  manga,
  mediaType = 'manga'
}: ActionBarProps) => {
  const [isTrackingOpen, setIsTrackingOpen] = useState(false)
  const { trackers, loadTrackers } = useTrackerStore()

  useEffect(() => {
    if (manga?.id) {
      loadTrackers(manga.id)
    }
  }, [manga?.id, loadTrackers])

  const hasTracker = Boolean(manga?.id && trackers[manga.id]?.length > 0)

  return (
    <>
      <div className="grid grid-cols-3 gap-2.5 py-2.5 px-6 max-w-7xl mx-auto w-full border-b border-border/40">
        <Button
          variant="outline"
          onClick={onToggleLibrary}
          disabled={isPending}
          className={cn(
            'h-9 flex items-center justify-center gap-2 bg-card border-border hover:bg-secondary/50 rounded-lg transition-colors font-medium text-xs',
            isInLibrary
              ? 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/15'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Heart className={cn('h-3.5 w-3.5', isInLibrary && 'fill-current')} />
          <span>{isInLibrary ? 'In Library' : 'Add to Library'}</span>
        </Button>

        <Button
          variant="outline"
          onClick={() => setIsTrackingOpen(true)}
          className={cn(
            'h-9 items-center justify-center gap-2 bg-card border-border hover:bg-secondary/50 rounded-lg transition-colors font-medium text-xs hidden sm:flex',
            hasTracker
              ? 'border-[#02A9FF]/50 bg-[#02A9FF]/10 text-[#02A9FF] hover:bg-[#02A9FF]/15'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <div className="relative flex items-center">
            <RefreshCw className={cn('h-3.5 w-3.5', hasTracker && 'text-[#02A9FF]')} />
            {hasTracker && (
              <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-[#02A9FF]" />
            )}
          </div>
          <span>{hasTracker ? 'Tracking Active' : 'Tracking'}</span>
        </Button>

        <Button
          variant="outline"
          onClick={() => mediaUrl && DataService.openExternal(mediaUrl)}
          className="h-9 flex items-center justify-center gap-2 bg-card border-border hover:bg-secondary/50 rounded-lg transition-colors font-medium text-xs text-muted-foreground hover:text-foreground"
        >
          <Globe className="h-3.5 w-3.5" />
          <span>Web View</span>
        </Button>
      </div>

      {manga && (
        <TrackingModal
          isOpen={isTrackingOpen}
          onClose={() => setIsTrackingOpen(false)}
          manga={manga}
          mediaType={mediaType}
        />
      )}
    </>
  )
}
