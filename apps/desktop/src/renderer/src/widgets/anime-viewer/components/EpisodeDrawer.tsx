import { memo, useRef, useEffect } from 'react'
import { History, ChevronRight, Play } from 'lucide-react'
import { Button } from '@renderer/shared/ui'
import { cn } from '@renderer/shared/lib/utils'

export interface EpisodeDrawerProps {
  isOpen: boolean
  onClose: () => void
  episodes: any[]
  activeChapterId?: string
  onSelectEpisode: (ep: any) => void
}

export const EpisodeDrawer = memo(function EpisodeDrawer({
  isOpen,
  onClose,
  episodes,
  activeChapterId,
  onSelectEpisode
}: EpisodeDrawerProps) {
  const activeEpisodeRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (isOpen && activeEpisodeRef.current) {
      activeEpisodeRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }, [isOpen])

  return (
    <div
      className={cn(
        'absolute right-0 top-0 bottom-0 w-80 bg-neutral-900/95 backdrop-blur-2xl border-l border-white/10 z-50 transition-transform duration-500 ease-in-out flex flex-col pt-8',
        !isOpen && 'translate-x-full'
      )}
    >
      <div className="h-16 flex items-center justify-between px-6 border-b border-white/5 mt-2">
        <h2 className="text-sm font-bold flex items-center gap-2 text-white">
          <History className="h-4 w-4 text-primary" />
          Episodes
        </h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8 rounded-full text-white/70 hover:text-white hover:bg-white/10"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
        {episodes.map((ep) => {
          const isActive = ep.id === activeChapterId
          return (
            <button
              key={ep.id}
              ref={isActive ? activeEpisodeRef : null}
              onClick={() => {
                onSelectEpisode(ep)
                onClose()
              }}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group',
                isActive
                  ? 'bg-primary text-white shadow-lg shadow-primary/20 font-bold'
                  : 'hover:bg-white/5 text-neutral-400 hover:text-white'
              )}
            >
              <div
                className={cn(
                  'h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold transition-colors',
                  isActive ? 'bg-white/20' : 'bg-neutral-800 group-hover:bg-neutral-700'
                )}
              >
                {ep.number}
              </div>
              <div className="flex flex-col items-start min-w-0">
                <span className="text-[11px] truncate w-full">Episode {ep.number}</span>
                {ep.title && (
                  <span className="text-[9px] opacity-60 truncate w-full">{ep.title}</span>
                )}
              </div>
              {isActive && <Play className="h-3 w-3 ml-auto fill-current animate-pulse" />}
            </button>
          )
        })}
      </div>
    </div>
  )
})
