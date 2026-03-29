import { Play } from 'lucide-react'
import { Button } from '@renderer/shared/ui'
import { cn } from '@renderer/shared/lib/utils'
import { Chapter } from '@renderer/shared/api/sources/types'

interface ContinueBannerProps {
  nextToRead: Chapter | null
  mediaId: string
  pageProgress: Record<string, Record<string, number>>
  readChapterIds: string[]
  mediaType: 'manga' | 'anime'
  onContinue: (item: Chapter) => void
}

export const ContinueBanner = ({ 
  nextToRead, 
  mediaId, 
  pageProgress, 
  readChapterIds, 
  mediaType,
  onContinue 
}: ContinueBannerProps) => {
  if (!nextToRead) return null

  const isAnime = mediaType === 'anime'
  const itemType = isAnime ? 'Episode' : 'Chapter'
  
  const progText = (() => {
    const page = pageProgress[mediaId]?.[nextToRead.id]
    const isRead = readChapterIds.includes(nextToRead.id)
    if (page && page > 1 && !isRead) return isAnime ? `Resume at ${Math.floor(page / 60)}m` : `Resume at Page ${page}`
    if (isRead) return 'Re-read'
    return isAnime ? 'Start Watching' : 'Start Reading'
  })()

  return (
    <Button
      className={cn(
        "w-full h-14 text-white shadow-lg flex items-center justify-center gap-3 rounded-xl transition-all active:scale-[0.99] group overflow-hidden relative",
        isAnime ? "bg-primary hover:bg-primary/90 shadow-primary/20" : "bg-primary hover:bg-primary/90 shadow-primary/20"
      )}
      onClick={() => onContinue(nextToRead)}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/5 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
      <Play className="h-5 w-5 fill-current" />
      <div className="flex flex-col items-start leading-tight text-left">
        <span className="text-[10px] uppercase tracking-wider font-bold opacity-70">
          {progText}
        </span>
        <span className="text-sm font-semibold truncate max-w-[280px] sm:max-w-md">
          {itemType} {nextToRead.number} {nextToRead.title ? `- ${nextToRead.title}` : ''}
        </span>
      </div>
    </Button>
  )
}
