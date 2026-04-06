import { forwardRef, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Package,
  Globe,
  Star,
  RefreshCw,
  Loader2,
  Check,
  ChevronDown,
  ShieldCheck,
  ShieldAlert,
  ArrowUpDown,
  X,
  Search as SearchIcon
} from 'lucide-react'
import GlobalSearch from '@renderer/widgets/global-search/GlobalSearch'
import { useExtensionStore, ExtensionMetadata } from '@renderer/shared/model'
import { DataService } from '@renderer/shared/api'
import { Button, Input, Card, Badge, MobilePage, Sheet, Checkbox } from '@renderer/shared/ui'
import { cn } from '@renderer/shared/lib/utils'
import { getFlagEmoji, LANGUAGE_NAMES } from '@renderer/shared/lib/constants'
import { isMobile } from '@renderer/shared/platform'
import { VirtuosoGrid } from 'react-virtuoso'
import { motion, AnimatePresence } from 'framer-motion'
import {
  useExtensionsCatalog,
  useExtensionUpdates,
  useInstallExtension,
  useBulkUpdate
} from '@renderer/entities/extension/api/useExtensionQueries'

const ANIME_SOURCE_PKGS = ['en.allanime', 'en.gogoanime', 'ar.anime4up', 'ar.witanime']

const isFullySupported = (pkg: string): boolean => {
  return pkg.startsWith('en.') || pkg.startsWith('ar.') || pkg.startsWith('es.')
}

