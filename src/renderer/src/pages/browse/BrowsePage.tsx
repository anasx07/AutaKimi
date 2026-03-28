import { useEffect, useState, useMemo } from 'react'
import { DataService } from '@renderer/shared/api'
import { ArrowLeft, Search, BookOpen, Loader2, ChevronDown, LayoutGrid, List, X, Filter } from 'lucide-react'
import { useLibraryStore, useExtensionStore, useSettingsStore } from '@renderer/shared/model'
import { useMangaPagination } from '@renderer/entities/manga/model/useMangaPagination'
import { useExtensionMetadata } from '@renderer/entities/extension/model/useExtensionMetadata'
import { Button, Input, Card, Badge, ErrorState, MediaGrid, MediaGridItem, MediaCardSkeleton } from '@renderer/shared/ui'
import { cn } from '@renderer/shared/lib/utils'

export default function BrowsePage() {
  const {
    displayMode, setDisplayMode
  } = useSettingsStore()

  const { setSelectedManga } = useLibraryStore()
  const { activeExtension, setActiveExtension } = useExtensionStore()
  
  // State definitions
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [activeFeed, setActiveFeed] = useState<'popular' | 'latest' | 'search'>('popular')
  const [showFilters, setShowFilters] = useState(false)
  const [selectedDemographics, setSelectedDemographics] = useState<string[]>([])
  const [selectedStatus, setSelectedStatus] = useState<string[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  const { metadata } = useExtensionMetadata(activeExtension)

  const activeFilterCount = useMemo(() => {
    return selectedDemographics.length + selectedStatus.length + selectedTags.length
  }, [selectedDemographics, selectedStatus, selectedTags])

  const filters = useMemo(() => ({
    selectedDemographics,
    selectedStatus,
    selectedTags
  }), [selectedDemographics, selectedStatus, selectedTags])

  const { mangaList, loading, error, paginationError, hasMore, lastElementRef, refresh, retryPagination } = useMangaPagination({
    activeExtension,
    activeFeed,
    debouncedSearch,
    filters
  })

  // Debounce search query updates
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      if (searchQuery) setActiveFeed('search')
    }, 500)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const POPULAR_TAGS = [
    { id: '391b042f-d80a-4d30-b458-0722bc63363e', name: 'Action' },
    { id: '4d32cc48-9f00-4cca-9b5a-aef099f08c40', name: 'Comedy' },
    { id: 'b9af3a06-f08a-4c2d-9b40-37412acdbde3', name: 'Drama' },
    { id: 'cdc58593-87dd-415e-bbc0-2ec27bf404cc', name: 'Fantasy' },
    { id: '423e2eaa-a7db-4f83-830a-ae1540fe54db', name: 'Romance' },
    { id: 'e5301a23-ebd9-49df-a0cb-fab75307b1a8', name: 'Slice of Life' },
    { id: 'eabc5bde-9397-43f0-aba4-400f87dd9339', name: 'Supernatural' },
    { id: '0bc0032e-4340-4966-88ef-22df6dbb51ba', name: 'Isekai' }
  ]

  const toggleItem = (list: string[], setList: (val: string[]) => void, item: string) => {
    setList(list.includes(item) ? list.filter(i => i !== item) : [...list, item])
  }

  return (
    <div className="p-6 w-full max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setActiveExtension(null)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {metadata?.name || 'Browse Source'}
            </h1>
            {metadata?.baseUrl && (
              <p className="text-xs text-primary font-medium hover:underline cursor-pointer">
                <a href={metadata.baseUrl} target="_blank" rel="noreferrer">
                  {metadata.baseUrl}
                </a>
              </p>
            )}
            {!metadata?.baseUrl && (
              <p className="text-xs text-muted-foreground font-mono">{activeExtension}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Tab Controls */}
          <div className="flex bg-secondary/30 p-1 rounded-lg border border-border overflow-hidden">
            {(['popular', 'latest', 'search'] as const).map((feed) => (
              <button
                key={feed}
                onClick={() => { setActiveFeed(feed); if (feed !== 'search') setSearchQuery('') }}
                className={cn(
                  "px-4 py-1.5 rounded-md text-sm font-medium transition-all capitalize",
                  activeFeed === feed
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                )}
              >
                {feed}
              </button>
            ))}
          </div>

          {/* Display Mode Toggle */}
          <div className="flex bg-secondary/30 p-1 rounded-lg border border-border">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDisplayMode('grid')}
              className={cn(
                "p-1.5 h-8 w-8 rounded-md transition-all",
                displayMode === 'grid'
                  ? "bg-background shadow-sm text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDisplayMode('list')}
              className={cn(
                "p-1.5 h-8 w-8 rounded-md transition-all",
                displayMode === 'list'
                  ? "bg-background shadow-sm text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex gap-3">
          <div className="relative flex-1 group">
            <Search className={cn(
              "absolute left-3 top-3.5 h-4 w-4 transition-colors",
              searchQuery ? "text-primary" : "text-muted-foreground group-focus-within:text-primary"
            )} />
            <Input
              className="pl-9 pr-10 h-11 bg-card/40 border-border/40 focus:border-primary/50 focus:ring-4 focus:ring-primary/5 transition-all rounded-xl"
              placeholder="Search manga in this source..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-3 p-1 hover:bg-secondary rounded-md text-muted-foreground hover:text-foreground transition-all animate-in zoom-in duration-200"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button
            variant={showFilters ? 'secondary' : 'outline'}
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "h-11 px-6 rounded-xl border-border/40 transition-all flex items-center gap-2",
              activeFilterCount > 0 && "border-primary/50 bg-primary/5"
            )}
          >
            <Filter className={cn("h-4 w-4", activeFilterCount > 0 && "text-primary")} />
            <span className="font-semibold text-xs">Filters</span>
            {activeFilterCount > 0 && (
              <Badge className="ml-1 h-5 min-w-[20px] px-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full border-none">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </div>

        {/* Floating Side Filter Drawer */}
        {showFilters && (
          <>
            <div 
              className="fixed inset-0 bg-background/40 backdrop-blur-[2px] z-[60] animate-in fade-in duration-300"
              onClick={() => setShowFilters(false)}
            />
            <div className="fixed right-0 top-0 bottom-0 w-80 bg-card border-l border-border z-[70] p-6 shadow-2xl animate-in slide-in-from-right duration-500 overflow-y-auto no-scrollbar">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-bold tracking-tight">Advanced Filters</h3>
                <Button variant="ghost" size="icon" onClick={() => setShowFilters(false)} className="rounded-full">
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <div className="space-y-8">
                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Demographic</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {['shounen', 'shoujo', 'seinen', 'josei'].map(demo => (
                      <Badge
                        key={demo}
                        variant={selectedDemographics.includes(demo) ? 'default' : 'outline'}
                        className={cn(
                          "cursor-pointer capitalize py-2 flex justify-center text-xs transition-all border-border/40",
                          selectedDemographics.includes(demo) ? "shadow-md shadow-primary/20" : "hover:bg-secondary/50"
                        )}
                        onClick={() => toggleItem(selectedDemographics, setSelectedDemographics, demo)}
                      >
                        {demo}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Status</h4>
                  <div className="flex flex-wrap gap-2">
                    {['ongoing', 'completed', 'hiatus', 'cancelled'].map(stat => (
                      <Badge
                        key={stat}
                        variant={selectedStatus.includes(stat) ? 'default' : 'outline'}
                        className={cn(
                          "cursor-pointer capitalize px-3 py-1.5 text-xs transition-all border-border/40",
                          selectedStatus.includes(stat) ? "shadow-md shadow-primary/20" : "hover:bg-secondary/50 font-medium"
                        )}
                        onClick={() => toggleItem(selectedStatus, setSelectedStatus, stat)}
                      >
                        {stat}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Popular Tags</h4>
                  <div className="flex flex-wrap gap-2">
                    {POPULAR_TAGS.map(tag => (
                      <Badge
                        key={tag.id}
                        variant={selectedTags.includes(tag.id) ? 'default' : 'outline'}
                        className={cn(
                          "cursor-pointer px-3 py-1.5 text-xs transition-all border-border/40",
                          selectedTags.includes(tag.id) ? "shadow-md shadow-primary/20" : "hover:bg-secondary/50 font-medium"
                        )}
                        onClick={() => toggleItem(selectedTags, setSelectedTags, tag.id)}
                      >
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-12 pt-6 border-t border-border/50 flex flex-col gap-3">
                <Button
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl h-11 shadow-lg shadow-primary/20"
                  onClick={() => setShowFilters(false)}
                >
                  Apply Filters
                </Button>
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full text-xs font-semibold tracking-wide transition-colors rounded-xl h-11",
                    activeFilterCount > 0 ? "text-destructive hover:bg-destructive/10" : "text-muted-foreground opacity-50 pointer-events-none"
                  )}
                  onClick={() => { setSelectedDemographics([]); setSelectedStatus([]); setSelectedTags([]); }}
                >
                  Reset All Filters
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {loading && mangaList.length === 0 && (
        <MediaGrid className="pr-2">
          {Array.from({ length: 15 }).map((_, i) => (
            <MediaCardSkeleton key={i} />
          ))}
        </MediaGrid>
      )}

      {error && mangaList.length === 0 && (
        <ErrorState
          title={error.includes('400') || error.includes('403') ? "Cloudflare / Network Error" : "Fetch Error"}
          message={error}
          onRetry={refresh}
          onWebView={() => metadata?.baseUrl && DataService.openInternalBrowser(metadata.baseUrl)}
          onReport={() => window.api.openExternal('https://github.com/anasx07/AutaKimi-Release/issues/new')}
          details={{
            source: metadata?.name || activeExtension,
            ext: activeExtension,
            err: error
          }}
        />
      )}

      {mangaList.length > 0 && (
        <div className="space-y-6">
          {displayMode === 'grid' ? (
            <MediaGrid className="pr-2">
              {mangaList.map((manga, idx) => (
                <MediaGridItem
                  key={manga.id}
                  title={manga.title}
                  coverUrl={manga.coverUrl}
                  mediaType="manga"
                  description={manga.description}
                  index={idx}
                  onClick={() => setSelectedManga(manga)}
                  badge={
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <span dir="auto">{manga.status?.split(' • ')[0] || manga.status}</span>
                      {manga.status?.includes(' • ') && <span className="opacity-40">•</span>}
                      <span dir="auto">{manga.status?.split(' • ')[1]}</span>
                    </div>
                  }
                  footerBadge={
                    <Badge variant="outline" className="h-4 text-[8px] px-1 border-border/50 uppercase">Manga</Badge>
                  }
                />
              ))}
            </MediaGrid>) : (
            <div className="space-y-3 pr-2">
              {mangaList.map((manga, idx) => (
                <Card
                  key={manga.id}
                  onClick={() => setSelectedManga(manga)}
                  className={cn(
                    "group flex gap-4 p-3 cursor-pointer hover:bg-secondary/30 transition-all duration-300 border-border/40 hover:shadow-lg",
                    "animate-in fade-in slide-in-from-left-4"
                  )}
                  style={{ animationDelay: `${idx * 30}ms` }}
                >
                  <div className="w-20 h-28 shrink-0 bg-secondary/30 rounded-lg overflow-hidden border border-border/50 shadow-sm relative">
                    {manga.coverUrl ? (
                      <img
                        src={manga.coverUrl}
                        alt={manga.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <BookOpen className="h-6 w-6 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center py-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-lg line-clamp-1 group-hover:text-primary transition-colors">{manga.title}</h3>
                      <Badge variant="secondary" className="shrink-0 flex items-center gap-1.5 text-[10px] h-5 px-2 bg-primary/10 text-primary border-primary/20 uppercase tracking-wider">
                        <span dir="auto">{manga.status?.split(' • ')[0] || manga.status}</span>
                        {manga.status?.includes(' • ') && <span className="opacity-40">•</span>}
                        <span dir="auto">{manga.status?.split(' • ')[1]}</span>
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-2 leading-relaxed opacity-80 group-hover:opacity-100 transition-opacity">
                      {manga.description}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          )}

          <div ref={lastElementRef} className="pb-20 flex flex-col items-center justify-center">
            {loading && hasMore && (
              <div className="flex flex-col items-center gap-3 py-10">
                <Loader2 className="h-6 w-6 animate-spin text-primary opacity-50" />
                <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold animate-pulse">Loading Content</span>
              </div>
            )}

            {paginationError && (
              <ErrorState
                className="py-10 border-t border-border/20 w-full"
                title="Pagination Failed"
                message={paginationError}
                onRetry={retryPagination}
                onWebView={() => metadata?.baseUrl && DataService.openInternalBrowser(metadata.baseUrl)}
                onReport={() => window.api.openExternal('https://github.com/anasx07/AutaKimi-Release/issues')}
              />
            )}

            {!hasMore && !paginationError && mangaList.length > 0 && (
              <div className="flex items-center gap-4 w-full py-10">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent to-border/50" />
                <p className="text-[10px] text-muted-foreground/40 font-bold uppercase tracking-[0.3em]">End of results</p>
                <div className="h-px flex-1 bg-gradient-to-l from-transparent to-border/50" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
