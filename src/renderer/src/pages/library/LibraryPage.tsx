import { BookOpen, Loader2, Play } from 'lucide-react'
import { normalizeManga } from '@common/utils/mangaNormalizer'
import { MediaTabSwitcher, MediaGrid, MediaGridItem } from '@renderer/shared/ui'
import { useLibraryStore } from '@renderer/shared/model'
import { useState } from 'react'
import { useInfiniteScroll } from '@renderer/shared/lib'

import { useInfiniteLibraryItems } from '@renderer/entities/manga/api/useMangaQueries'

export default function LibraryPage() {
  const [activeTab, setActiveTab] = useState<'manga' | 'anime'>('manga')
  const { setSelectedManga } = useLibraryStore()
  const { 
    data, 
    isLoading, 
    isFetchingNextPage, 
    hasNextPage, 
    fetchNextPage 
  } = useInfiniteLibraryItems(activeTab)

  const loadMoreRef = useInfiniteScroll({
    hasNextPage,
    isFetchingNextPage: !!isFetchingNextPage,
    fetchNextPage
  })

  const allManga = data?.pages?.flat() || []

  if (isLoading && allManga.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 flex-1 flex flex-col h-full animate-in fade-in duration-500">
      <div className="flex flex-col space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex flex-col space-y-1.5">
            <h1 className="text-3xl font-bold tracking-tight">Library</h1>
            <p className="text-muted-foreground whitespace-nowrap">Your collection of saved {activeTab === 'anime' ? 'anime and series' : 'manga and manhwa'}.</p>
          </div>
          <MediaTabSwitcher activeTab={activeTab} onTabChange={setActiveTab} />
        </div>
      </div>

      {allManga.length === 0 && !isLoading && (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground py-20 space-y-2 opacity-60">
          {activeTab === 'anime' ? (
            <Play className="h-12 w-12 stroke-[1.5]" />
          ) : (
            <BookOpen className="h-12 w-12 stroke-[1.5]" />
          )}
          <p>Your {activeTab} library is empty. Browse sources to add titles.</p>
        </div>
      )}

      {allManga.length > 0 && (
        <div className="overflow-y-auto pr-2 pb-6 flex-1">
          <MediaGrid>
            {allManga.map((manga, idx) => {
              const norm = normalizeManga(manga)
              return (
                <MediaGridItem
                  key={norm.id}
                  title={norm.title}
                  coverUrl={norm.coverUrl}
                  mediaType={activeTab}
                  status={norm.status}
                  index={idx}
                  onClick={() => setSelectedManga(manga)}
                />
              )
            })}
          </MediaGrid>          
          {/* Intersection Observer Anchor */}
          <div ref={loadMoreRef} className="h-20 flex items-center justify-center mt-6">
            {isFetchingNextPage && (
              <Loader2 className="h-6 w-6 animate-spin text-primary opacity-50" />
            )}
            {!hasNextPage && allManga.length > 0 && (
              <p className="text-xs text-muted-foreground opacity-50 italic">No more items</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
