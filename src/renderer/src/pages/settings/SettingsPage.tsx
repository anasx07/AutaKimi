import {
  Shield,
  Globe,
  Clock,
  Trash2,
  Eraser,
  Cloud,
  Terminal,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
  BookOpen,
  Rows,
  ChevronRight,
  Settings2,
  Zap,
  Palette,
  Monitor,
  Sparkles,
  MoveHorizontal,
  ArrowUpDown,
  Download,
  RefreshCcw
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { useUIStore, useReaderStore, useSettingsStore } from '@renderer/shared/model'
import { ThemeType, ColorThemeType, ReadingMode } from '@common/types'
import { isMobile } from '@renderer/shared/platform'
import { cn } from '@renderer/shared/lib/utils'
import {
  Button,
  Card,
  CardContent,
  Input,
  Badge,
  Switch,
  Select,
  SettingsRow,
  SectionHeader,
  MobilePage
} from '@renderer/shared/ui'
import { DEFAULT_THEMES, PREMIUM_THEMES, ThemeOption } from '@renderer/shared/config/themes'
import { DataService } from '@renderer/shared/api'

const ShortcutInput = ({
  label,
  value,
  onSave
}: {
  label: string
  value: string
  onSave: (key: string) => void
}): React.JSX.Element => {
  const [isCapturing, setIsCapturing] = useState(false)

  useEffect(() => {
    if (!isCapturing) return
    const handleDown = (e: KeyboardEvent): void => {
      if (e.code === 'Escape') {
        setIsCapturing(false)
        return
      }
      e.preventDefault()
      e.stopPropagation()
      onSave(e.code)
      setIsCapturing(false)
    }
    window.addEventListener('keydown', handleDown)
    return () => window.removeEventListener('keydown', handleDown)
  }, [isCapturing, onSave])

  return (
    <div className="flex items-center justify-between p-3 border rounded-xl bg-secondary/20 border-border/50 hover:border-border transition-colors">
      <div className="flex flex-col">
        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-tight">
          {label}
        </span>
      </div>
      <Button
        variant={isCapturing ? 'secondary' : 'ghost'}
        onClick={() => setIsCapturing(true)}
        className={cn(
          'font-mono text-[10px] uppercase min-w-[100px] border border-border shadow-inner text-foreground',
          isCapturing &&
            'animate-pulse ring-1 ring-primary bg-primary/10 text-primary border-primary/20'
        )}
      >
        {isCapturing ? 'Listening...' : value.replace('Arrow', '')}
      </Button>
    </div>
  )
}

const SidebarItem = ({
  id,
  label,
  icon: Icon,
  activeTab,
  setActiveTab
}: {
  id: string
  label: string
  icon: any
  activeTab: string
  setActiveTab: (val: any) => void
}): React.JSX.Element => (
  <button
    onClick={() => setActiveTab(id)}
    className={cn(
      'w-full flex items-center justify-between p-4 rounded-2xl transition-all duration-300 group relative overflow-hidden',
      activeTab === id
        ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]'
        : 'text-muted-foreground hover:bg-secondary hover:text-foreground active:scale-95'
    )}
  >
    <div className="flex items-center gap-4 relative z-10">
      <div
        className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300',
          activeTab === id ? 'bg-white/20 rotate-12 scale-110' : 'bg-secondary group-hover:bg-muted'
        )}
      >
        <Icon
          className={cn(
            'h-5 w-5',
            activeTab === id ? 'animate-pulse' : 'group-hover:scale-110 transition-transform'
          )}
        />
      </div>
      <span
        className={cn(
          'font-bold tracking-tight uppercase text-xs',
          activeTab === id ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'
        )}
      >
        {label}
      </span>
    </div>
    <ChevronRight
      className={cn(
        'h-4 w-4 transition-all duration-300',
        activeTab === id
          ? 'translate-x-0 opacity-50'
          : '-translate-x-4 opacity-0 group-hover:translate-x-0 group-hover:opacity-50'
      )}
    />
    {activeTab === id && (
      <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-50" />
    )}
  </button>
)

