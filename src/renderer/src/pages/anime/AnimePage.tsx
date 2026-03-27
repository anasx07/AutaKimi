import { useState, useMemo } from 'react'
import { ExternalLink, Play, ArrowLeft, Search, Loader2, LayoutGrid, List, Pin, PinOff } from 'lucide-react'
import { Button, Badge, Card, Input, ErrorState, MediaCardSkeleton, MediaGrid } from '@renderer/shared/ui'
import { cn } from '@renderer/shared/lib/utils'
import { useExtensionStore } from '@renderer/shared/model'
import { useExtensionMetadata } from '@renderer/entities/extension/model/useExtensionMetadata'
import { useMangaPagination } from '@renderer/entities/manga/model/useMangaPagination'
import { useLibraryStore, useSettingsStore } from '@renderer/shared/model'
import { DataService } from '@renderer/shared/api'
import animeExtensions from '@renderer/shared/api/anime-sources/Anime.json'
import { getAnimeSource } from '@renderer/shared/api/anime-sources'



interface AnimeExtensionJSON {
  pkg: string
  name: string
  lang: string
  version: string
  isSupported?: boolean
  sources: { name: string; baseUrl: string }[]
}

export default function AnimePage() {
  const { installedExtensions } = useExtensionStore()
  const { displayMode, setDisplayMode, pinnedAnimeSources, togglePinnedAnimeSource } = useSettingsStore()
  const { setSelectedManga } = useLibraryStore()

  const [activeAnimePkg, setActiveAnimePkg] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [activeFeed, setActiveFeed] = useState<'popular' | 'latest' | 'search'>('popular')

  // Display all anime extensions defined in our metadata
  const displayExtensions = useMemo(() =>
    (animeExtensions as AnimeExtensionJSON[])
      .map(ae => {
        const installed = installedExtensions.find(ie => ie.pkg === ae.pkg)
        return {
          ...(installed || {
            pkg: ae.pkg,
            name: ae.name,
            lang: ae.lang,
            baseUrl: ae.sources[0]?.baseUrl || '',
            version: ae.version,
            icon: ae.pkg
          }),
          isSupported: ae.isSupported
        }
      })
      .sort((a, b) => {
        const aPinned = pinnedAnimeSources.includes(a.pkg)
        const bPinned = pinnedAnimeSources.includes(b.pkg)
        if (aPinned && !bPinned) return -1
        if (!aPinned && bPinned) return 1
        return 0
      }),
    [installedExtensions, pinnedAnimeSources]
  )

  const activeSource = useMemo(() =>
    activeAnimePkg ? getAnimeSource(activeAnimePkg) : null,
    [activeAnimePkg]
  )

  const feedLabels = useMemo(() =>
    activeSource?.getFeedLabels?.() || {
      popular: 'Popular',
      latest: 'Latest',
      search: 'Search'
    },
    [activeSource]
  )

  const { metadata } = useExtensionMetadata(activeAnimePkg)

  const filters = useMemo(() => ({
    selectedDemographics: [] as string[],
    selectedStatus: [] as string[],
    selectedTags: [] as string[],
  }), [])

  const { mangaList, loading, error, paginationError, hasMore, lastElementRef, refresh, retryPagination } =
    useMangaPagination({
      activeExtension: activeAnimePkg,
      activeFeed,
      debouncedSearch,
      filters,
    })

  // Debounce search
  const handleSearch = (v: string) => {
    setSearchQuery(v)
    const timer = setTimeout(() => {
      setDebouncedSearch(v)
      if (v) setActiveFeed('search')
    }, 500)
    return () => clearTimeout(timer)
  }

  // ── No anime sources available ─────────────────────────────────────────────
  if (displayExtensions.length === 0) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-10 animate-in fade-in duration-700">
        <div className="flex flex-col items-center justify-center text-muted-foreground space-y-5 pt-10">
          <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center ring-2 ring-primary/20">
            <Play className="h-10 w-10 text-primary" />
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-xl font-semibold text-foreground">No Anime Sources Installed</h3>
            <p className="text-sm max-w-xs">
              Install an anime source from the list below to start watching.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/50 ml-1">Available Sources</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {displayExtensions.map((ext) => (
              <Card
                key={ext.pkg}
                className="group p-5 bg-card/40 border-border/40 hover:border-primary/30 transition-all duration-300"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center ring-1 ring-primary/10 overflow-hidden">
                    <img
                      src={new URL(`../../app/assets/Animeicon/${ext.pkg}.png`, import.meta.url).href}
                      className="w-full h-full object-contain p-1"
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm truncate">{ext.name}</h3>
                    <p className="text-[10px] text-muted-foreground uppercase">{ext.lang}</p>
                  </div>
                  <Button
                    size="sm"
                    className="bg-primary hover:bg-primary/90 h-8 px-4"
                    onClick={async () => {
                      try {
                        await DataService.installExtension(ext, 'local')
                        // Trigger a refresh of the store list
                        await useExtensionStore.getState().loadInstalled()
                      } catch (e) {
                        console.error('Failed to install anime extension:', e)
                      }
                    }}
                  >
                    Install
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Source selector (no source selected yet) ─────────────────────────────────
  if (!activeAnimePkg) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Anime (Beta)
          </h1>
          <p className="text-muted-foreground text-sm">Choose an anime source to start browsing.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {displayExtensions.map((ext, idx) => (
            <Card
              key={ext.pkg}
              className={cn(
                'group p-5 bg-card/50 backdrop-blur-sm hover:bg-secondary/30 transition-all duration-300 hover:shadow-xl border-border/40 cursor-pointer',
                'animate-in fade-in slide-in-from-bottom-4'
              )}
              style={{ animationDelay: `${idx * 60}ms` }}
              onClick={() => setActiveAnimePkg(ext.pkg)}
            >
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center ring-1 ring-primary/20 overflow-hidden group-hover:scale-105 transition-transform shrink-0 relative">
                  <img
                    src={(() => {
                      try {
                        return new URL(`../../app/assets/Animeicon/${ext.pkg}.png`, import.meta.url).href
                      } catch {
                        return ''
                      }
                    })()}
                    alt={ext.name}
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                      const fb = e.currentTarget.parentElement?.querySelector('.fb-icon')
                      if (fb) (fb as HTMLElement).style.display = 'flex'
                    }}
                  />
                  <div className="fb-icon hidden w-full h-full items-center justify-center">
                    <Play className="h-6 w-6 text-primary" />
                  </div>

                  {/* Pin Toggle Overlay */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "absolute top-0 right-0 h-6 w-6 rounded-bl-xl rounded-tr-none bg-black/40 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all hover:bg-primary/80 hover:text-white z-10",
                      pinnedAnimeSources.includes(ext.pkg) && "opacity-100 text-primary bg-primary/20"
                    )}
                    onClick={(e) => {
                      e.stopPropagation()
                      togglePinnedAnimeSource(ext.pkg)
                    }}
                  >
                    {pinnedAnimeSources.includes(ext.pkg) ? (
                      <PinOff className="h-3 w-3" />
                    ) : (
                      <Pin className="h-3 w-3" />
                    )}
                  </Button>
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-bold text-base truncate group-hover:text-primary transition-colors">{ext.name}</h3>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {ext.isSupported && (
                        <Badge variant="secondary" className="text-[9px] px-1.5 h-4 bg-emerald-500/10 text-emerald-500 border-emerald-500/20 uppercase font-black tracking-tighter">
                          Supported
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-[10px] px-2 h-4 bg-primary/10 text-primary border-primary/20 uppercase font-bold">
                        {ext.lang}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5 opacity-50 truncate">{ext.pkg}</p>
                  <Button
                    className="mt-3 h-8 text-xs gap-1.5 w-full bg-primary hover:bg-primary/90"
                    onClick={(e) => {
                      e.stopPropagation()
                      setActiveAnimePkg(ext.pkg)
                    }}
                  >
                    Browse Anime
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  // ── Anime browsing view ───────────────────────────────────────────────────────
  return (
    <div className="p-6 w-full max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => {
            setActiveAnimePkg(null)
            setSearchQuery('')
            setDebouncedSearch('')
            setActiveFeed('popular')
          }}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              {metadata?.name || 'Anime Source'}
            </h1>
            {metadata?.baseUrl && (
              <p className="text-xs text-primary font-medium hover:underline cursor-pointer">
                <a href={metadata.baseUrl} target="_blank" rel="noreferrer">{metadata.baseUrl}</a>
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Feed tabs */}
          <div className="flex bg-secondary/30 p-1 rounded-lg border border-border overflow-hidden">
            {(['popular', 'latest', 'search'] as const).map(feed => (
              <button
                key={feed}
                onClick={() => { setActiveFeed(feed); if (feed !== 'search') setSearchQuery('') }}
                className={cn(
                  'px-4 py-1.5 rounded-md text-sm font-medium transition-all capitalize',
                  activeFeed === feed
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                )}
              >
                {feedLabels[feed] || feed}
              </button>
            ))}
          </div>

          {/* Display mode toggle */}
          <div className="flex bg-secondary/30 p-1 rounded-lg border border-border">
            <Button variant="ghost" size="sm"
              onClick={() => setDisplayMode('grid')}
              className={cn('p-1.5 h-8 w-8 rounded-md transition-all', displayMode === 'grid' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm"
              onClick={() => setDisplayMode('list')}
              className={cn('p-1.5 h-8 w-8 rounded-md transition-all', displayMode === 'list' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative group">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
        <Input
          className="pl-9 bg-card/50 border-border/50 focus:border-primary/50 transition-all"
          placeholder="Search anime..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>

      {/* Loading */}
      {loading && mangaList.length === 0 && (
        <MediaGrid className="pr-2">
          {Array.from({ length: 15 }).map((_, i) => (
            <MediaCardSkeleton key={i} />
          ))}
        </MediaGrid>
      )}

      {/* Error */}
      {error && mangaList.length === 0 && (
        <ErrorState
          title="Fetch Error"
          message={error}
          onRetry={refresh}
          onWebView={() => metadata?.baseUrl && DataService.openInternalBrowser(metadata.baseUrl)}
          onReport={() => window.api.openExternal('https://github.com/anasx07/AutaKimi-Release/issues/new')}
          details={{ source: metadata?.name || activeAnimePkg, ext: activeAnimePkg, err: error }}
        />
      )}

      {/* Grid / List */}
      {mangaList.length > 0 && (
        <div className="space-y-6">
          {displayMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 items-start content-start">
              {mangaList.map((anime, idx) => (
                <Card
                  key={anime.id}
                  onClick={() => setSelectedManga({ ...anime, pkg: activeAnimePkg! })}
                  className={cn(
                    'group relative cursor-pointer hover:border-primary/40 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 bg-card/40 border-border/40 overflow-hidden',
                    'animate-in fade-in slide-in-from-bottom-4'
                  )}
                  style={{ animationDelay: `${idx * 40}ms` }}
                >
                  <div className="aspect-[3/4] bg-secondary/30 relative overflow-hidden">
                    {anime.coverUrl ? (
                      <img
                        src={anime.coverUrl}
                        alt={anime.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Play className="h-12 w-12 text-primary/30" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3">
                      <p className="text-[11px] text-white/80 line-clamp-3 leading-relaxed">{anime.description}</p>
                    </div>
                    {/* Play overlay button */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="w-12 h-12 rounded-full bg-primary/80 flex items-center justify-center shadow-lg">
                        <Play className="h-5 w-5 text-white ml-0.5" />
                      </div>
                    </div>
                  </div>
                  <div className="p-3 space-y-1">
                    <h3 className="font-bold text-sm line-clamp-2 group-hover:text-primary transition-colors leading-snug" dir="auto">
                      {anime.title}
                    </h3>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] text-muted-foreground opacity-70 truncate" dir="auto">
                        {anime.status?.split(' • ')[0]}
                      </span>
                      {anime.status?.includes(' • ') && (
                        <Badge variant="outline" className="h-4 text-[8px] px-1 border-primary/30 text-primary shrink-0">
                          {anime.status.split(' • ')[1]}
                        </Badge>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {mangaList.map((anime, idx) => (
                <Card
                  key={anime.id}
                  onClick={() => setSelectedManga({ ...anime, pkg: activeAnimePkg! })}
                  className={cn(
                    'group flex gap-4 p-3 cursor-pointer hover:bg-secondary/30 transition-all duration-300 border-border/40 hover:shadow-lg',
                    'animate-in fade-in slide-in-from-left-4'
                  )}
                  style={{ animationDelay: `${idx * 25}ms` }}
                >
                  <div className="w-16 h-24 shrink-0 bg-secondary/30 rounded-lg overflow-hidden border border-border/50 shadow-sm relative">
                    {anime.coverUrl ? (
                      <img src={anime.coverUrl} alt={anime.title} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Play className="h-5 w-5 text-primary/30" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center py-1 gap-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-base line-clamp-1 group-hover:text-primary transition-colors" dir="auto">
                        {anime.title}
                      </h3>
                      <Badge variant="secondary" className="shrink-0 text-[10px] h-5 px-2 bg-primary/10 text-primary border-primary/20 uppercase tracking-wider">
                        {anime.status?.[0] || 'TV'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed opacity-80" dir="auto">
                      {anime.description || anime.status}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Infinite scroll sentinel */}
          <div ref={lastElementRef} className="pb-20 flex flex-col items-center justify-center">
            {loading && hasMore && (
              <div className="flex flex-col items-center gap-3 py-10">
                <Loader2 className="h-6 w-6 animate-spin text-primary opacity-50" />
                <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold animate-pulse">Loading More</span>
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
