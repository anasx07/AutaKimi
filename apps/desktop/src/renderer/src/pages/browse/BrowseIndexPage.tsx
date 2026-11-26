import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BookOpen,
  Film,
  Play,
  Compass,
  Package,
  Search,
  RefreshCw,
  Globe,
  Pin,
  ExternalLink,
  X,
  Plus,
  Trash2
} from 'lucide-react'
import { useExtensionStore, useSettingsStore } from '@renderer/shared/model'
import { DataService } from '@renderer/shared/api'
import { Button, Input, Card, Badge, MobilePage } from '@renderer/shared/ui'
import { cn } from '@renderer/shared/lib/utils'
import { isAnimeExtension } from '@renderer/shared/lib/constants'
import {
  useExtensionsCatalog,
  useExtensionUpdates
} from '@renderer/entities/extension/api/useExtensionQueries'
import ExtensionsPage from '@renderer/pages/extensions/ExtensionsPage'
import GlobalSearch from '@renderer/widgets/global-search/GlobalSearch'
import RepositoriesPage from '@renderer/pages/repositories/RepositoriesPage'
import { isFullySupported } from '@renderer/shared/api/sources'
import { extractBasePkg, getRepoMeta } from '@common/services/repoIdentity'

export default function BrowseIndexPage(): React.JSX.Element {
  const navigate = useNavigate()
  const {
    browseMediaType,
    setBrowseMediaType,
    browseSection,
    setBrowseSection,
    selectedLangs = ['all']
  } = useSettingsStore()

  const { installedExtensions, pinnedExtensions, togglePin, uninstallExtension } =
    useExtensionStore()
  const { refetch: refreshCatalog, isRefetching } = useExtensionsCatalog()
  const { data: updates = [] } = useExtensionUpdates()

  const [sourceSearch, setSourceSearch] = useState('')
  const [isGlobalSearchActive, setIsGlobalSearchActive] = useState(false)
  const [repoCount, setRepoCount] = useState<number>(0)
  const [pluginUpdatesCount, setPluginUpdatesCount] = useState<number>(0)

  React.useEffect(() => {
    DataService.sources
      .getRepos()
      .then((res) => {
        setRepoCount(Array.isArray(res) ? res.length : 0)
      })
      .catch(() => {})

    DataService.plugins
      .getAll()
      .then((data) => {
        if (Array.isArray(data)) {
          const updates = data.filter((p: any) => p.installed && p.updateAvailable).length
          setPluginUpdatesCount(updates)
        }
      })
      .catch(() => {})
  }, [browseSection])

  // Installed counts for badges
  const mangaInstalled = useMemo(
    () => (installedExtensions || []).filter((ext) => !isAnimeExtension(ext)),
    [installedExtensions]
  )

  const animeInstalled = useMemo(
    () => (installedExtensions || []).filter((ext) => isAnimeExtension(ext)),
    [installedExtensions]
  )

  const activeInstalledSources = browseMediaType === 'manga' ? mangaInstalled : animeInstalled

  // Updates counts
  const mediaUpdates = useMemo(() => {
    return (updates || []).filter((ext) =>
      browseMediaType === 'anime' ? isAnimeExtension(ext) : !isAnimeExtension(ext)
    )
  }, [updates, browseMediaType])

  // Filtered sources for the sources view (unified for manga and anime)
  const filteredSources = useMemo(() => {
    let list = [...activeInstalledSources]

    if (sourceSearch.trim()) {
      const q = sourceSearch.toLowerCase()
      list = list.filter(
        (ext) =>
          (ext.name && ext.name.toLowerCase().includes(q)) ||
          (ext.pkg && ext.pkg.toLowerCase().includes(q)) ||
          (ext.lang && ext.lang.toLowerCase().includes(q))
      )
    }

    const activeLangs =
      Array.isArray(selectedLangs) && selectedLangs.length > 0 ? selectedLangs : ['all']
    if (!activeLangs.includes('all')) {
      list = list.filter((ext) => ext && ext.lang && activeLangs.includes(ext.lang))
    }

    return list.sort((a, b) => {
      const aPinned = (pinnedExtensions || []).includes(a.pkg)
      const bPinned = (pinnedExtensions || []).includes(b.pkg)
      if (aPinned && !bPinned) return -1
      if (!aPinned && bPinned) return 1
      return (a.name || '').localeCompare(b.name || '')
    })
  }, [activeInstalledSources, sourceSearch, selectedLangs, pinnedExtensions])

  return (
    <MobilePage
      scrollable={false}
      title="Browse"
      subtitle={
        browseSection === 'sources'
          ? `${activeInstalledSources.length} ${browseMediaType === 'manga' ? 'Manga' : 'Anime'} sources installed`
          : browseSection === 'extensions'
            ? `${browseMediaType === 'manga' ? 'Manga' : 'Anime'} Extensions Catalog & Updates`
            : 'Community Repositories & System Plugins'
      }
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={isRefetching}
            onClick={async () => {
              try {
                await DataService.sources.refreshAll()
              } catch {}
              refreshCatalog()
            }}
            className="h-10 w-10 p-0 rounded-xl hover:bg-secondary transition-all"
            title="Refresh Catalog"
          >
            <RefreshCw
              className={cn('h-4 w-4 text-muted-foreground', isRefetching && 'animate-spin')}
            />
          </Button>
        </div>
      }
      headerExtra={
        <div className="space-y-3">
          {/* Top Switcher: Media Type (Manga vs Anime) & Section (Sources vs Extensions vs Repositories) */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* 1. Media Type Switcher (Active for Sources and Extensions) */}
            {browseSection !== 'repositories' ? (
              <div className="flex bg-secondary/60 p-1 rounded-lg border border-border shrink-0">
                <button
                  type="button"
                  onClick={() => setBrowseMediaType('manga')}
                  className={cn(
                    'flex items-center justify-center gap-2 py-1.5 px-4 rounded-md text-xs font-medium transition-colors',
                    browseMediaType === 'manga'
                      ? 'bg-card text-foreground shadow-sm border border-border font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <BookOpen className={cn('h-3.5 w-3.5', browseMediaType === 'manga' && 'text-primary')} />
                  <span>Manga</span>
                  <Badge
                    variant={browseMediaType === 'manga' ? 'default' : 'secondary'}
                    className="h-4 px-1.5 text-[10px]"
                  >
                    {mangaInstalled.length}
                  </Badge>
                </button>

                <button
                  type="button"
                  onClick={() => setBrowseMediaType('anime')}
                  className={cn(
                    'flex items-center justify-center gap-2 py-1.5 px-4 rounded-md text-xs font-medium transition-colors',
                    browseMediaType === 'anime'
                      ? 'bg-card text-foreground shadow-sm border border-border font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Film className={cn('h-3.5 w-3.5', browseMediaType === 'anime' && 'text-primary')} />
                  <span>Anime</span>
                  <Badge
                    variant={browseMediaType === 'anime' ? 'default' : 'secondary'}
                    className="h-4 px-1.5 text-[10px]"
                  >
                    {animeInstalled.length}
                  </Badge>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-muted-foreground bg-secondary/40 rounded-lg border border-border w-fit">
                <Globe className="h-3.5 w-3.5 text-primary" />
                <span>Ecosystem Repositories & System Plugins</span>
              </div>
            )}

            {/* 2. Section Switcher (Sources vs Extensions vs Repositories) */}
            <div className="flex bg-secondary/60 p-1 rounded-lg border border-border shrink-0">
              <button
                type="button"
                onClick={() => setBrowseSection('sources')}
                className={cn(
                  'flex items-center justify-center gap-1.5 py-1.5 px-3.5 rounded-md text-xs font-medium transition-colors',
                  browseSection === 'sources'
                    ? 'bg-card text-foreground shadow-sm border border-border font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Compass className={cn('h-3.5 w-3.5', browseSection === 'sources' && 'text-primary')} />
                <span>Sources</span>
              </button>

              <button
                type="button"
                onClick={() => setBrowseSection('extensions')}
                className={cn(
                  'flex items-center justify-center gap-1.5 py-1.5 px-3.5 rounded-md text-xs font-medium transition-colors relative',
                  browseSection === 'extensions'
                    ? 'bg-card text-foreground shadow-sm border border-border font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Package className={cn('h-3.5 w-3.5', browseSection === 'extensions' && 'text-primary')} />
                <span>Extensions</span>
                {mediaUpdates.length > 0 && (
                  <Badge
                    variant="default"
                    className="h-4 min-w-[16px] px-1 text-[10px] bg-primary"
                  >
                    {mediaUpdates.length}
                  </Badge>
                )}
              </button>

              <button
                type="button"
                onClick={() => setBrowseSection('repositories')}
                className={cn(
                  'flex items-center justify-center gap-1.5 py-1.5 px-3.5 rounded-md text-xs font-medium transition-colors relative',
                  browseSection === 'repositories'
                    ? 'bg-card text-foreground shadow-sm border border-border font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Globe className={cn('h-3.5 w-3.5', browseSection === 'repositories' && 'text-primary')} />
                <span>Repositories</span>
                {pluginUpdatesCount > 0 ? (
                  <span className="h-4 px-1.5 text-[10px] rounded-full bg-amber-500 text-black font-semibold flex items-center justify-center">
                    {pluginUpdatesCount} {pluginUpdatesCount === 1 ? 'update' : 'updates'}
                  </span>
                ) : (
                  <Badge
                    variant={browseSection === 'repositories' ? 'default' : 'secondary'}
                    className="h-4 px-1.5 text-[10px]"
                  >
                    {repoCount}
                  </Badge>
                )}
              </button>
            </div>
          </div>
        </div>
      }
    >
      <div className="flex-1 min-h-0 flex flex-col">
        {browseSection === 'sources' ? (
          /* Unified Sources View (Manga & Anime) */
          <div className="flex-1 min-h-0 flex flex-col space-y-4">
            {/* Quick search & Global Search Toolbar */}
            {activeInstalledSources.length > 0 && (
              <div className="flex items-center gap-2.5 max-w-xl">
                <div className="relative flex-1 group">
                  <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    className="pl-10 pr-9 h-11 bg-card/40 border-border/40 focus:border-primary/50 rounded-xl text-sm"
                    placeholder={`Search your ${browseMediaType} sources...`}
                    value={sourceSearch}
                    onChange={(e) => {
                      setSourceSearch(e.target.value)
                      if (isGlobalSearchActive) setIsGlobalSearchActive(false)
                    }}
                  />
                  {sourceSearch && (
                    <button
                      onClick={() => setSourceSearch('')}
                      className="absolute right-3 top-3 p-1 hover:bg-secondary rounded-md text-muted-foreground hover:text-foreground transition-all"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <Button
                  variant={isGlobalSearchActive ? 'primary' : 'outline'}
                  onClick={() => setIsGlobalSearchActive(!isGlobalSearchActive)}
                  className={cn(
                    'h-11 px-4 rounded-xl border-border/40 gap-2 shrink-0 font-bold text-xs transition-all',
                    isGlobalSearchActive
                      ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                      : 'bg-card/40 hover:bg-secondary/40 text-foreground'
                  )}
                  title={
                    isGlobalSearchActive
                      ? 'Exit Global Search'
                      : `Search ${browseMediaType} across all sources`
                  }
                >
                  <Globe className="h-4 w-4" />
                  <span className="hidden sm:inline">Global Search</span>
                </Button>
              </div>
            )}

            {/* Main Content Area */}
            {isGlobalSearchActive ? (
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <GlobalSearch
                  mediaType={browseMediaType}
                  onClose={() => setIsGlobalSearchActive(false)}
                />
              </div>
            ) : activeInstalledSources.length === 0 ? (
              repoCount === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 animate-in fade-in duration-500">
                  <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center ring-2 ring-primary/20">
                    <Globe className="h-10 w-10 text-primary" />
                  </div>
                  <div className="space-y-1.5 max-w-sm">
                    <h3 className="text-xl font-bold tracking-tight">Welcome to AutaKimi</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      To discover and install thousands of community manga & anime sources, start by
                      configuring your repositories.
                    </p>
                  </div>
                  <Button
                    onClick={() => setBrowseSection('repositories')}
                    className="rounded-xl px-6 bg-primary font-bold gap-2 shadow-lg shadow-primary/20"
                  >
                    <Plus className="h-4 w-4" />
                    Configure Repositories
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                  <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center ring-2 ring-primary/20">
                    {browseMediaType === 'anime' ? (
                      <Film className="h-10 w-10 text-primary" />
                    ) : (
                      <BookOpen className="h-10 w-10 text-primary" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold tracking-tight">
                      No {browseMediaType === 'anime' ? 'Anime' : 'Manga'} Sources Installed
                    </h3>
                    <p className="text-sm text-muted-foreground max-w-xs">
                      Install your favorite sources from the Extensions tab to start browsing{' '}
                      {browseMediaType}.
                    </p>
                  </div>
                  <Button
                    onClick={() => setBrowseSection('extensions')}
                    className="rounded-xl px-6 bg-primary font-bold"
                  >
                    Browse {browseMediaType === 'anime' ? 'Anime' : 'Manga'} Extensions
                  </Button>
                </div>
              )
            ) : filteredSources.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                <p className="text-sm text-muted-foreground">
                  No sources match &quot;{sourceSearch}&quot;
                </p>
                <Button variant="outline" size="sm" onClick={() => setSourceSearch('')}>
                  Clear Search
                </Button>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 pb-10">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pb-10">
                  {filteredSources.map((ext) => {
                    const isPinned = (pinnedExtensions || []).includes(ext.pkg)
                    const isSupported = isFullySupported(ext)
                    const iconUrl =
                      (typeof ext.icon === 'string' && ext.icon.startsWith('http')
                        ? ext.icon
                        : null) || DataService.getExtensionIcon(extractBasePkg(ext.pkg || ''))
                    const hasRepo =
                      !!ext.repoUrl && ext.repoUrl !== 'remote' && ext.repoUrl !== 'local'
                    const repoMeta = hasRepo ? getRepoMeta(ext.repoUrl, ext.repoName) : null
                    const repoColor = ext.repoColor || repoMeta?.repoColor
                    const repoName = ext.repoName || repoMeta?.repoName
                    return (
                      <Card
                        key={ext.pkg}
                        style={
                          repoColor ? { borderLeftWidth: 3, borderLeftColor: repoColor } : undefined
                        }
                        className="group p-4 bg-card hover:bg-secondary/30 hover:border-primary/40 transition-colors duration-150 border-border cursor-pointer rounded-xl"
                        onClick={() => navigate(`/browse/${ext.pkg}`)}
                      >
                        <div className="flex items-start gap-3.5">
                          <div className="w-12 h-12 rounded-xl bg-secondary/60 flex items-center justify-center border border-border overflow-hidden shrink-0">
                            <img
                              src={iconUrl}
                              alt={ext.name}
                              className="w-full h-full object-contain p-1"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none'
                                const fb = e.currentTarget.parentElement?.querySelector('.fb-icon')
                                if (fb) (fb as HTMLElement).style.display = 'flex'
                              }}
                            />
                            <div className="fb-icon hidden w-full h-full items-center justify-center">
                              {browseMediaType === 'anime' ? (
                                <Play className="h-6 w-6 text-primary" />
                              ) : (
                                <BookOpen className="h-6 w-6 text-primary" />
                              )}
                            </div>
                          </div>

                          <div className="flex-1 min-w-0 pt-0.5">
                            <div className="flex items-center justify-between gap-2">
                              <h3 className="font-bold text-base truncate group-hover:text-primary transition-colors">
                                {ext.name}
                              </h3>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {isSupported ? (
                                  <Badge
                                    variant="secondary"
                                    className="text-[9px] px-1.5 h-4 bg-emerald-500/10 text-emerald-500 border-emerald-500/20 uppercase font-black tracking-tighter"
                                  >
                                    Supported
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="secondary"
                                    className="text-[9px] px-1.5 h-4 bg-amber-500/10 text-amber-500/80 border-amber-500/20 uppercase font-bold tracking-tighter opacity-70"
                                  >
                                    WIP
                                  </Badge>
                                )}
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] px-2 h-4 bg-primary/10 text-primary border-primary/20 uppercase font-bold"
                                >
                                  {ext.lang?.toUpperCase() || 'EN'}
                                </Badge>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                              {repoName && repoColor && (
                                <Badge
                                  variant="outline"
                                  style={{
                                    backgroundColor: `${repoColor}1a`,
                                    color: repoColor,
                                    borderColor: `${repoColor}40`
                                  }}
                                  className="text-[9px] h-4 px-1.5 font-bold shrink-0"
                                >
                                  {repoName}
                                </Badge>
                              )}
                              <p className="text-xs text-muted-foreground font-mono opacity-50 truncate">
                                {extractBasePkg(ext.pkg)}
                              </p>
                            </div>
                            <div className="mt-3 flex items-center gap-1.5">
                              <Button
                                className="h-8 text-xs gap-1.5 flex-1 bg-primary hover:bg-primary/90 font-bold rounded-xl"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  navigate(`/browse/${ext.pkg}`)
                                }}
                              >
                                {browseMediaType === 'anime' ? 'Watch Anime' : 'Read Manga'}
                                <ExternalLink className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className={cn(
                                  'h-8 w-8 rounded-xl transition-colors shrink-0',
                                  isPinned
                                    ? 'text-primary bg-primary/10 hover:bg-primary/20'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                                )}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  togglePin(ext.pkg)
                                }}
                                title={isPinned ? 'Unpin source' : 'Pin source to top'}
                              >
                                <Pin className={cn('h-4 w-4', isPinned && 'fill-primary')} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (
                                    window.confirm(
                                      `Are you sure you want to uninstall ${ext.name}?`
                                    )
                                  ) {
                                    uninstallExtension(ext.pkg)
                                  }
                                }}
                                title={`Uninstall ${ext.name}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </Card>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        ) : browseSection === 'extensions' ? (
          /* Extensions View (strictly filtered by Manga or Anime) */
          <div className="flex-1 min-h-0 flex flex-col">
            <ExtensionsPage filterType={browseMediaType} hideHeader />
          </div>
        ) : (
          /* Repositories View */
          <div className="flex-1 min-h-0 flex flex-col overflow-y-auto custom-scrollbar px-1 pt-1">
            <RepositoriesPage
              hideHeader
              onRepoCountChange={setRepoCount}
              onPluginUpdatesCountChange={setPluginUpdatesCount}
            />
          </div>
        )}
      </div>
    </MobilePage>
  )
}
