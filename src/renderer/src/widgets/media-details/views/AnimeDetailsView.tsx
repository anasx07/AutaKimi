import { ArrowLeft, Share2, MoreVertical, ShieldAlert } from 'lucide-react'
import { 
  useUIStore, 
  useLibraryStore, 
  useExtensionStore, 
  useProgressStore
} from '@renderer/shared/model'
import { DataService } from '@renderer/shared/api'
import { Button, HeroSkeleton } from '@renderer/shared/ui'
import { normalizeManga } from '@common/utils/mangaNormalizer'
import { isFullySupported } from '@renderer/shared/api/sources'
import { Chapter as Episode } from '@renderer/shared/api/sources/types'

// Sub-components
import { HeroSection } from '../components/HeroSection'
import { ActionBar } from '../components/ActionBar'
import { SynopsisCard } from '../components/SynopsisCard'
import { ContinueBanner } from '../components/ContinueBanner'
import { ChapterEpisodeList } from '../components/ChapterEpisodeList'

interface AnimeDetailsViewProps {
  mergedMedia: any
  items: Episode[]
  isLoading: boolean
  error: string | null
  isInLibrary: boolean
  toggleLibrary: () => void
  isToggling: boolean
  refetch: () => void
}

export function AnimeDetailsView({
  mergedMedia,
  items,
  isLoading,
  error,
  isInLibrary,
  toggleLibrary,
  isToggling,
  refetch
}: AnimeDetailsViewProps) {
  const { setActiveTab } = useUIStore()
  const { setSelectedManga, setActiveChapter } = useLibraryStore()
  const { activeExtension, installedExtensions } = useExtensionStore()
  const { readingProgress, pageProgress } = useProgressStore()
  const { addToast } = useUIStore()

  const readIds = mergedMedia ? (readingProgress[mergedMedia.id] || []) : []
  const extension = installedExtensions.find(e => e.pkg === (mergedMedia?.pkg || activeExtension))
  const pkgParts = (mergedMedia?.pkg || activeExtension)?.split('.') || []
  const extLang = extension?.lang || (pkgParts.length >= 4 ? pkgParts[3] : 'all')
  const normalized = normalizeManga(mergedMedia, extLang)

  const nextToWatch = (() => {
    if (items.length === 0) return null
    const progMap = mergedMedia ? pageProgress[mergedMedia.id] : null
    if (progMap) {
      const itemWithProgress = Object.entries(progMap)
        .filter(([id, page]) => (page as number) > 1 && !readIds.includes(id))
        .sort((a, b) => (b[1] as number) - (a[1] as number))[0]
      if (itemWithProgress) {
        const found = items.find(c => c.id === itemWithProgress[0])
        if (found) return found
      }
    }
    const ascItems = [...items].sort((a, b) => parseFloat(String(a.number || '0')) - parseFloat(String(b.number || '0')))
    return ascItems.find(c => !readIds.includes(c.id)) || ascItems[0] || null
  })()

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-y-auto anime-details-page">
      <div className="sticky top-0 z-50 flex items-center justify-between p-4 bg-background/60 backdrop-blur-md border-b border-border/50">
        <Button variant="ghost" size="icon" onClick={() => setSelectedManga(null)} className="h-8 w-8">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-amber-500 hover:text-amber-600 hover:bg-amber-500/10"
            onClick={() => normalized.url && DataService.openInternalBrowser(normalized.url)}
          >
            <ShieldAlert className="h-4.5 w-4.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => normalized.url && DataService.openExternal(normalized.url)}>
            <Share2 className="h-4.5 w-4.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreVertical className="h-4.5 w-4.5" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <HeroSkeleton />
      ) : (
        <HeroSection 
          manga={normalized} 
          mediaType="anime"
          extension={extension}
          isFullySupported={activeExtension ? isFullySupported(activeExtension) : false}
          extLang={extLang}
          onBrowseSource={() => {
            setActiveTab('browse')
            setSelectedManga(null)
          }}
        />
      )}

      <ActionBar 
        isInLibrary={isInLibrary}
        isPending={isToggling}
        onToggleLibrary={toggleLibrary}
        mediaUrl={normalized.url}
      />

      <div className="p-6 max-w-7xl mx-auto w-full flex-1 space-y-6">
        <SynopsisCard 
          description={normalized.description}
          genres={normalized.genres}
          isAnime={true}
        />

        <ContinueBanner 
          nextToRead={nextToWatch}
          mediaId={mergedMedia.id}
          pageProgress={pageProgress}
          readChapterIds={readIds}
          mediaType="anime"
          onContinue={setActiveChapter}
        />

        <ChapterEpisodeList 
          items={items}
          readChapterIds={readIds}
          pageProgress={pageProgress[mergedMedia.id] || {}}
          downloadStatuses={{}}
          mediaType="anime"
          isLoading={isLoading}
          error={error}
          extLang={extLang}
          onItemClick={(episode) => {
            setActiveChapter(episode)
            addToast({ type: 'info', message: `Opening Episode ${episode.number}` })
          }}
          onDownload={() => {}}
          onRemoveDownload={() => {}}
          onRefresh={refetch}
        />
      </div>
    </div>
  )
}
