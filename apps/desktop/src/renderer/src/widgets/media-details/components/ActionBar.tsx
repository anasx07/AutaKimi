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
      <div className="grid grid-cols-3 gap-3 py-4 px-6 max-w-7xl mx-auto w-full border-b border-border/10">
        <Button
          variant="outline"
          onClick={onToggleLibrary}
          disabled={isPending}
          className={cn(
            'h-14 flex flex-col items-center justify-center gap-1 bg-secondary/10 backdrop-blur-sm border-border/30 hover:bg-secondary/20 rounded-xl transition-all font-semibold',
            isInLibrary
              ? 'border-primary/40 bg-primary/5 text-primary hover:bg-primary/10'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Heart className={cn('h-5 w-5', isInLibrary && 'fill-current')} />
          <span className="text-[11px]">{isInLibrary ? 'In Library' : 'Add to Library'}</span>
        </Button>

        <Button
          variant="outline"
          onClick={() => setIsTrackingOpen(true)}
          className={cn(
            'h-14 flex-col items-center justify-center gap-1 bg-secondary/10 backdrop-blur-sm border-border/30 hover:bg-secondary/20 rounded-xl transition-all font-semibold hidden sm:flex',
            hasTracker
              ? 'border-[#02A9FF]/50 bg-[#02A9FF]/10 text-[#02A9FF] hover:bg-[#02A9FF]/15'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <div className="relative">
            <RefreshCw className={cn('h-5 w-5', hasTracker && 'text-[#02A9FF]')} />
            {hasTracker && (
              <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-[#02A9FF] animate-pulse" />
            )}
          </div>
          <span className="text-[11px]">{hasTracker ? 'Tracking Active' : 'Tracking'}</span>
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