export default function ExtensionsPage(): React.JSX.Element {
  const navigate = useNavigate()
  const mobile = isMobile()
  const {
    installedExtensions,
    pinnedExtensions,
    togglePin,
    uninstallExtension,
    extensionSortBy,
    extensionSortOrder,
    setExtensionSortOrder,
    installingPkgs,
    setActiveExtension
  } = useExtensionStore()

  // --- React Query Data ---
  const {
    data: catalog = [],
    isLoading: catalogLoading,
    refetch: refreshCatalog,
    isRefetching
  } = useExtensionsCatalog()
  const { data: updates = [] } = useExtensionUpdates()
  const installMutation = useInstallExtension()
  const bulkUpdateMutation = useBulkUpdate()

  // --- UI State ---
  const [activeSubTab, setActiveSubTab] = useState<'catalog' | 'installed' | 'updates' | 'global'>(
    'installed'
  )
  const [selectedLangs, setSelectedLangs] = useState<string[]>(['all'])
  const [isLangModalOpen, setIsLangModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showNsfw, setShowNsfw] = useState(false)

  const toggleLang = (lang: string): void => {
    if (lang === 'all') {
      setSelectedLangs(['all'])
    } else {
      const next = selectedLangs.includes('all')
        ? [lang]
        : selectedLangs.includes(lang)
          ? selectedLangs.filter((l) => l !== lang)
          : [...selectedLangs, lang]
      setSelectedLangs(next.length === 0 ? ['all'] : next)
    }
  }

  // --- Filtering Logic ---
  const baseFiltered = useMemo(() => {
    let sourceSet: ExtensionMetadata[] = []
    if (activeSubTab === 'catalog') sourceSet = catalog
    else if (activeSubTab === 'installed') sourceSet = installedExtensions
    else if (activeSubTab === 'updates') sourceSet = updates

    let filtered = sourceSet
      .filter((ext) => !ANIME_SOURCE_PKGS.includes(ext.pkg))
      .filter((ext) => {
        if (!searchQuery) return true
        const lowQuery = searchQuery.toLowerCase()
        return ext.name.toLowerCase().includes(lowQuery) || ext.pkg.toLowerCase().includes(lowQuery)
      })
      .filter((ext) => showNsfw || !ext.nsfw)

    if (!selectedLangs.includes('all')) {
      filtered = filtered.filter((ext) => selectedLangs.includes(ext.lang))
    }

    return filtered
  }, [activeSubTab, catalog, installedExtensions, updates, searchQuery, showNsfw, selectedLangs])

  const filteredData = useMemo(() => {
    return baseFiltered.sort((a, b) => {
      if (activeSubTab === 'installed') {
        const aPinned = pinnedExtensions.includes(a.pkg)
        const bPinned = pinnedExtensions.includes(b.pkg)
        if (aPinned && !bPinned) return -1
        if (!aPinned && bPinned) return 1
      }

      if (extensionSortBy === 'supported') {
        const aSupp = isFullySupported(a.pkg) ? 1 : 0
        const bSupp = isFullySupported(b.pkg) ? 1 : 0
        if (aSupp !== bSupp) return extensionSortOrder === 'asc' ? bSupp - aSupp : aSupp - bSupp
      }

      if (extensionSortBy === 'installed') {
        const aInst = installedExtensions.some((i) => i.pkg === a.pkg) ? 1 : 0
        const bInst = installedExtensions.some((i) => i.pkg === b.pkg) ? 1 : 0
        if (aInst !== bInst) return extensionSortOrder === 'asc' ? bInst - aInst : aInst - bInst
      }

      return extensionSortOrder === 'asc'
        ? a.name.localeCompare(b.name)
        : b.name.localeCompare(a.name)
    })
  }, [
    baseFiltered,
    activeSubTab,
    pinnedExtensions,
    extensionSortBy,
    extensionSortOrder,
    installedExtensions
  ])

  // --- Components ---
  const LanguageFilter = (): React.JSX.Element => {
    const langs = Object.keys(LANGUAGE_NAMES)

    const triggerLabel = useMemo(() => {
      if (selectedLangs.includes('all')) return 'All Languages'
      if (selectedLangs.length === 1) return LANGUAGE_NAMES[selectedLangs[0]]
      return `Languages (${selectedLangs.length})`
    }, [selectedLangs])

    if (!mobile) {
      return (
        <div className="relative group min-w-[200px]">
          <div
            className={cn(
              'flex h-11 w-full items-center justify-between rounded-xl border border-border/40 bg-card/40 px-3 py-2 text-sm cursor-pointer hover:bg-accent/50 transition-all',
              !selectedLangs.includes('all') && 'border-primary/50 ring-2 ring-primary/5'
            )}
            onClick={() => setIsLangModalOpen(!isLangModalOpen)}
          >
            <div className="flex items-center gap-2 truncate">
              <Globe
                className={cn(
                  'h-4 w-4 shrink-0',
                  !selectedLangs.includes('all') ? 'text-primary' : 'text-muted-foreground'
                )}
              />
              <span className="truncate font-semibold text-xs tracking-wide">{triggerLabel}</span>
            </div>
            <ChevronDown
              className={cn(
                'h-4 w-4 opacity-50 transition-transform duration-200',
                isLangModalOpen && 'rotate-180'
              )}
            />
          </div>

          {isLangModalOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsLangModalOpen(false)} />
              <div
                className="absolute top-full z-50 mt-1 w-full max-h-[300px] overflow-y-auto rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl animate-in fade-in slide-in-from-top-1 duration-150 p-2 custom-scrollbar"
                onClick={(e) => e.stopPropagation()}
              >
                {langs.map((lang) => {
                  const isSelected = selectedLangs.includes(lang)
                  return (
                    <div
                      key={lang}
                      className={cn(
                        'flex items-center justify-between w-full px-2 py-2 rounded-lg text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors mb-0.5',
                        isSelected && 'bg-primary/10 text-primary font-medium'
                      )}
                      onClick={() => toggleLang(lang)}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className="shrink-0">{getFlagEmoji(lang)}</span>
                        <span className="truncate">{LANGUAGE_NAMES[lang]}</span>
                      </div>
                      {isSelected && <Check className="h-4 w-4" />}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )
    }

    return (
      <>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsLangModalOpen(true)}
          className={cn(
            'h-11 rounded-xl border-border/40 whitespace-nowrap gap-2 bg-card/40 px-4',
            !selectedLangs.includes('all') && 'border-primary/50 bg-primary/5 text-primary'
          )}
        >
          <Globe className="h-4 w-4" />
          <span className="text-[10px] font-bold uppercase tracking-wider">{triggerLabel}</span>
        </Button>

        <Sheet
          isOpen={isLangModalOpen}
          onClose={() => setIsLangModalOpen(false)}
          title="Select Languages"
          className="max-w-xs"
        >
          <div className="space-y-1 pb-10">
            {langs.map((lang) => (
              <div
                key={lang}
                className={cn(
                  'flex items-center justify-between p-3 rounded-xl transition-all cursor-pointer border border-transparent',
                  selectedLangs.includes(lang)
                    ? 'bg-primary/10 border-primary/20'
                    : 'hover:bg-secondary/50'
                )}
                onClick={() => toggleLang(lang)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{getFlagEmoji(lang)}</span>
                  <div>
                    <div className="text-sm font-semibold">{LANGUAGE_NAMES[lang]}</div>
                    <div className="text-[10px] uppercase tracking-wider opacity-60 font-bold">
                      {lang}
                    </div>
                  </div>
                </div>
                <Checkbox
                  checked={selectedLangs.includes(lang)}
                  onCheckedChange={() => toggleLang(lang)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            ))}
          </div>
        </Sheet>
      </>
    )
  }

  const VirtuosoScroller = useMemo(() => {
    const Scroller = forwardRef<HTMLDivElement, { style?: React.CSSProperties }>(
      ({ style, ...props }, ref) => (
        <div
          {...props}
          ref={ref}
          style={style}
          className="custom-scrollbar overflow-y-auto overflow-x-hidden pr-2"
        />
      )
    )
    Scroller.displayName = 'VirtuosoScroller'
    return Scroller
  }, [])

  const ExtensionCard = ({ ext }: { ext: ExtensionMetadata }): React.JSX.Element => {
    const isInstalled = installedExtensions.some((i) => i.pkg === ext.pkg)
    const isPinned = pinnedExtensions.includes(ext.pkg)
    const isInstalling = installingPkgs.has(ext.pkg)
    const updateAvailable = updates.some((u) => u.pkg === ext.pkg)
    const iconUrl = DataService.getExtensionIcon(ext.pkg, ext.icon)

    const handleBrowse = (): void => {
      setActiveExtension(ext.pkg)
      navigate('/browse')
    }

    return (
      <div className="p-2">
        <Card
          onClick={() => isInstalled && !isInstalling && handleBrowse()}
          className={cn(
            'group relative flex flex-col h-full bg-card/40 border-border/40 hover:border-primary/30 transition-all duration-300 rounded-2xl overflow-hidden',
            isInstalled && !isInstalling && 'cursor-pointer hover:bg-secondary/20',
            isPinned && 'ring-1 ring-primary/20 bg-primary/[0.02]'
          )}
        >
          <div className="p-4 flex gap-4 items-start">
            <div className="relative shrink-0">
              <div className="w-14 h-14 rounded-2xl bg-secondary/30 border border-border/50 overflow-hidden flex items-center justify-center p-2 shadow-sm group-hover:scale-105 transition-transform">
                <img
                  src={iconUrl}
                  alt={ext.name}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.src = ''
                    target.className = 'hidden'
                  }}
                />
              </div>
              {isInstalled && (
                <div className="absolute -bottom-1 -right-1 bg-green-500 text-white rounded-full p-1 border-2 border-background shadow-sm">
                  <ShieldCheck className="w-3 h-3" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-1">
                <h3 className="font-bold text-sm line-clamp-1 group-hover:text-primary transition-colors">
                  {ext.name}
                </h3>
                {ext.nsfw === 1 && (
                  <Badge
                    variant="outline"
                    className="bg-destructive/10 text-destructive border-destructive/20 text-[8px] h-4 px-1 uppercase font-black shrink-0"
                  >
                    NSFW
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2 mt-1">
                <Badge
                  variant="secondary"
                  className="text-[9px] h-4 px-1.5 font-bold uppercase tracking-wider bg-secondary/50"
                >
                  {ext.lang}
                </Badge>
                <span className="text-[10px] text-muted-foreground font-medium opacity-60">
                  v{ext.version}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-auto px-4 pb-4 pt-2 border-t border-border/10 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              {isInstalled && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    togglePin(ext.pkg)
                  }}
                  className={cn(
                    'h-8 w-8 p-0 rounded-xl transition-all',
                    isPinned
                      ? 'text-primary bg-primary/10'
                      : 'text-muted-foreground hover:bg-secondary'
                  )}
                >
                  <Star className={cn('h-4 w-4', isPinned && 'fill-current')} />
                </Button>
              )}
            </div>

            <Button
              size="sm"
              disabled={isInstalling}
              variant={isInstalled && !updateAvailable ? 'secondary' : 'primary'}
              onClick={(e) => {
                e.stopPropagation()
                if (updateAvailable || !isInstalled) {
                  installMutation.mutate(ext)
                } else {
                  uninstallExtension(ext.pkg)
                }
              }}
              className={cn(
                'h-8 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all',
                updateAvailable && 'bg-primary shadow-lg shadow-primary/20 animate-pulse',
                isInstalled &&
                  !updateAvailable &&
                  'hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20'
              )}
            >
              {isInstalling ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : updateAvailable ? (
                'Update'
              ) : isInstalled ? (
                'Uninstall'
              ) : (
                'Install'
              )}
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <AnimatePresence>
      <MobilePage
        scrollable={false}
        title="Extensions"
        subtitle={`${catalog.length} Sources Available`}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={isRefetching}
              onClick={() => refreshCatalog()}
              className="h-10 w-10 p-0 rounded-xl hover:bg-secondary transition-all"
            >
              <RefreshCw
                className={cn('h-4 w-4 text-muted-foreground', isRefetching && 'animate-spin')}
              />
            </Button>
            <Button
              variant={activeSubTab === 'global' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setActiveSubTab(activeSubTab === 'global' ? 'installed' : 'global')}
              className={cn(
                'h-10 w-10 p-0 rounded-xl transition-all relative group',
                activeSubTab === 'global' && 'bg-primary/10 text-primary'
              )}
              title="Global Search"
            >
              <div className="relative flex items-center justify-center">
                <Globe
                  className={cn(
                    'h-4 w-4 transition-all',
                    activeSubTab === 'global' ? 'text-primary' : 'text-muted-foreground'
                  )}
                />
                <div
                  className={cn(
                    'absolute -bottom-1 -right-1 p-0.5 rounded-full transition-all border-2 border-background',
                    activeSubTab === 'global' ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'
                  )}
                >
                  <SearchIcon className="h-2 w-2" strokeWidth={3} />
                </div>
              </div>
            </Button>
          </div>
        }
        headerExtra={
          <div className="space-y-4">
            {/* Main Tabs */}
            <div className="flex bg-secondary/30 p-1 rounded-2xl border border-border/40 overflow-x-auto no-scrollbar relative">
              {[
                {
                  id: 'installed',
                  label: 'Installed',
                  icon: ShieldCheck,
                  count: installedExtensions.length
                },
                { id: 'catalog', label: 'Browse', icon: Globe },
                {
                  id: 'updates',
                  label: 'Updates',
                  icon: RefreshCw,
                  count: updates.length,
                  highlight: updates.length > 0
                }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveSubTab(tab.id as any)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all min-w-fit relative z-10',
                    activeSubTab === tab.id
                      ? 'text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {activeSubTab === tab.id && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 bg-background shadow-md ring-1 ring-border/20 rounded-xl z-[-1]"
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <tab.icon
                    className={cn('h-3.5 w-3.5', tab.highlight && 'text-primary animate-pulse')}
                  />
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <Badge
                      variant={tab.highlight ? 'default' : 'secondary'}
                      className="h-4 min-w-[18px] px-1 text-[9px]"
                    >
                      {tab.count}
                    </Badge>
                  )}
                </button>
              ))}
            </div>

            {activeSubTab !== 'global' && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col md:flex-row gap-3"
              >
                <div className="relative flex-1 group">
                  <SearchIcon className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    className="pl-9 pr-4 h-11 bg-card/40 border-border/40 focus:border-primary/50 focus:ring-4 focus:ring-primary/5 transition-all rounded-xl text-sm"
                    placeholder={
                      activeSubTab === 'catalog' ? 'Search 1200+ sources...' : 'Search installed...'
                    }
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

                <div className="flex gap-2">
                  <LanguageFilter />

                  <Button
                    variant={showNsfw ? 'secondary' : 'outline'}
                    onClick={() => setShowNsfw(!showNsfw)}
                    className={cn(
                      'h-11 px-4 rounded-xl border-border/40 transition-all font-bold text-[10px] uppercase tracking-wider bg-card/40',
                      showNsfw && 'bg-destructive/10 text-destructive border-destructive/20'
                    )}
                  >
                    {showNsfw ? (
                      <ShieldAlert className="w-4 h-4 mr-2" />
                    ) : (
                      <ShieldCheck className="w-4 h-4 mr-2" />
                    )}
                    18+
                  </Button>

                  <Button
                    variant={extensionSortBy !== 'name' ? 'secondary' : 'outline'}
                    size="sm"
                    onClick={() =>
                      setExtensionSortOrder(extensionSortOrder === 'asc' ? 'desc' : 'asc')
                    }
                    className={cn(
                      'h-11 px-4 rounded-xl border-border/40 transition-all flex items-center gap-2 bg-card/40',
                      extensionSortBy !== 'name' && 'border-primary/50 bg-primary/5'
                    )}
                  >
                    <ArrowUpDown
                      className={cn(
                        'w-4 h-4 transition-transform',
                        extensionSortOrder === 'desc' && 'rotate-180'
                      )}
                    />
                    <span className="font-semibold text-xs transition-all uppercase tracking-wider">
                      {mobile ? '' : 'Sort'}
                    </span>
                  </Button>
                </div>
              </motion.div>
            )}

            {activeSubTab === 'updates' && updates.length > 0 && (
              <Button
                size="sm"
                onClick={() => bulkUpdateMutation.mutate(updates)}
                disabled={bulkUpdateMutation.isPending}
                className="w-full h-11 rounded-xl bg-primary shadow-lg shadow-primary/20 text-[10px] font-black uppercase tracking-widest gap-2"
              >
                {bulkUpdateMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Update All {updates.length} extensions
              </Button>
            )}
          </div>
        }
      >
        <div className={cn('flex-1 min-h-0 flex flex-col -mb-4', activeSubTab === 'global' && 'overflow-y-auto custom-scrollbar')}>
          {activeSubTab === 'global' ? (
            <GlobalSearch />
          ) : catalogLoading ? (
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 9 }).map((_, i) => (
                <div
                  key={i}
                  className="animate-in fade-in duration-500"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <Card className="h-40 bg-card/40 border-border/40 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-primary/30" />
                  </Card>
                </div>
              ))}
            </div>
          ) : filteredData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
              <div className="w-20 h-20 rounded-3xl bg-secondary/30 flex items-center justify-center ring-2 ring-border/10">
                <Package className="h-10 w-10 text-muted-foreground/40" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-bold tracking-tight">No Extensions Found</h3>
                <p className="text-sm text-muted-foreground max-w-xs">
                  {searchQuery
                    ? `No results match "${searchQuery}"`
                    : 'Try changing your filters or checking your connection.'}
                </p>
              </div>
              <Button
                variant="outline"
                className="rounded-xl px-8"
                onClick={() => {
                  setSearchQuery('')
                  setSelectedLangs(['all'])
                }}
              >
                Clear All Filters
              </Button>
            </div>
          ) : (
            <VirtuosoGrid
              data={filteredData}
              totalCount={filteredData.length}
              overscan={200}
              style={{ height: '100%' }}
              listClassName="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 py-4"
              itemContent={(_, ext) => <ExtensionCard key={ext.pkg} ext={ext} />}
              components={{
                Scroller: VirtuosoScroller,
                Footer: () => <div className="h-24" />
              }}
            />
          )}
        </div>
      </MobilePage>
    </AnimatePresence>
  )
}
