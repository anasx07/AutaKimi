import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { DataService } from '@renderer/shared/api'
import { Search, BookOpen, Loader2, LayoutGrid, List, X, Filter } from 'lucide-react'
import { useLibraryStore, useExtensionStore, useUIStore } from '@renderer/shared/model'
import { useMangaPagination } from '@renderer/entities/manga/model/useMangaPagination'
import { useExtensionMetadata } from '@renderer/entities/extension/model/useExtensionMetadata'
import { SourceRegistry } from '@renderer/shared/api/sources/SourceRegistry'
import {
  Button,
  Input,
  Card,
  Badge,
  ErrorState,
  MediaGrid,
  MediaGridItem,
  MediaCardSkeleton,
  MobilePage
} from '@renderer/shared/ui'
import { cn } from '@renderer/shared/lib/utils'
import { isMobile } from '@renderer/shared/platform'

export default function BrowsePage(): React.JSX.Element {
  const { pkg } = useParams()
  const navigate = useNavigate()
  const mobile = isMobile()
  const { viewMode, setViewMode } = useUIStore()

  const { setSelectedManga } = useLibraryStore()
  const { activeExtension, setActiveExtension } = useExtensionStore()

  // Sync route param with store
  useEffect(() => {
    if (pkg && pkg !== activeExtension) {
      setActiveExtension(pkg)
    }
  }, [pkg, activeExtension, setActiveExtension])

  // State definitions
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [activeFeed, setActiveFeed] = useState<'popular' | 'latest' | 'search'>('popular')
  const [showFilters, setShowFilters] = useState(false)
  const { metadata } = useExtensionMetadata(activeExtension)
  const { domainOverrides } = useExtensionStore()

  const source = useMemo(() => {
    return pkg ? SourceRegistry.resolveNative(pkg, domainOverrides) : null
  }, [pkg, domainOverrides])

  const sourceFilters = useMemo(() => source?.getFilters?.() || [], [source])
  const [filterValues, setFilterValues] = useState<Record<string, string[]>>({})

  const activeFilterCount = useMemo(() => {
    return Object.values(filterValues).reduce((acc, current) => acc + current.length, 0)
  }, [filterValues])

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
    activeExtension,
    activeFeed,
    debouncedSearch,
    filters: filterValues
  })

  // Debounce search query updates
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      if (searchQuery) setActiveFeed('search')
    }, 500)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const toggleFilter = (groupId: string, optionId: string): void => {
    setFilterValues((prev) => {
      const current = prev[groupId] || []
      const next = current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId]
      return { ...prev, [groupId]: next }
    })
  }

  // Reset filters when extension changes
  useEffect(() => {
    setFilterValues({})
  }, [activeExtension])

  const feedLabels = useMemo(
    () =>
      source?.getFeedLabels?.() || {
        popular: 'Popular',
        latest: 'Latest',
        search: 'Search'
      },
    [source]
  )

  return (
    <MobilePage
      title={metadata?.name || 'Browse Source'}
      subtitle={metadata?.baseUrl}
      onBack={() => navigate('/browse')}
      actions={
        <div className="flex bg-secondary/30 p-0.5 rounded-xl border border-border shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode('grid')}
            className={cn(
              'p-1.5 h-8 w-8 rounded-md transition-all',
              viewMode === 'grid'
                ? 'bg-background shadow-sm text-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode('list')}
            className={cn(
              'p-1.5 h-8 w-8 rounded-md transition-all',
              viewMode === 'list'
                ? 'bg-background shadow-sm text-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      }
      headerExtra={
        <div className="space-y-4">
          {/* Tabs (Feed Selection) */}
          <div className="flex items-center gap-2 p-1.5 bg-secondary/30 rounded-2xl border border-border/50 overflow-x-auto no-scrollbar shadow-inner">
            {(['popular', 'latest', 'search'] as const).map((feed) => (
              <button
                key={feed}
                onClick={() => {
                  setActiveFeed(feed)
                  if (feed !== 'search') {
                    setSearchQuery('')
                    setDebouncedSearch('')
                  }
                }}
                className={cn(
                  'px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all whitespace-nowrap flex-1',
                  activeFeed === feed
                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
                )}
              >
                {feedLabels[feed] || feed}
              </button>
            ))}
          </div>

          <div className={cn('flex gap-3', mobile && 'flex-col')}>
            <div className="relative flex-1 group">
              <Search
                className={cn(
                  'absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors',
                  searchQuery
                    ? 'text-primary'
                    : 'text-muted-foreground group-focus-within:text-primary'
                )}
              />
              <Input
                className="pl-10 pr-10 h-11 bg-card/40 border-border/40 focus:border-primary/50 focus:ring-4 focus:ring-primary/5 transition-all rounded-2xl"
                placeholder={activeFeed === 'search' ? "Search manga..." : "Quick Search..."}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  if (e.target.value && activeFeed !== 'search') setActiveFeed('search')
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('')
                    setDebouncedSearch('')
                    if (activeFeed === 'search') setActiveFeed('popular')
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 hover:bg-secondary/60 rounded-xl text-muted-foreground hover:text-foreground transition-all animate-in zoom-in duration-200"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Button
              variant={showFilters ? 'secondary' : 'outline'}
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                'h-11 px-6 rounded-2xl border-border/40 transition-all flex items-center gap-2.5 font-bold text-xs',
                activeFilterCount > 0 && 'border-primary/50 bg-primary/5 shadow-[0_0_15px_rgba(var(--primary),0.05)]',
                mobile && 'w-full justify-center'
              )}
            >
              <Filter className={cn('h-4 w-4', activeFilterCount > 0 && 'text-primary')} />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <Badge className="ml-1 h-5 min-w-[22px] px-1.5 bg-primary text-primary-foreground text-[10px] font-black rounded-lg border-none animate-in zoom-in">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex-1">
        <div className="space-y-6 pb-6">
          {loading && mangaList.length === 0 && (
            <MediaGrid>
              {Array.from({ length: 15 }).map((_, i) => (
                <MediaCardSkeleton key={i} />
              ))}
            </MediaGrid>
          )}

          {error && mangaList.length === 0 && (
            <ErrorState
              title={
                error.includes('400') || error.includes('403')
                  ? 'Cloudflare / Network Error'
                  : 'Fetch Error'
              }
              message={error}
              onRetry={refresh}
              onWebView={() =>
                metadata?.baseUrl && DataService.openInternalBrowser(metadata.baseUrl)
              }
              onReport={() =>
                DataService.openExternal('https://github.com/anasx07/AutaKimi-Release/issues/new')
              }
              details={{
                source: metadata?.name || activeExtension,
                ext: activeExtension,
                err: error
              }}
            />
          )}

          {mangaList.length > 0 && (
            <div className="space-y-6">
              {viewMode === 'grid' ? (
                <MediaGrid>
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
                        <Badge
                          variant="outline"
                          className="h-4 text-[8px] px-1 border-border/50 uppercase"
                        >
                          Manga
                        </Badge>
                      }
                    />
                  ))}
                </MediaGrid>
              ) : (
                <div className="space-y-3">
                  {mangaList.map((manga, idx) => (
                    <Card
                      key={manga.id}
                      onClick={() => setSelectedManga(manga)}
                      className={cn(
                        'group flex gap-4 p-3 cursor-pointer hover:bg-secondary/30 transition-all duration-300 border-border/40 hover:shadow-lg',
                        'animate-in fade-in slide-in-from-left-4'
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
                          <h3 className="font-bold text-lg line-clamp-1 group-hover:text-primary transition-colors">
                            {manga.title}
                          </h3>
                          <Badge
                            variant="secondary"
                            className="shrink-0 flex items-center gap-1.5 text-[10px] h-5 px-2 bg-primary/10 text-primary border-primary/20 uppercase tracking-wider"
                          >
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

              <div ref={lastElementRef} className="pb-10 flex flex-col items-center justify-center">
                {loading && hasMore && (
                  <div className="flex flex-col items-center gap-3 py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-primary opacity-50" />
                    <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold animate-pulse">
                      Loading Content
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
                      DataService.openExternal('https://github.com/anasx07/AutaKimi-Release/issues')
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

      {/* Floating Side Filter Drawer */}
      {showFilters && (
        <>
          <div
            className="fixed inset-0 bg-background/40 backdrop-blur-[2px] z-[60] animate-in fade-in duration-300"
            onClick={() => setShowFilters(false)}
          />
          <div className="fixed right-0 top-0 bottom-0 w-80 bg-card border-l border-border z-[70] p-6 shadow-2xl animate-in slide-in-from-right duration-500 overflow-y-auto no-scrollbar pb-safe">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold tracking-tight">Advanced Filters</h3>
              <button
                onClick={() => setShowFilters(false)}
                className="p-2 hover:bg-secondary rounded-full transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-8">
              {sourceFilters.map((group) => (
                <div key={group.id} className="space-y-4">
                  <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">
                    {group.name}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {group.options.map((option) => {
                      const isSelected = (filterValues[group.id] || []).includes(option.id)
                      return (
                        <Badge
                          key={option.id}
                          variant={isSelected ? 'default' : 'outline'}
                          className={cn(
                            'cursor-pointer px-3 py-1.5 text-xs transition-all border-border/40',
                            isSelected
                              ? 'shadow-md shadow-primary/20'
                              : 'hover:bg-secondary/50 font-medium'
                          )}
                          onClick={() => toggleFilter(group.id, option.id)}
                        >
                          {option.name}
                        </Badge>
                      )
                    })}
                  </div>
                </div>
              ))}

              {sourceFilters.length === 0 && (
                <div className="py-20 flex flex-col items-center justify-center text-center px-4">
                  <div className="w-12 h-12 rounded-full bg-secondary/30 flex items-center justify-center mb-4">
                    <Filter className="h-5 w-5 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">No filters available</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1 uppercase tracking-wider">
                    For this source
                  </p>
                </div>
              )}
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
                  'w-full text-xs font-semibold tracking-wide transition-colors rounded-xl h-11',
                  activeFilterCount > 0
                    ? 'text-destructive hover:bg-destructive/10'
                    : 'text-muted-foreground opacity-50 pointer-events-none'
                )}
                onClick={() => setFilterValues({})}
              >
                Reset All Filters
              </Button>
            </div>
          </div>
        </>
      )}
    </MobilePage>
  )
}