export default function SettingsPage(): React.JSX.Element {
  const { updateStatus } = useUIStore()
  const mobile = isMobile()

  const {
    defaultChapterSort,
    setDefaultChapterSort,
    readingMode,
    setReadingMode,
    autoMarkRead,
    setAutoMarkRead,
    preloadPages,
    setPreloadPages,
    dragToScroll,
    setDragToScroll,
    autoScrollShortcuts,
    setShortcut,
    readerTheme,
    setReaderTheme
  } = useReaderStore()

  const {
    bypassCloudflare,
    setBypassCloudflare,
    userAgent,
    setUserAgent,
    timeoutInterval,
    setTimeoutInterval,
    enableLog,
    setEnableLog,
    showNsfw,
    setShowNsfw,
    displayMode,
    setDisplayMode,
    theme,
    setTheme,
    colorTheme,
    setColorTheme,
    downloadConcurrency,
    setDownloadConcurrency,
    minimizeToTray,
    setMinimizeToTray,
    autoNextAnime,
    setAutoNextAnime,
    autoSwitchServer,
    setAutoSwitchServer
  } = useSettingsStore()

  const [activeTab, setActiveTab] = useState<'general' | 'reading' | 'anime' | 'advanced'>(
    'general'
  )
  const [showMobileMenu, setShowMobileMenu] = useState(true)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  const handleClearCache = async (): Promise<void> => {
    try {
      setStatusMessage('Clearing Cache...')
      await DataService.clearCache()
      setStatusMessage('Cache cleared successfully!')
      setTimeout(() => setStatusMessage(null), 2000)
    } catch (e) {
      console.error('Clear cache failed', e)
      setStatusMessage('Failed to clear cache')
      setTimeout(() => setStatusMessage(null), 2000)
    }
  }

  const handleClearCookies = async (): Promise<void> => {
    try {
      setStatusMessage('Clearing Cookies...')
      await DataService.clearCookies()
      setStatusMessage('Cookies cleared successfully!')
      setTimeout(() => setStatusMessage(null), 2000)
    } catch (e) {
      console.error('Clear cookies failed', e)
      setStatusMessage('Failed to clear cookies')
      setTimeout(() => setStatusMessage(null), 2000)
    }
  }

  const renderThemeCard = (opt: ThemeOption, isPremium = false): React.JSX.Element => {
    const isActive = theme === opt.theme && colorTheme === opt.colorTheme
    return (
      <button
        key={opt.id}
        onClick={() => {
          setTheme(opt.theme as ThemeType)
          setColorTheme(opt.colorTheme as ColorThemeType)
        }}
        className={cn(
          'group flex items-center rounded-xl transition-all duration-200 text-left relative overflow-hidden border',
          isPremium ? 'gap-4 p-5 min-h-[110px]' : 'gap-3 p-4',
          opt.bgClass,
          opt.borderClass,
          isActive
            ? 'ring-2 ring-primary ring-offset-2 ring-offset-background opacity-100'
            : 'hover:scale-[1.02] hover:shadow-md active:scale-95 opacity-70 hover:opacity-100 grayscale-[0.2]'
        )}
        style={
          opt.bgImage
            ? {
                backgroundImage: `url(${opt.bgImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center 20%'
              }
            : undefined
        }
      >
        {opt.bgImage && (
          <div
            className={cn(
              'absolute inset-0 transition-colors z-0',
              opt.theme === 'light'
                ? 'bg-white/40 group-hover:bg-white/20'
                : 'bg-black/30 group-hover:bg-black/10'
            )}
          />
        )}
        <div
          className={cn(
            'relative z-10 rounded-lg flex items-center justify-center shrink-0 border',
            isPremium ? 'w-14 h-14' : 'w-10 h-10',
            opt.boxClass || 'border-transparent bg-transparent'
          )}
        >
          <div className={cn('w-3 h-3 rounded-full shadow-sm', opt.dotClass)} />
        </div>
        <div className="relative z-10">
          <div
            className={cn(
              'flex items-center gap-2',
              isPremium
                ? 'text-base font-black tracking-tight mb-1 drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,0.8)]'
                : 'font-bold text-sm'
            )}
          >
            {opt.name}
            {opt.tag && (
              <span className="text-[9px] font-bold uppercase tracking-wider bg-black/60 text-white px-1.5 py-0.5 rounded shadow border border-white/10">
                {opt.tag}
              </span>
            )}
          </div>
          <div className={cn(isPremium ? 'text-sm' : 'text-xs mt-0.5', opt.descClass)}>
            {opt.desc}
          </div>
        </div>
      </button>
    )
  }

  const handleTabSelect = (id: any) => {
    setActiveTab(id)
    if (mobile) setShowMobileMenu(false)
  }

  const renderContent = () => (
    <>
      {activeTab === 'general' && (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <section className="space-y-6">
            <SectionHeader title="Appearance & Theme" icon={Palette}>
              <Button
                variant={theme === 'system' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setTheme('system')}
                className="gap-2 h-9 text-xs font-bold uppercase tracking-wider border-border bg-secondary/50 text-foreground"
              >
                <Monitor className="h-4 w-4" /> System Sync
              </Button>
            </SectionHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {DEFAULT_THEMES.map((opt) => renderThemeCard(opt, false))}
            </div>
            <div className="space-y-4 pt-4">
              <h3 className="text-xs font-black flex items-center gap-2 uppercase tracking-[0.2em] text-amber-500 pl-1">
                <Sparkles className="h-4 w-4" /> Premium Themes
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {PREMIUM_THEMES.map((opt) => renderThemeCard(opt, true))}
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <SectionHeader title="Interface & Behavior" icon={Monitor} />
            <Card className="border-border bg-card divide-y divide-border overflow-hidden">
              <SettingsRow
                title="Browse Display Mode"
                description="Default layout for catalog browsing."
              >
                <div className="w-40">
                  <Select
                    value={displayMode}
                    onValueChange={(val) => setDisplayMode(val as 'grid' | 'list')}
                    options={[
                      { value: 'grid', label: 'Grid' },
                      { value: 'list', label: 'List' }
                    ]}
                  />
                </div>
              </SettingsRow>
              <SettingsRow
                title="Show NSFW Sources"
                description="Display 18+ extensions and content."
              >
                <Switch checked={showNsfw} onCheckedChange={setShowNsfw} />
              </SettingsRow>
              <SettingsRow
                title="Minimize to Tray"
                description="App stays running in background when closed."
              >
                <Switch checked={minimizeToTray} onCheckedChange={setMinimizeToTray} />
              </SettingsRow>
            </Card>
          </section>
        </div>
      )}

      {activeTab === 'reading' && (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <section className="space-y-6">
            <SectionHeader title="Reading Style" icon={BookOpen} />
            <Card className="border-border bg-card divide-y divide-border overflow-hidden">
              <SettingsRow
                title="Default Sort"
                description="Order for chapters in manga details."
                className="bg-muted/20"
              >
                <div className="w-40">
                  <Select
                    value={defaultChapterSort}
                    onValueChange={(val) => setDefaultChapterSort(val as 'asc' | 'desc')}
                    options={[
                      { value: 'asc', label: 'Oldest First' },
                      { value: 'desc', label: 'Newest First' }
                    ]}
                  />
                </div>
              </SettingsRow>
              <SettingsRow
                title="Reader Theme"
                description="Visual theme overlay specifically for the reading interface."
              >
                <div className="w-52">
                  <Select
                    value={readerTheme}
                    onValueChange={(val) =>
                      setReaderTheme(val as 'match-app' | 'dark' | 'light' | 'system')
                    }
                    options={[
                      { value: 'match-app', label: 'Match App Theme' },
                      { value: 'dark', label: 'Always Dark Mode' },
                      { value: 'light', label: 'Always Light Mode' }
                    ]}
                  />
                </div>
              </SettingsRow>
              <div className="p-6 space-y-6">
                <div className="space-y-1">
                  <div className="text-sm font-bold flex items-center gap-2">
                    Active Reading Mode
                  </div>
                  <div className="text-xs text-muted-foreground opacity-60">
                    Select your preferred navigation engine.
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  {[
                    {
                      id: 'paged-ltr',
                      label: 'Paged LTR',
                      icon: <MoveHorizontal className="h-4 w-4" />
                    },
                    {
                      id: 'paged-rtl',
                      label: 'Paged RTL',
                      icon: <MoveHorizontal className="h-4 w-4 rotate-180" />
                    },
                    {
                      id: 'paged-vertical',
                      label: 'Paged Vert',
                      icon: <ArrowUpDown className="h-4 w-4" />
                    },
                    {
                      id: 'continuous-vertical',
                      label: 'Continuous',
                      icon: <Rows className="h-4 w-4" />
                    },
                    {
                      id: 'webtoon',
                      label: 'Webtoon',
                      icon: <Zap className="h-4 w-4 text-primary animate-pulse" />
                    }
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => setReadingMode(mode.id as ReadingMode)}
                      className={cn(
                        'flex flex-col items-center justify-center p-4 rounded-xl border transition-all gap-3',
                        readingMode === mode.id
                          ? 'bg-primary text-primary-foreground shadow-lg scale-105'
                          : 'border-border bg-secondary/50 hover:bg-secondary text-muted-foreground opacity-60 hover:opacity-100'
                      )}
                    >
                      <div
                        className={cn(
                          'p-2 rounded-lg border',
                          readingMode === mode.id
                            ? 'bg-white/20 border-white/20'
                            : 'bg-card border-border'
                        )}
                      >
                        {mode.icon}
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-tighter">
                        {mode.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <SettingsRow
                title="Auto Mark Read"
                description="Automatically track your reading progress."
              >
                <Switch checked={autoMarkRead} onCheckedChange={setAutoMarkRead} />
              </SettingsRow>
              <SettingsRow
                title="Predictive Preloading"
                description="Number of pages to load in advance."
              >
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={preloadPages}
                  onChange={(e) => setPreloadPages(parseInt(e.target.value))}
                  className="h-9 w-20 text-center font-bold"
                />
              </SettingsRow>
              <SettingsRow title="Drag to Scroll" description="Mouse-driven scroll navigation.">
                <Switch checked={dragToScroll} onCheckedChange={setDragToScroll} />
              </SettingsRow>
            </Card>
          </section>

          <section className="space-y-6">
            <SectionHeader title="Keyboard Controls" icon={Terminal} />
            <Card className="border-primary/10 bg-card p-6 border shadow-inner">
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.2em] mb-6">
                Map your custom engine shortcuts
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ShortcutInput
                  label="Toggle Auto-Scroll"
                  value={autoScrollShortcuts.toggle}
                  onSave={(k) => setShortcut('toggle', k)}
                />
                <ShortcutInput
                  label="Pause (Hold)"
                  value={autoScrollShortcuts.pause}
                  onSave={(k) => setShortcut('pause', k)}
                />
                <ShortcutInput
                  label="Speed Boost"
                  value={autoScrollShortcuts.boost}
                  onSave={(k) => setShortcut('boost', k)}
                />
                <ShortcutInput
                  label="Slow Down"
                  value={autoScrollShortcuts.slow}
                  onSave={(k) => setShortcut('slow', k)}
                />
                <ShortcutInput
                  label="Reverse (Hold)"
                  value={autoScrollShortcuts.reverse}
                  onSave={(k) => setShortcut('reverse', k)}
                />
              </div>
            </Card>
          </section>
        </div>
      )}

      {activeTab === 'anime' && (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <section className="space-y-6">
            <SectionHeader title="Anime Viewing" icon={Zap} />
            <Card className="border-border bg-card divide-y divide-border overflow-hidden shadow-none">
              <SettingsRow
                title="Auto Next Episode"
                description="Automatically play the next episode when current one ends."
              >
                <Switch checked={autoNextAnime} onCheckedChange={setAutoNextAnime} />
              </SettingsRow>
              <SettingsRow
                title="Auto-Switch Server"
                description="Automatically switch to a working server if current one fails."
              >
                <Switch checked={autoSwitchServer} onCheckedChange={setAutoSwitchServer} />
              </SettingsRow>
            </Card>
          </section>
        </div>
      )}

      {activeTab === 'advanced' && (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <section className="space-y-6">
            <SectionHeader title="Network & Core" icon={Globe} />
            <Card className="border-border bg-card p-6 space-y-6 shadow-none">
              <div className="flex items-center justify-between border-b border-border pb-6">
                <div className="space-y-1">
                  <div className="text-sm font-bold">Bypass Cloudflare</div>
                  <div className="text-xs text-muted-foreground italic opacity-60 underline decoration-primary/30 underline-offset-4">
                    Experimental protection bypass tool.
                  </div>
                </div>
                <Switch checked={bypassCloudflare} onCheckedChange={setBypassCloudflare} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-2 tracking-widest">
                    <Shield className="h-3 w-3" /> User Agent identification
                  </div>
                  <Input
                    placeholder="Custom Identification..."
                    value={userAgent}
                    onChange={(e) => setUserAgent(e.target.value)}
                    className="bg-secondary/20 border-border h-10 font-mono text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <div className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-2 tracking-widest">
                    <Clock className="h-3 w-3" /> Global Timeout (ms)
                  </div>
                  <Input
                    type="number"
                    value={timeoutInterval}
                    onChange={(e) => setTimeoutInterval(e.target.value)}
                    className="bg-secondary/20 border-border h-10 font-mono text-xs"
                  />
                </div>
              </div>
            </Card>
          </section>

          <section className="space-y-6">
            <SectionHeader title="Download Buffer" icon={Download}>
              <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 px-3 py-1 font-black uppercase tracking-widest text-[10px] animate-pulse">
                <Sparkles className="mr-2 h-3 w-3" /> Premium
              </Badge>
            </SectionHeader>
            <Card className="border-amber-500/10 bg-card p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="text-sm font-bold flex items-center gap-2 italic text-foreground">
                    Parallel Streams{' '}
                    <Badge
                      variant="outline"
                      className="text-[9px] h-4 font-black bg-primary/20 border-primary/40 text-primary"
                    >
                      TURBO
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground max-w-sm">
                    Concurrent page connections. Higher values download faster but risk source
                    rate-limiting.
                  </p>
                </div>
                <div className="w-44">
                  <Select
                    value={downloadConcurrency.toString()}
                    onValueChange={(val) => setDownloadConcurrency(parseInt(val))}
                    options={[
                      { value: '1', label: '1 Sequential' },
                      { value: '2', label: '2 Parallel' },
                      { value: '3', label: '3 Parallel' },
                      { value: '4', label: '4 Parallel' },
                      { value: '5', label: '5 Extreme' }
                    ]}
                  />
                </div>
              </div>
            </Card>
          </section>

          <section className="space-y-6">
            <SectionHeader title="Maintenance" icon={Trash2} variant="destructive" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Button
                variant="outline"
                className="h-20 gap-3 border-destructive/20 hover:bg-destructive/10 hover:text-destructive flex flex-col items-center justify-center font-black uppercase tracking-widest text-xs transition-all active:scale-95 group text-foreground"
                onClick={handleClearCache}
              >
                <Eraser className="h-5 w-5 group-hover:rotate-12 transition-transform" /> Clear
                Image Assets
              </Button>
              <Button
                variant="outline"
                className="h-20 gap-3 border-destructive/20 hover:bg-destructive/10 hover:text-destructive flex flex-col items-center justify-center font-black uppercase tracking-widest text-xs transition-all active:scale-95 group text-foreground"
                onClick={handleClearCookies}
              >
                <Cloud className="h-5 w-5 group-hover:-translate-y-1 transition-transform" /> Reset
                Session Data
              </Button>
            </div>
          </section>

          <section className="space-y-6">
            <SectionHeader title="Update Engine" icon={RefreshCcw}>
              <Badge
                variant="outline"
                className="px-4 py-1.5 font-black uppercase text-[10px] tracking-widest bg-secondary"
              >
                Up to date
              </Badge>
            </SectionHeader>
            <Card className="border-border bg-card p-6 shadow-none">
              <div className="flex items-center justify-between mb-8">
                <div className="space-y-1">
                  <div className="text-lg font-black tracking-tighter uppercase italic opacity-80 leading-none text-foreground">
                    AutaKimi v{DataService.version}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest opacity-50">
                    Local Installation Binary
                  </div>
                </div>
              </div>
              <div className="bg-muted/30 rounded-2xl p-6 border border-border flex items-center justify-between group">
                <div className="flex items-center gap-6">
                  <div
                    className={cn(
                      'w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-all group-hover:scale-110 group-hover:rotate-3 shadow-primary/20',
                      updateStatus === 'error'
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-primary text-primary-foreground border border-primary/20'
                    )}
                  >
                    {updateStatus === 'checking' ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      <RefreshCcw className="h-6 w-6" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="text-base font-black tracking-tight uppercase italic drop-shadow-sm text-foreground">
                      Check Updates
                    </div>
                    <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                      Last synchronized: Just now
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => DataService.checkForUpdates()}
                  disabled={updateStatus === 'checking'}
                  className="h-12 px-8 font-black uppercase tracking-widest text-xs border-primary/20 hover:bg-primary/10 hover:text-primary transition-all active:scale-95 text-foreground"
                >
                  Sync Now
                </Button>
              </div>
            </Card>
          </section>

          <section className="space-y-6">
            <SectionHeader title="Internal Controls" icon={Terminal} variant="yellow">
              <div className="flex items-center gap-2 bg-green-500/10 text-green-500 px-3 py-1 rounded-full font-black text-[9px] uppercase tracking-widest border border-green-500/20">
                <CheckCircle2 className="h-3 w-3" /> Binary Core Active
              </div>
            </SectionHeader>
            <Card className="border-border bg-card p-6">
              <SettingsRow
                title="Developer Logging"
                description="Verbose trace output for debugging."
              >
                <Switch checked={enableLog} onCheckedChange={setEnableLog} />
              </SettingsRow>
              <div className="mt-8 pt-8 border-t border-border flex items-center justify-between">
                <p className="text-[10px] text-muted-foreground/60 font-bold uppercase tracking-[0.2em]">
                  Build Engineering: Deepmind Advanced Agentic Coding
                </p>
                <a
                  href="https://github.com/anasx07/AutaKimi-Release"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-primary font-black uppercase tracking-widest text-[10px] hover:scale-110 active:scale-95 transition-all"
                >
                  GitHub Repo <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </Card>
          </section>
        </div>
      )}
    </>
  )

  if (mobile) {
    if (showMobileMenu) {
      return (
        <MobilePage title="Settings" subtitle="Configure preferences">
          <nav className="space-y-3 pt-4">
            <SidebarItem
              id="general"
              label="General"
              icon={Settings2}
              activeTab={activeTab}
              setActiveTab={handleTabSelect}
            />
            <SidebarItem
              id="reading"
              label="Reading"
              icon={BookOpen}
              activeTab={activeTab}
              setActiveTab={handleTabSelect}
            />
            <SidebarItem
              id="anime"
              label="Anime"
              icon={Zap}
              activeTab={activeTab}
              setActiveTab={handleTabSelect}
            />
            <SidebarItem
              id="advanced"
              label="Advanced"
              icon={Zap}
              activeTab={activeTab}
              setActiveTab={handleTabSelect}
            />
          </nav>
        </MobilePage>
      )
    }

    return (
      <SafeMobilePage
        title={activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
        subtitle="Configuration"
        onBack={() => setShowMobileMenu(true)}
      >
        <div className="p-4">{renderContent()}</div>
        {statusMessage && (
          <div className="fixed bottom-10 right-10 animate-in slide-in-from-right-8 duration-500 z-50">
            <Badge
              variant={statusMessage?.includes('Failed') ? 'destructive' : 'default'}
              className="px-8 py-4 text-sm font-black uppercase tracking-widest shadow-2xl border-2 border-border/20 backdrop-blur-3xl ring-4 ring-black/10"
            >
              {statusMessage?.includes('Failed') ? (
                <AlertCircle className="mr-3 h-5 w-5" />
              ) : (
                <Loader2 className="mr-3 h-5 w-5 animate-spin" />
              )}
              {statusMessage}
            </Badge>
          </div>
        )}
      </SafeMobilePage>
    )
  }

  return (
    <div className="flex h-full bg-background overflow-hidden animate-in fade-in duration-700">
      <aside className="w-80 border-r border-border/60 bg-secondary/10 backdrop-blur-3xl flex flex-col p-6 gap-8 shrink-0">
        <div className="shrink-0 flex flex-col space-y-4 mb-2">
          <div className="flex flex-col min-w-0">
            <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Settings
            </h1>
            <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-wider opacity-60">
              Configure preferences
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-3 font-medium">
          <SidebarItem
            id="general"
            label="General"
            icon={Settings2}
            activeTab={activeTab}
            setActiveTab={handleTabSelect}
          />
          <SidebarItem
            id="reading"
            label="Reading"
            icon={BookOpen}
            activeTab={activeTab}
            setActiveTab={handleTabSelect}
          />
          <SidebarItem
            id="anime"
            label="Anime"
            icon={Zap}
            activeTab={activeTab}
            setActiveTab={handleTabSelect}
          />
          <SidebarItem
            id="advanced"
            label="Advanced"
            icon={Zap}
            activeTab={activeTab}
            setActiveTab={handleTabSelect}
          />
        </nav>

        <Card className="border-border/40 bg-card group shadow-none">
          <CardContent className="p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Core Engine Active
              </span>
            </div>
            <p className="text-[9px] text-muted-foreground/60 font-medium leading-relaxed group-hover:text-muted-foreground transition-colors">
              Your reading state and library are synchronized with the local SQLite database.
            </p>
          </CardContent>
        </Card>
      </aside>

      <main className="flex-1 overflow-y-auto no-scrollbar scroll-smooth">
        <div className="p-10 max-w-5xl mx-auto pb-20">{renderContent()}</div>
      </main>

      {statusMessage && (
        <div className="fixed bottom-10 right-10 animate-in slide-in-from-right-8 duration-500 z-50">
          <Badge
            variant={statusMessage?.includes('Failed') ? 'destructive' : 'default'}
            className="px-8 py-4 text-sm font-black uppercase tracking-widest shadow-2xl border-2 border-border/20 backdrop-blur-3xl ring-4 ring-black/10"
          >
            {statusMessage?.includes('Failed') ? (
              <AlertCircle className="mr-3 h-5 w-5" />
            ) : (
              <Loader2 className="mr-3 h-5 w-5 animate-spin" />
            )}
            {statusMessage}
          </Badge>
        </div>
      )}
    </div>
  )
}

// Internal wrapper to handle MobilePage layout specifically for settings content
const SafeMobilePage = ({ children, title, subtitle, onBack }: any) => {
  return (
    <MobilePage title={title} subtitle={subtitle} onBack={onBack}>
      {children}
    </MobilePage>
  )
}
