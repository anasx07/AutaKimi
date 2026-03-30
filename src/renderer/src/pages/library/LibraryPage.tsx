import { BookOpen, Play, Loader2, Trash2 } from 'lucide-react'
import { normalizeManga } from '@common/utils/mangaNormalizer'
import {
  MediaTabSwitcher,
  MediaGrid,
  MediaGridItem,
  EmptyState,
  MediaCardSkeleton,
  Button,
  Dialog,
  LayoutSwitcher,
  MediaList,
  MediaListItem
} from '@renderer/shared/ui'
import { useLibraryStore } from '@renderer/shared/model'
import { useState } from 'react'
import { useInfiniteScroll } from '@renderer/shared/lib'
import { useQueryClient } from '@tanstack/react-query'
import { DataService } from '@renderer/shared/api'
import { useUIStore } from '@renderer/shared/model'

import {
  useInfiniteLibraryItems,
  mangaKeys
} from '@renderer/entities/manga/api/useMangaQueries'

export default function LibraryPage() {
  const [activeTab, setActiveTab] = useState<'manga' | 'anime'>('manga')
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false)
  const queryClient = useQueryClient()
  const { setSelectedManga } = useLibraryStore()
  const { viewMode } = useUIStore()
  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } =
    useInfiniteLibraryItems(activeTab)

  const loadMoreRef = useInfiniteScroll({
    hasNextPage,
    isFetchingNextPage: !!isFetchingNextPage,
    fetchNextPage
  })

  const handleClearLibrary = async () => {
    try {
      await DataService.db.clearLibrary(activeTab)
      queryClient.invalidateQueries({ queryKey: mangaKeys.libraryInfinite(activeTab) })
      queryClient.invalidateQueries({ queryKey: mangaKeys.library(activeTab) })
      setIsConfirmClearOpen(false)
    } catch (error) {
      console.error('Failed to clear library:', error)
    }
  }

  const allManga = data?.pages?.flat() || []

  return (
    <div className="flex flex-col h-full w-full p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="shrink-0 flex flex-col space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex flex-col space-y-1.5">
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">Library</h1>
              {allManga.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive transition-colors"
                  onClick={() => setIsConfirmClearOpen(true)}
                  title={`Clear all ${activeTab}`}
                >
                  <Trash2 className="h-4.5 w-4.5" />
                </Button>
              )}
            </div>
            <p className="text-muted-foreground whitespace-nowrap">
              Your collection of saved{' '}
              {activeTab === 'anime' ? 'anime and series' : 'manga and manhwa'}.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <LayoutSwitcher />
            <MediaTabSwitcher activeTab={activeTab} onTabChange={setActiveTab} />
          </div>
        </div>
      </div>

      <Dialog
        isOpen={isConfirmClearOpen}
        onClose={() => setIsConfirmClearOpen(false)}
        title={`Clear ${activeTab === 'anime' ? 'Anime' : 'Manga'} Library?`}
      >
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Are you sure you want to clear your entire {activeTab} library? This action cannot be
            undone.
          </p>
          <div className="flex gap-3 justify-end w-full">
            <Button variant="outline" onClick={() => setIsConfirmClearOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleClearLibrary}>
              Clear All
            </Button>
          </div>
        </div>
      </Dialog>

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {isLoading && allManga.length === 0 ? (
          <div className="flex-1 overflow-y-auto pr-2 pb-6">
            <MediaGrid>
              {Array.from({ length: 15 }).map((_, i) => (
                <MediaCardSkeleton key={i} />
              ))}
            </MediaGrid>
          </div>
        ) : allManga.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 pb-40">
            <EmptyState
              icon={
                activeTab === 'anime' ? (
                  <Play className="h-8 w-8 text-primary ml-1" />
                ) : (
                  <BookOpen className="h-8 w-8 text-primary" />
                )
              }
              title={`No ${activeTab} saved`}
              description={`Your ${activeTab} library is empty. Browse sources to discover and add titles to your collection.`}
            />
          </div>
        ) : (
          <div className="overflow-y-auto pr-2 pb-6 flex-1">
            {viewMode === 'grid' ? (
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
            ) : (
              <MediaList>
                {allManga.map((manga, idx) => {
                  const norm = normalizeManga(manga)
                  return (
                    <MediaListItem
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
              </MediaList>
            )}
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
    </div>
  )
}
