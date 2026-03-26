import { BookOpen, Loader2, Play } from 'lucide-react'
import { normalizeManga } from '@common/utils/mangaNormalizer'
import { Card, CardContent, Badge, Button } from '@renderer/shared/ui'
import { useLibraryStore } from '@renderer/shared/model'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@renderer/shared/lib/utils'

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

  const loadMoreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { threshold: 0.1 }
    )

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current)
    }

    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const allManga = data?.pages.flat() || []

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
          <div className="flex items-center gap-1 bg-secondary/30 p-1 rounded-lg border border-border/40 w-fit">
            <Button
              variant={activeTab === 'manga' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('manga')}
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
              onClick={() => setActiveTab('anime')}
              className={cn(
                "h-8 px-4 rounded-md text-xs font-bold transition-all",
                activeTab === 'anime' ? "shadow-md" : "text-muted-foreground"
              )}
            >
              Anime
            </Button>
          </div>
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 items-start content-start">
            {allManga.map((manga) => {
              const norm = normalizeManga(manga)
              return (
                <Card
                  key={norm.id}
                  onClick={() => setSelectedManga(manga)}
                  className="group relative cursor-pointer overflow-hidden border-border/40 hover:border-primary/50 hover:shadow-lg transition-all duration-300"
                >
                  <div className="aspect-[3/4] relative overflow-hidden bg-secondary/20">
                    {norm.coverUrl ? (
                      <img 
                        src={norm.coverUrl} 
                        alt={norm.title} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        {activeTab === 'anime' ? (
                          <Play className="h-10 w-10 text-muted-foreground/30" />
                        ) : (
                          <BookOpen className="h-10 w-10 text-muted-foreground/30" />
                        )}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </div>
                  <CardContent className="p-3 bg-card">
                    <h3 className="font-semibold text-sm line-clamp-1 group-hover:text-primary transition-colors">{norm.title}</h3>
                    <div className="flex items-center justify-between mt-1">
                      <Badge variant="secondary" className="px-1.5 py-0 text-[10px] uppercase font-bold tracking-wider opacity-80">
                        {norm.status || 'Unknown'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
          
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
