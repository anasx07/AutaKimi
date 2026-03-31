import { useState, useMemo } from 'react'
import {
  ExternalLink,
  Play,
  Search,
  Loader2,
  Pin,
  PinOff
} from 'lucide-react'
import {
  Button,
  Badge,
  Card,
  Input,
  ErrorState,
  MediaGrid,
  MediaGridItem,
  MediaCardSkeleton,
  MobilePage,
  LayoutSwitcher
} from '@renderer/shared/ui'
import { cn } from '@renderer/shared/lib/utils'
import { useExtensionStore, useUIStore, useLibraryStore } from '@renderer/shared/model'
import { isMobile } from '@renderer/shared/platform'
import { useNavigate } from 'react-router-dom'
import { useExtensionMetadata } from '@renderer/entities/extension/model/useExtensionMetadata'
import { useMangaPagination } from '@renderer/entities/manga/model/useMangaPagination'
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

export default function AnimePage(): React.JSX.Element {
  const mobile = isMobile()
  const navigate = useNavigate()
  const { installedExtensions, pinnedAnimeSources, togglePin } = useExtensionStore()
  const { viewMode } = useUIStore()
  const { setSelectedManga } = useLibraryStore()

  const [activeAnimePkg, setActiveAnimePkg] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [activeFeed, setActiveFeed] = useState<'popular' | 'latest' | 'search'>('popular')

  // Display all anime extensions defined in our metadata
  const displayExtensions = useMemo(
    () =>
      (animeExtensions as AnimeExtensionJSON[])
        .map((ae) => {
          const installed = installedExtensions.find((ie) => ie.pkg === ae.pkg)
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

  const activeSource = useMemo(
    () => (activeAnimePkg ? getAnimeSource(activeAnimePkg) : null),
    [activeAnimePkg]
  )

  const feedLabels = useMemo(
    () =>
      activeSource?.getFeedLabels?.() || {
        popular: 'Popular',
        latest: 'Latest',
        search: 'Search'
      },
    [activeSource]
  )

  const { metadata } = useExtensionMetadata(activeAnimePkg)

  const filters = useMemo(
    () => ({
      selectedDemographics: [] as string[],
      selectedStatus: [] as string[],
      selectedTags: [] as string[]
    }),
    []
  )

  const {
    mangaList,
    loading,
    error,
    paginationError,
    hasMore,
    lastElementRef,
    refresh,
    retryPagination
  } = useMangaPagination({
    activeExtension: activeAnimePkg,
    activeFeed,
    debouncedSearch,
    filters
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
      <MobilePage title="Anime (Beta)" subtitle="Video Content Portal">
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

        <div className="space-y-4 mt-10">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/50 ml-1">
            Available Sources
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {displayExtensions.map((ext) => (
              <Card
                key={ext.pkg}
                className="group p-5 bg-card/40 border-border/40 hover:border-primary/30 transition-all duration-300"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center ring-1 ring-primary/10 overflow-hidden">
                    <img
                      src={
                        new URL(`../../app/assets/Animeicon/${ext.pkg}.png`, import.meta.url).href
                      }
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
      </MobilePage>
    )
  }

  // ── Source selector (no source selected yet) ─────────────────────────────────
  if (!activeAnimePkg) {
    return (
      <MobilePage
        title="Anime (Beta)"
        subtitle="Select a source to browse contents"
        onBack={mobile ? () => navigate('/more') : undefined}
      >
        <div className="flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pb-10">
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
                          return new URL(`../../app/assets/Animeicon/${ext.pkg}.png`, import.meta.url)
                            .href
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
                        'absolute top-0 right-0 h-6 w-6 rounded-bl-xl rounded-tr-none bg-black/40 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all hover:bg-primary/80 hover:text-white z-10',
                        pinnedAnimeSources.includes(ext.pkg) &&
                          'opacity-100 text-primary bg-primary/20'
                      )}
                      onClick={(e) => {
                        e.stopPropagation()
                        togglePin(ext.pkg)
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
                      <h3 className="font-bold text-base truncate group-hover:text-primary transition-colors">
                        {ext.name}
                      </h3>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {ext.isSupported && (
                          <Badge
                            variant="secondary"
                            className="text-[9px] px-1.5 h-4 bg-emerald-500/10 text-emerald-500 border-emerald-500/20 uppercase font-black tracking-tighter"
                          >
                            Supported
                          </Badge>
                        )}
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-2 h-4 bg-primary/10 text-primary border-primary/20 uppercase font-bold"
                        >
                          {ext.lang}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5 opacity-50 truncate">
                      {ext.pkg}
                    </p>
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
      </MobilePage>
    )
  }

  // ── Anime browsing view ───────────────────────────────────────────────────────
  return (
    <MobilePage
      title={metadata?.name || 'Anime Source'}
      subtitle={metadata?.baseUrl}
      onBack={() => {
        setActiveAnimePkg(null)
        setSearchQuery('')
        setDebouncedSearch('')
        setActiveFeed('popular')
      }}
      actions={<LayoutSwitcher />}
      headerExtra={
        <div className="space-y-3">
          {/* Tabs (Feed Selection) */}
          <div className="flex items-center gap-2 p-1 bg-secondary/30 rounded-xl border border-border/50 overflow-x-auto no-scrollbar">
            {(['popular', 'latest', 'search'] as const).map((feed) => (
              <button
                key={feed}
                onClick={() => {
                  setActiveFeed(feed)
                  if (feed !== 'search') setSearchQuery('')
                }}
                className={cn(
                  'px-4 py-1.5 rounded-lg text-xs font-bold transition-all capitalize whitespace-nowrap flex-1',
                  activeFeed === feed
                    ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                )}
              >
                {feedLabels[feed] || feed}
              </button>
            ))}
          </div>

          {/* Search Row (Conditional) */}
          {activeFeed === 'search' && (
            <div className="animate-in slide-in-from-top-2 duration-300">
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  placeholder="Search series..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10 h-10 bg-secondary/40 border-border/40 focus:border-primary/50 focus:ring-primary/20 rounded-xl"
                />
              </div>
            </div>
          )}
        </div>
      }
    >
      <div className="flex-1 min-h-0">
        <div className="space-y-6 pb-10">
          {/* Loading Skeleton */}
          {loading && mangaList.length === 0 && (
            <MediaGrid>
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
              onReport={() =>
                window.api.openExternal('https://github.com/anasx07/AutaKimi-Release/issues/new')
              }
              details={{
                source: metadata?.name || activeAnimePkg || 'unknown',
                ext: activeAnimePkg || undefined,
                err: error
              }}
            />
          )}

          {mangaList.length > 0 && (
            <div className="space-y-6">
              {viewMode === 'grid' ? (
                <MediaGrid>
                  {mangaList.map((anime, idx) => (
                    <MediaGridItem
                      key={anime.id}
                      title={anime.title}
                      coverUrl={anime.coverUrl}
                      mediaType="anime"
                      description={anime.description}
                      index={idx}
                      onClick={() => setSelectedManga({ ...anime, pkg: activeAnimePkg! })}
                      badge={
                        <div className="flex items-center gap-1.5 overflow-hidden">
                          <span dir="auto">{anime.status?.split(' • ')[0] || anime.status}</span>
                          {anime.status?.includes(' • ') && <span className="opacity-40">•</span>}
                          <span dir="auto" className="text-secondary-foreground font-black">
                            {anime.status?.split(' • ')[1]}
                          </span>
                        </div>
                      }
                    />
                  ))}
                </MediaGrid>
              ) : (
                <div className="space-y-4">
                  {mangaList.map((anime, idx) => (
                    <Card
                      key={anime.id}
                      onClick={() => setSelectedManga({ ...anime, pkg: activeAnimePkg! })}
                      className={cn(
                        'group flex gap-4 p-4 cursor-pointer hover:bg-secondary/30 transition-all duration-300 border-border/40 hover:shadow-xl rounded-2xl',
                        'animate-in fade-in slide-in-from-left-4'
                      )}
                      style={{ animationDelay: `${idx * 25}ms` }}
                    >
                      <div className="w-20 h-28 shrink-0 bg-secondary/30 rounded-xl overflow-hidden border border-border/50 shadow-sm relative group-hover:scale-105 transition-transform">
                        {anime.coverUrl ? (
                          <img
                            src={anime.coverUrl}
                            alt={anime.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Play className="h-6 w-6 text-primary/30" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col justify-center gap-2">
                        <div className="flex items-start justify-between gap-2">
                          <h3
                            className="font-bold text-lg line-clamp-1 group-hover:text-primary transition-colors"
                            dir="auto"
                          >
                            {anime.title}
                          </h3>
                          <Badge
                            variant="secondary"
                            className="shrink-0 text-[10px] h-5 px-2 bg-primary/10 text-primary border-primary/20 uppercase font-black"
                          >
                            {anime.status?.[0] || 'TV'}
                          </Badge>
                        </div>
                        <p
                          className="text-xs text-muted-foreground line-clamp-2 leading-relaxed opacity-70 group-hover:opacity-100 transition-opacity"
                          dir="auto"
                        >
                          {anime.description || anime.status}
                        </p>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {/* Infinite scroll sentinel */}
              <div ref={lastElementRef} className="pb-10 flex flex-col items-center justify-center">
                {loading && hasMore && (
                  <div className="flex flex-col items-center gap-3 py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-primary opacity-50" />
                    <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold animate-pulse">
                      Loading More
                    </span>
                  </div>
                )}
                {paginationError && (
                  <ErrorState
                    className="py-10 border-t border-border/20 w-full"
                    title="Pagination Failed"
                    message={paginationError}
                    onRetry={retryPagination}
                    onWebView={() =>
                      metadata?.baseUrl && DataService.openInternalBrowser(metadata.baseUrl)
                    }
                    onReport={() =>
                      window.api.openExternal('https://github.com/anasx07/AutaKimi-Release/issues')
                    }
                  />
                )}
                {!hasMore && !paginationError && mangaList.length > 0 && (
                  <div className="flex items-center gap-4 w-full py-10">
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent to-border/50" />
                    <p className="text-[10px] text-muted-foreground/40 font-bold uppercase tracking-[0.3em]">
                      End of results
                    </p>
                    <div className="h-px flex-1 bg-gradient-to-l from-transparent to-border/50" />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </MobilePage>
  )
}
