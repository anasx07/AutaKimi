import { DataService } from '@renderer/shared/api'
import { useEffect, useState } from 'react'
import {
  ArrowLeft, Play, RefreshCw, CheckCircle,
  Loader2, Share2, ShieldAlert, Heart, Globe,
  Search, ChevronDown, ChevronUp, ExternalLink
} from 'lucide-react'
import {
  useUIStore,
  useLibraryStore,
  useProgressStore,
  useExtensionStore
} from '@renderer/shared/model'
import { cn } from '@renderer/shared/lib/utils'
import { Button, Badge, Card, Input } from '@renderer/shared/ui'

import { useMangaDetails, useMangaChapters, useLibraryItems, useToggleLibrary } from '@renderer/entities/manga/api/useMangaQueries'
import { normalizeManga } from '@common/utils/mangaNormalizer'
import { Chapter } from '@renderer/shared/api/sources/types'

export default function AnimeDetails() {
  const { isCfBypassing, cfDomain } = useUIStore()
  const {
    selectedManga, setSelectedManga, setActiveChapter
  } = useLibraryStore()
  const { activeExtension, installedExtensions } = useExtensionStore()
  const { readingProgress, loadProgress } = useProgressStore()

  const { detailQuery, chaptersQuery } = (() => {
    const pkgToUse = selectedManga?.pkg || activeExtension;
    const d = useMangaDetails(selectedManga?.id || '', pkgToUse, selectedManga?.url)
    const c = useMangaChapters(selectedManga?.id || '', pkgToUse, selectedManga?.url)
    return { detailQuery: d, chaptersQuery: c }
  })()

  const { data: episodes = [] } = chaptersQuery
  const loading = detailQuery.isLoading || chaptersQuery.isLoading
  const error = (detailQuery.error as Error)?.message || (chaptersQuery.error as Error)?.message || null

  const toggleLibraryMutation = useToggleLibrary()
  const { data: libraryItems = [] } = useLibraryItems('anime')

  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [descExpanded, setDescExpanded] = useState(false)
  const [episodeSearch, setEpisodeSearch] = useState('')
  const [showEpisodeSearch, setShowEpisodeSearch] = useState(false)

  const watchedEpisodeIds = selectedManga ? (readingProgress[selectedManga.id] || []) : []
  const isInLibrary = libraryItems.some(m => m.id === selectedManga?.id)

  const extension = installedExtensions.find(e => e.pkg === activeExtension)
  const pkgParts = activeExtension ? activeExtension.split('.') : []
  const extLang = extension?.lang || (pkgParts.length >= 4 ? pkgParts[3] : 'all')

  const anime = normalizeManga(selectedManga, extLang);

  useEffect(() => {
    if (selectedManga) loadProgress(selectedManga.id)
  }, [selectedManga?.id])

  useEffect(() => {
    if (detailQuery.data && selectedManga) {
      const fresh = detailQuery.data
      const hasChanged =
        fresh.description !== selectedManga.description ||
        fresh.status !== selectedManga.status
      
      if (hasChanged) {
        setSelectedManga({
          ...selectedManga,
          ...fresh
        })
      }
    }
  }, [detailQuery.data, selectedManga?.id])

  if (!selectedManga) return null

  const title = anime.title
  const coverUrl = anime.coverUrl

  const sortedEpisodes = [...episodes].sort((a, b) => {
    const numA = a.number || 0
    const numB = b.number || 0
    return sortOrder === 'desc' ? numB - numA : numA - numB
  })

  const nextToWatch = (() => {
    if (episodes.length === 0) return null
    const ascEpisodes = [...episodes].sort((a, b) => (a.number || 0) - (b.number || 0))
    const firstUnwatched = ascEpisodes.find(e => !watchedEpisodeIds.includes(e.id))
    return firstUnwatched || ascEpisodes[ascEpisodes.length - 1] || null
  })()

  const filteredEpisodes = sortedEpisodes.filter(e =>
    e.number?.toString().toLowerCase().includes(episodeSearch.toLowerCase()) ||
    e.title.toLowerCase().includes(episodeSearch.toLowerCase())
  )

  const episodePrefix = extLang === 'ar' ? 'الحلقة' : 'Episode'

  const handlePlay = (episode: Chapter) => {
    setActiveChapter(episode)
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-y-auto anime-details-page">
      {/* Top Header Bar */}
      <div className="sticky top-0 z-50 flex items-center justify-between p-4 bg-background/60 backdrop-blur-md border-b border-primary/10">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSelectedManga(null)}
          className="h-8 w-8 hover:bg-primary/10"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-amber-500 hover:text-amber-600 hover:bg-amber-500/10"
            title="Solve Cloudflare"
            onClick={() => anime.url && DataService.openInternalBrowser(anime.url)}
          >
            <ShieldAlert className="h-4.5 w-4.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10" onClick={() => anime.url && DataService.openExternal(anime.url)}>
            <Share2 className="h-4.5 w-4.5" />
          </Button>
        </div>
      </div>

      {/* Hero Section */}
      <div className="relative w-full overflow-hidden flex-shrink-0 pt-4 px-6 pb-6 border-b border-primary/10">
        {coverUrl && (
          <div className="absolute inset-0 z-0">
            <img src={coverUrl} alt="" className="w-full h-full object-cover blur-3xl opacity-35 saturate-150 scale-125" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent"></div>
          </div>
        )}

        <div className="relative z-10 flex gap-6 max-w-7xl mx-auto w-full">
          <Card className="w-32 h-44 sm:w-40 sm:h-56 flex-shrink-0 border-primary/20 shadow-2xl shadow-primary/10 overflow-hidden rounded-lg">
            {coverUrl ? (
              <img src={coverUrl} alt={title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary">
                <Play className="h-12 w-12" />
              </div>
            )}
          </Card>

          <div className="flex-1 flex flex-col justify-end pb-1 space-y-1.5 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground line-clamp-2 leading-tight">
              {title}
            </h1>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm">
                <div className="flex items-center gap-1 text-primary font-semibold">
                  <Play className="h-3.5 w-3.5 fill-current" />
                  <span dir="auto">{anime.status?.split(' • ')[0] || anime.status}</span>
                  {anime.status?.includes(' • ') && <span className="opacity-40">•</span>}
                  <span dir="auto">{anime.status?.split(' • ')[1]}</span>
                </div>
                <span className="text-muted-foreground/40">•</span>
                <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                   {extension?.name || activeExtension?.split('.').pop()} ({extLang.toUpperCase()})
                </span>
                {isInLibrary && (
                   <>
                     <span className="text-muted-foreground/40">•</span>
                     <Badge variant="secondary" className="bg-primary/10 text-primary border-none h-5">In Library</Badge>
                   </>
                )}
              </div>

              {anime.url && (
                <button
                  onClick={() => DataService.openExternal(anime.url!)}
                  className="text-xs text-muted-foreground/60 hover:text-primary transition-colors truncate max-w-full flex items-center gap-1 mt-1 underline underline-offset-2"
                >
                  <ExternalLink className="h-3 w-3 flex-shrink-0" />
                  {anime.url}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Action Tab Bar */}
      <div className="grid grid-cols-3 gap-3 py-4 px-6 max-w-7xl mx-auto w-full border-b border-primary/10">
        <Button
          variant="outline"
          onClick={() => toggleLibraryMutation.mutate(selectedManga)}
          disabled={toggleLibraryMutation.isPending}
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
          className="h-14 flex flex-col items-center justify-center gap-1 bg-secondary/10 backdrop-blur-sm border-border/30 rounded-xl opacity-50 cursor-not-allowed font-semibold text-muted-foreground"
        >
          <RefreshCw className="h-5 w-5" />
          <span className="text-[11px]">Tracking</span>
        </Button>

        <Button
          variant="outline"
          onClick={() => anime.url && DataService.openExternal(anime.url)}
          className="h-14 flex flex-col items-center justify-center gap-1 bg-secondary/10 backdrop-blur-sm border-border/30 hover:bg-secondary/20 rounded-xl transition-all font-semibold text-muted-foreground hover:text-foreground"
        >
          <Globe className="h-5 w-5" />
          <span className="text-[11px]">Web View</span>
        </Button>
      </div>

      <div className="p-6 max-w-7xl mx-auto w-full flex-1 space-y-6">
        {/* Synopsis */}
        <Card className="p-5 bg-primary/5 border-primary/10 backdrop-blur-md rounded-xl space-y-4 shadow-none">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-primary">
               Synopsis
            </h2>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs gap-1 text-muted-foreground hover:text-primary"
              onClick={() => setDescExpanded(!descExpanded)}
            >
              {descExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {descExpanded ? 'Show less' : 'Show more'}
            </Button>
          </div>

          <div className="relative">
            <p className={cn(
              "text-sm text-foreground/90 leading-relaxed whitespace-pre-line transition-all duration-300",
              !descExpanded && "line-clamp-3"
            )}>
              {anime.description || 'No description available.'}
            </p>
          </div>
        </Card>

        {/* Watch Now Button */}
        {!loading && !error && episodes.length > 0 && nextToWatch && (
          <Button
            className="w-full h-14 bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 flex items-center justify-center gap-3 rounded-xl transition-all active:scale-[0.99] group overflow-hidden relative"
            onClick={() => handlePlay(nextToWatch)}
          >
            <Play className="h-5 w-5 fill-current" />
            <div className="flex flex-col items-start leading-tight text-left">
              <span className="text-[10px] uppercase font-bold opacity-80">Continue Watching</span>
              <span className="text-sm font-semibold truncate max-w-[280px]">
                {episodePrefix} {nextToWatch.number} {nextToWatch.title ? `- ${nextToWatch.title}` : ''}
              </span>
            </div>
          </Button>
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{episodes.length} Episodes</h2>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className={cn("h-8 w-8 hover:bg-primary/10", showEpisodeSearch && "text-primary bg-primary/10")}
                onClick={() => setShowEpisodeSearch(!showEpisodeSearch)}
              >
                <Search className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-8 gap-1 text-muted-foreground hover:text-primary"
                onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
              >
                <RefreshCw className={cn("h-3.5 w-3.5 transition-transform", sortOrder === 'asc' && "rotate-180")} />
                {sortOrder === 'desc' ? 'Newest' : 'Oldest'}
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.location.reload()}>
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {showEpisodeSearch && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search episodes..."
                className="pl-9 h-10 border-primary/20 focus:border-primary/40"
                value={episodeSearch}
                onChange={(e) => setEpisodeSearch(e.target.value)}
                autoFocus
              />
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-primary opacity-60" />
              <div className="flex flex-col items-center gap-1">
                 <span className="text-sm font-medium">
                   {isCfBypassing ? `Bypassing protection for ${cfDomain}...` : 'Loading episodes...'}
                 </span>
              </div>
            </div>
          )}

          {error && (
            <Badge variant="destructive" className="w-full justify-start p-4 text-sm font-normal">
              {error}
            </Badge>
          )}

          <div className="divide-y divide-primary/10 border border-primary/10 rounded-xl bg-primary/[0.02] overflow-hidden max-h-[600px] overflow-y-auto shadow-none">
            {filteredEpisodes.map((ep) => {
              const isWatched = watchedEpisodeIds.includes(ep.id)
              return (
                <div
                  key={ep.id}
                  className={cn(
                    "flex items-center justify-between w-full px-4 py-4 hover:bg-primary/5 transition-all duration-200 group cursor-pointer",
                    isWatched && "opacity-60"
                  )}
                  onClick={() => handlePlay(ep)}
                >
                  <div className="flex-1 flex flex-col items-start text-left min-w-0 pr-4">
                    <div className="flex items-center gap-2 max-w-full">
                      <span className={cn(
                        "font-semibold text-sm transition-colors truncate",
                        isWatched ? "text-muted-foreground" : "text-foreground group-hover:text-primary"
                      )}>
                        {episodePrefix} {ep.number}
                      </span>
                      {isWatched && <CheckCircle className="h-3 w-3 text-primary fill-primary/10" />}
                    </div>
                    {ep.title && (
                      <p className="text-[11px] text-muted-foreground truncate w-full mt-0.5">
                        {ep.title}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-primary"
                    >
                      <Play className="h-4 w-4 fill-current" />
                    </Button>
                  </div>
                </div>
              )
            })}
            {!loading && filteredEpisodes.length === 0 && (
              <div className="text-center py-12 text-muted-foreground text-sm italic">
                {episodeSearch ? `No episodes matching "${episodeSearch}"` : 'No episodes available.'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
