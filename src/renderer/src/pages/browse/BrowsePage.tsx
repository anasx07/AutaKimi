import { useEffect, useState, useMemo } from 'react'
import { DataService } from '@renderer/shared/api'
import { ArrowLeft, Search, BookOpen, Loader2, ChevronDown, LayoutGrid, List } from 'lucide-react'
import { useLibraryStore, useExtensionStore, useSettingsStore, useUIStore } from '@renderer/shared/model'
import { useMangaPagination } from '@renderer/entities/manga/model/useMangaPagination'
import { useExtensionMetadata } from '@renderer/entities/extension/model/useExtensionMetadata'
import { Button, Input, Card, Badge, ErrorState } from '@renderer/shared/ui'
import { cn } from '@renderer/shared/lib/utils'

export default function BrowsePage() {
  const {
    displayMode, setDisplayMode
  } = useSettingsStore()

  const { setSelectedManga } = useLibraryStore()
  const { activeExtension, setActiveExtension } = useExtensionStore()
  const { isCfBypassing, cfDomain } = useUIStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [activeFeed, setActiveFeed] = useState<'popular' | 'latest' | 'search'>('popular')
  const [showFilters, setShowFilters] = useState(false)
  const [selectedDemographics, setSelectedDemographics] = useState<string[]>([])
  const [selectedStatus, setSelectedStatus] = useState<string[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  const { metadata } = useExtensionMetadata(activeExtension)

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
        <div className="flex gap-2">
          <div className="relative flex-1 group">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input
              className="pl-9 bg-card/50 border-border/50 focus:border-primary/50 transition-all"
              placeholder="Search manga in this source..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button
            variant={showFilters ? 'secondary' : 'outline'}
            onClick={() => setShowFilters(!showFilters)}
            className="gap-2 px-4 border-border/50"
          >
            <span>Filters</span>
            <ChevronDown className={cn("h-4 w-4 transition-transform duration-300", showFilters && "rotate-180")} />
          </Button>
        </div>

        {showFilters && (
          <Card className="p-5 bg-card/50 backdrop-blur-sm space-y-5 animate-in slide-in-from-top-2 duration-300 border-border/40">
            <div className="space-y-3">
              <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Demographic</h4>
              <div className="flex flex-wrap gap-2">
                {['shounen', 'shoujo', 'seinen', 'josei'].map(demo => (
                  <Badge
                    key={demo}
                    variant={selectedDemographics.includes(demo) ? 'default' : 'outline'}
                    className="cursor-pointer capitalize px-3 py-1 text-xs transition-all hover:scale-105 active:scale-95"
                    onClick={() => toggleItem(selectedDemographics, setSelectedDemographics, demo)}
                  >
                    {demo}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Status</h4>
              <div className="flex flex-wrap gap-2">
                {['ongoing', 'completed', 'hiatus', 'cancelled'].map(stat => (
                  <Badge
                    key={stat}
                    variant={selectedStatus.includes(stat) ? 'default' : 'outline'}
                    className="cursor-pointer capitalize px-3 py-1 text-xs transition-all hover:scale-105 active:scale-95"
                    onClick={() => toggleItem(selectedStatus, setSelectedStatus, stat)}
                  >
                    {stat}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Popular Tags</h4>
              <div className="flex flex-wrap gap-2">
                {POPULAR_TAGS.map(tag => (
                  <Badge
                    key={tag.id}
                    variant={selectedTags.includes(tag.id) ? 'default' : 'outline'}
                    className="cursor-pointer px-3 py-1 text-xs transition-all hover:scale-105 active:scale-95"
                    onClick={() => toggleItem(selectedTags, setSelectedTags, tag.id)}
                  >
                    {tag.name}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-border/30">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setSelectedDemographics([]); setSelectedStatus([]); setSelectedTags([]); setSearchQuery('') }}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                Reset All Filters
              </Button>
            </div>
          </Card>
        )}
      </div>

      {loading && mangaList.length === 0 && (
        <div className="h-[400px] flex flex-col items-center justify-center text-muted-foreground space-y-4 animate-pulse">
          <div className="relative">
            <Loader2 className={cn("h-10 w-10 animate-spin text-primary opacity-50", isCfBypassing && "text-amber-500 opacity-80")} />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className={cn("h-2 w-2 bg-primary rounded-full animate-ping", isCfBypassing && "bg-amber-500")} />
            </div>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <p className={cn("text-sm font-medium tracking-wide", isCfBypassing && "text-amber-500/90")}>
              {isCfBypassing 
                ? `Bypassing Cloudflare protection${cfDomain ? ` for ${cfDomain}` : ''}...` 
                : 'Syncing with source...'}
            </p>
            {isCfBypassing && (
              <p className="text-[10px] uppercase tracking-widest opacity-50 font-bold">Please wait a moment</p>
            )}
          </div>
        </div>
      )}

      {error && mangaList.length === 0 && (
        <ErrorState
          title={error.includes('400') || error.includes('403') ? "Cloudflare / Network Error" : "Fetch Error"}
          message={error}
          onRetry={refresh}
          onWebView={() => metadata?.baseUrl && DataService.openInternalBrowser(metadata.baseUrl)}
          onReport={() => window.api.openExternal('https://github.com/anasx07/LManwa-Release/issues/new')}
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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 items-start content-start pr-2">
              {mangaList.map((manga, idx) => (
                <Card
                  key={manga.id}
                  onClick={() => setSelectedManga(manga)}
                  className={cn(
                    "group relative cursor-pointer hover:border-primary/40 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 bg-card/40 border-border/40 overflow-hidden",
                    "animate-in fade-in slide-in-from-bottom-4"
                  )}
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <div className="aspect-[3/4] bg-secondary/30 relative overflow-hidden">
                    {manga.coverUrl ? (
                      <img
                        src={manga.coverUrl}
                        alt={manga.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <BookOpen className="h-12 w-12 text-muted-foreground/30" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                      <p className="text-[11px] text-white/80 line-clamp-4 leading-relaxed transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                        {manga.description}
                      </p>
                    </div>
                  </div>
                  <div className="p-4 space-y-1.5">
                    <h3 className="font-bold text-sm line-clamp-1 group-hover:text-primary transition-colors">{manga.title}</h3>
                    <div className="flex items-center justify-between gap-2.5">
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider font-semibold opacity-70 transition-opacity group-hover:opacity-100">
                        <span dir="auto">{manga.status?.split(' • ')[0] || manga.status}</span>
                        {manga.status?.includes(' • ') && <span className="opacity-40">•</span>}
                        <span dir="auto">{manga.status?.split(' • ')[1]}</span>
                      </div>
                      <Badge variant="outline" className="h-4 text-[8px] px-1 border-border/50 uppercase">Manga</Badge>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
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
                onReport={() => window.api.openExternal('https://github.com/anasx07/LManwa-Release/issues')}
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
