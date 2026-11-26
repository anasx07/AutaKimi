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
    if (page && page > 1 && !isRead)
      return isAnime ? `Resume at ${Math.floor(page / 60)}m` : `Resume at Page ${page}`
    if (isRead) return 'Re-read'
    return isAnime ? 'Start Watching' : 'Start Reading'
  })()

  const displayNum =
    nextToRead.number !== undefined && nextToRead.number !== null && Number(nextToRead.number) > 0
      ? nextToRead.number
      : (String(nextToRead.title || '').match(/[\d.]+/) || [nextToRead.number ?? 0])[0]

  const cleanTitle = (nextToRead.title || '').trim().toLowerCase()
  const numStr = String(displayNum).toLowerCase()
  const isTitleRedundant =
    !nextToRead.title ||
    cleanTitle === numStr ||
    cleanTitle === `episode ${numStr}` ||
    cleanTitle === `chapter ${numStr}` ||
    cleanTitle === `ep ${numStr}` ||
    cleanTitle === `ch ${numStr}` ||
    cleanTitle === `الحلقة ${numStr}` ||
    cleanTitle === `الفصل ${numStr}`

  return (
    <Button
      className={cn(
        'w-full h-12 text-white shadow-sm flex items-center justify-center gap-3 rounded-xl transition-colors',
        'bg-primary hover:bg-primary/90'
      )}
      onClick={() => onContinue(nextToRead)}
    >
      <Play className="h-4 w-4 fill-current shrink-0" />
      <div className="flex flex-col items-start leading-tight text-left">
        <span className="text-[10px] uppercase tracking-wider font-semibold opacity-80">
          {progText}
        </span>
        <span className="text-sm font-semibold truncate max-w-[280px] sm:max-w-md">
          {itemType} {displayNum}
          {!isTitleRedundant && nextToRead.title ? ` - ${nextToRead.title}` : ''}
        </span>
      </div>
    </Button>
  )
}
