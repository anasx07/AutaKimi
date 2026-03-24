import { DataService } from '@renderer/shared/api'
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
  Layout,
  ArrowUpDown,
  MoveHorizontal,
  Eye,
  Zap,
  Palette,
  Monitor,
  Sparkles,
  RefreshCcw,
  Download
} from 'lucide-react'
import { useState } from 'react'
import { useUIStore, useLibraryStore, ThemeType, ColorThemeType } from '@renderer/shared/model'
import { cn } from '@renderer/shared/lib/utils'
import { Button, Card, CardContent, Input, Badge, Switch, Select } from '@renderer/shared/ui'
import { DEFAULT_THEMES, PREMIUM_THEMES, ThemeOption } from '@renderer/shared/config/themes'

export default function SettingsPage() {
  const {
    showNsfw, setShowNsfw,
    displayMode, setDisplayMode,
    theme, setTheme,
    colorTheme, setColorTheme,
    updateStatus, updateProgress, updateError
  } = useUIStore()

  const {
    defaultChapterSort, setDefaultChapterSort,
    readerMode, setReaderMode,
    readerDirection, setReaderDirection,
    autoMarkRead, setAutoMarkRead,
    preloadPages, setPreloadPages
  } = useLibraryStore()

  const [bypassCloudflare, setBypassCloudflare] = useState(true) // Placeholder local sync for now
  const [userAgent, setUserAgent] = useState('')
  const [timeoutInterval, setTimeoutInterval] = useState('30000')
  const [enableLog, setEnableLog] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  // Initialize local states from DB (some settings aren't in centralized store yet)
  useState(() => {
    const init = async () => {
      const cf = await DataService.db.getSetting('bypass_cloudflare')
      const ua = await DataService.db.getSetting('user_agent')
      const tout = await DataService.db.getSetting('timeout_interval')
      const elog = await DataService.db.getSetting('enable_log')
      if (cf !== null) setBypassCloudflare(cf === 'true')
      if (ua !== null) setUserAgent(ua)
      if (tout !== null) setTimeoutInterval(tout)
      if (elog !== null) setEnableLog(elog === 'true')
    }
    init()
  })

  const saveSetting = async (key: string, value: string) => {
    try {
      await DataService.db.setSetting(key, value)
    } catch (e) {
      console.error(`Failed to save setting ${key}`, e)
    }
  }

  const handleClearCache = async () => {
    try {
      setStatusMessage('Clearing Cache...')
      const res = await DataService.clearCache()
      setStatusMessage(res.success ? 'Cache cleared successfully!' : 'Failed to clear cache')
      setTimeout(() => setStatusMessage(null), 2000)
    } catch (e) {
      console.error('Clear cache failed', e)
    }
  }

  const handleClearCookies = async () => {
    try {
      setStatusMessage('Clearing Cookies...')
      const res = await DataService.clearCookies()
      setStatusMessage(res.success ? 'Cookies cleared successfully!' : 'Failed to clear cookies')
      setTimeout(() => setStatusMessage(null), 2000)
    } catch (e) {
      console.error('Clear cookies failed', e)
    }
  }

  const renderThemeCard = (opt: ThemeOption, isPremium = false) => {
    const isActive = theme === opt.theme && colorTheme === opt.colorTheme;
    return (
      <button
        key={opt.id}
        onClick={() => {
          setTheme(opt.theme as ThemeType)
          setColorTheme(opt.colorTheme as ColorThemeType)
        }}
        className={`group flex items-center ${isPremium ? 'gap-4 p-5 min-h-[110px]' : 'gap-3 p-4'} rounded-xl transition-all duration-200 text-left relative overflow-hidden border ${opt.bgClass || ''} ${opt.borderClass || ''} ${isActive ? 'ring-2 ring-primary ring-offset-2 ring-offset-background opacity-100' : 'hover:scale-[1.02] hover:shadow-md active:scale-95 opacity-70 hover:opacity-100 grayscale-[0.2]'}`}
        style={opt.bgImage ? { backgroundImage: `url(${opt.bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center 20%' } : undefined}
      >
        {opt.bgImage && <div className={`absolute inset-0 transition-colors z-0 ${opt.theme === 'light' ? 'bg-white/40 group-hover:bg-white/20' : 'bg-black/30 group-hover:bg-black/10'}`} />}

        <div className={`relative z-10 ${isPremium ? 'w-14 h-14' : 'w-10 h-10'} rounded-lg flex items-center justify-center shrink-0 border ${opt.boxClass || 'border-transparent bg-transparent'}`}>
          <div className={`w-3 h-3 rounded-full shadow-sm ${opt.dotClass}`} />
        </div>
        <div className="relative z-10">
          <div className={`font-semibold flex items-center gap-2 ${isPremium ? 'text-base mb-1' : 'text-sm'}`}>
            {opt.name}
            {opt.tag && <span className="text-[9px] font-bold uppercase tracking-wider bg-black/60 text-white px-1.5 py-0.5 rounded shadow border border-white/10">{opt.tag}</span>}
          </div>
          <div className={`${isPremium ? 'text-sm' : 'text-xs mt-0.5'} ${opt.descClass}`}>{opt.desc}</div>
        </div>
      </button>
    )
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-10 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col space-y-1.5 border-b border-border pb-6">
        <h1 className="text-4xl font-extrabold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-lg">Personalize your reading experience and manage your data.</p>
      </div>

      <div className="grid gap-8">
        {/* 0. Appearance & Theme */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2 text-primary font-semibold text-lg">
              <Palette className="h-5 w-5" />
              Appearance & Theme
            </div>
            <Button
              variant={theme === 'system' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setTheme('system')}
              className="gap-2 h-8 text-xs font-semibold"
            >
              <Monitor className="h-4 w-4" />
              Sync with System
            </Button>
          </div>

          <div className="space-y-6 mt-4">
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1">Default Themes</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {DEFAULT_THEMES.map(opt => renderThemeCard(opt, false))}
              </div>
            </div>

            <div className="space-y-3 mt-8">
              <h3 className="text-xs font-bold flex items-center gap-2 uppercase tracking-wider text-amber-500 pl-1">
                <Sparkles className="h-4 w-4" /> Premium Themes
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {PREMIUM_THEMES.map(opt => renderThemeCard(opt, true))}
              </div>
            </div>
          </div>
        </section>

        {/* 1. Reading Preferences */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-primary font-semibold text-lg px-1">
            <BookOpen className="h-5 w-5" />
            Reading Experience
          </div>
          <Card>
            <CardContent className="p-0 divide-y divide-border">
              <div className="p-4 flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium flex items-center gap-2">
                    <ArrowUpDown className="h-4 w-4 opacity-70" />
                    Default Chapter Sort
                  </div>
                  <div className="text-xs text-muted-foreground">Order for lists in Manga Details.</div>
                </div>
                <div className="w-40">
                  <Select
                    value={defaultChapterSort}
                    onValueChange={(val) => setDefaultChapterSort(val as 'asc' | 'desc')}
                    options={[
                      { value: 'desc', label: 'Newest First' },
                      { value: 'asc', label: 'Oldest First' }
                    ]}
                  />
                </div>
              </div>

              <div className="p-4 flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium flex items-center gap-2">
                    <Layout className="h-4 w-4 opacity-70" />
                    Reader Mode
                  </div>
                  <div className="text-xs text-muted-foreground">Choose your preferred layout.</div>
                </div>
                <div className="w-40">
                  <Select
                    value={readerMode}
                    onValueChange={(val) => setReaderMode(val as 'vertical' | 'paged')}
                    options={[
                      { value: 'vertical', label: 'Vertical Scroll' },
                      { value: 'paged', label: 'Paged View' }
                    ]}
                  />
                </div>
              </div>

              {readerMode === 'paged' && (
                <div className="p-4 flex items-center justify-between bg-secondary/10 animate-in slide-in-from-top-2 duration-300">
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium flex items-center gap-2">
                      <MoveHorizontal className="h-4 w-4 opacity-70" />
                      Reading Direction
                    </div>
                    <div className="text-xs text-muted-foreground">Navigation direction for paged mode.</div>
                  </div>
                  <div className="w-40">
                    <Select
                      value={readerDirection}
                      onValueChange={(val) => setReaderDirection(val as 'ltr' | 'rtl')}
                      options={[
                        { value: 'ltr', label: 'Left to Right' },
                        { value: 'rtl', label: 'Right to Left' }
                      ]}
                    />
                  </div>
                </div>
              )}

              <div className="p-4 flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium flex items-center gap-2">
                    <Eye className="h-4 w-4 opacity-70" />
                    Auto Mark as Read
                  </div>
                  <div className="text-xs text-muted-foreground">Automatically track your progress.</div>
                </div>
                <Switch
                  checked={autoMarkRead}
                  onCheckedChange={setAutoMarkRead}
                />
              </div>

              <div className="p-4 flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium flex items-center gap-2">
                    <Zap className="h-4 w-4 opacity-70" />
                    Page Preloading
                  </div>
                  <div className="text-xs text-muted-foreground">Number of pages to load in advance.</div>
                </div>
                <div className="w-20">
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={preloadPages}
                    onChange={(e) => setPreloadPages(parseInt(e.target.value))}
                    className="h-9 text-center"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* 2. Library & Display */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-primary font-semibold text-lg px-1">
            <Layout className="h-5 w-5" />
            Library & Interface
          </div>
          <Card>
            <CardContent className="p-0 divide-y divide-border">
              <div className="p-4 flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">Browse Display Mode</div>
                  <div className="text-xs text-muted-foreground">Default layout for catalog browsing.</div>
                </div>
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
              </div>

              <div className="p-4 flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">Show NSFW Sources</div>
                  <div className="text-xs text-muted-foreground">Display 18+ extensions and content.</div>
                </div>
                <Switch
                  checked={showNsfw}
                  onCheckedChange={setShowNsfw}
                />
              </div>
            </CardContent>
          </Card>
        </section>

        {/* 3. Network & Security */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-primary font-semibold text-lg px-1">
            <Globe className="h-5 w-5" />
            Network & Connection
          </div>
          <Card>
            <CardContent className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">Bypass Cloudflare</div>
                  <div className="text-xs text-muted-foreground">Experimental protection bypass.</div>
                </div>
                <Switch
                  checked={bypassCloudflare}
                  onCheckedChange={(val) => {
                    setBypassCloudflare(val)
                    saveSetting('bypass_cloudflare', val.toString())
                  }}
                />
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium flex items-center gap-2 leading-none">
                  <Shield className="h-4 w-4 opacity-70" />
                  User Agent String
                </div>
                <Input
                  placeholder="Custom browser identification..."
                  value={userAgent}
                  onChange={(e) => {
                    setUserAgent(e.target.value)
                    saveSetting('user_agent', e.target.value)
                  }}
                />
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium flex items-center gap-2 leading-none">
                  <Clock className="h-4 w-4 opacity-70" />
                  Global Timeout (ms)
                </div>
                <Input
                  type="number"
                  value={timeoutInterval}
                  onChange={(e) => {
                    setTimeoutInterval(e.target.value)
                    saveSetting('timeout_interval', e.target.value)
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </section>

        {/* 4. Maintenance */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-destructive font-semibold text-lg px-1">
            <Trash2 className="h-5 w-5" />
            Maintenance
          </div>
          <Card>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Button variant="outline" className="h-12 gap-2 border-destructive/20 hover:bg-destructive/10 hover:text-destructive transition-all" onClick={handleClearCache}>
                  <Eraser className="h-4 w-4" />
                  Clear Image Cache
                </Button>
                <Button variant="outline" className="h-12 gap-2 border-destructive/20 hover:bg-destructive/10 hover:text-destructive transition-all" onClick={handleClearCookies}>
                  <Cloud className="h-4 w-4" />
                  Reset Session Data
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* 5. System Updates */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-primary font-semibold text-lg px-1">
            <RefreshCcw className={cn("h-5 w-5", updateStatus === 'checking' && "animate-spin")} />
            System Updates
          </div>
          <Card>
            <CardContent className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">Application Version</div>
                  <div className="text-xs text-muted-foreground">You are currently running v{(window as any).api.version}</div>
                </div>
                <Badge variant="outline" className="font-mono px-3 py-1">
                  v{(window as any).api.version}
                </Badge>
              </div>

              <div className="flex flex-col gap-4 pt-2">
                <div className="flex items-center justify-between bg-secondary/20 p-4 rounded-lg border border-border/50">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center",
                      updateStatus === 'error' ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
                    )}>
                      {updateStatus === 'checking' ? <Loader2 className="h-5 w-5 animate-spin" /> :
                       updateStatus === 'available' || updateStatus === 'downloading' ? <Download className="h-5 w-5" /> :
                       updateStatus === 'downloaded' ? <CheckCircle2 className="h-5 w-5 text-green-500" /> :
                       updateStatus === 'error' ? <AlertCircle className="h-5 w-5" /> :
                       <RefreshCcw className="h-5 w-5 opacity-50" />}
                    </div>
                    <div className="space-y-0.5">
                      <div className="text-sm font-semibold capitalize">
                        {updateStatus === 'idle' ? 'Up to date' : 
                         updateStatus === 'checking' ? 'Checking for updates...' :
                         updateStatus === 'available' ? 'Update available!' :
                         updateStatus === 'downloading' ? 'Downloading update...' :
                         updateStatus === 'downloaded' ? 'Ready to install' :
                         updateStatus === 'error' ? 'Update Error' : updateStatus}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {updateStatus === 'error' ? (updateError || 'Could not check for updates') :
                         updateStatus === 'downloading' ? `Progress: ${updateProgress?.percent ? Math.round(updateProgress.percent) : 0}%` :
                         'Last checked: Just now'}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {updateStatus === 'downloaded' ? (
                      <Button 
                        onClick={() => (window as any).api.installUpdate()}
                        className="bg-green-600 hover:bg-green-700 text-white gap-2 shadow-lg shadow-green-900/20"
                      >
                        <RefreshCcw className="h-4 w-4" />
                        Restart & Install
                      </Button>
                    ) : (
                      <Button 
                        variant="outline"
                        onClick={() => (window as any).api.checkForUpdates()}
                        disabled={updateStatus === 'checking' || updateStatus === 'downloading'}
                        className="gap-2"
                      >
                        {updateStatus === 'checking' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                        {updateStatus === 'error' ? 'Retry Check' : 'Check for Updates'}
                      </Button>
                    )}
                  </div>
                </div>

                {updateStatus === 'downloading' && (
                  <div className="px-1 space-y-1.5">
                    <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden border border-border/50">
                      <div 
                        className="h-full bg-primary transition-all duration-300 ease-out" 
                        style={{ width: `${updateProgress?.percent || 0}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* 6. Advanced */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-yellow-500 font-semibold text-lg px-1">
            <Terminal className="h-5 w-5" />
            Internal Controls
          </div>
          <Card>
            <CardContent className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">Developer Logging</div>
                  <div className="text-xs text-muted-foreground">Output verbose info to developer console.</div>
                </div>
                <Switch
                  checked={enableLog}
                  onCheckedChange={(val) => {
                    setEnableLog(val)
                    saveSetting('enable_log', val.toString())
                  }}
                />
              </div>

              <div className="pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-2 bg-green-500/10 text-green-500 px-2 py-1 rounded-full font-medium">
                  <CheckCircle2 className="h-3 w-3" />
                  Core SQLite Engine Active
                </div>
                <a
                  href="https://github.com/anasr/LManwa"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 hover:text-primary transition-colors underline underline-offset-4"
                >
                  GitHub Repository <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>

      {/* Floating Status Message */}
      {statusMessage && (
        <div className="fixed bottom-8 right-8 animate-in slide-in-from-right-4 duration-300 z-50">
          <Badge variant={statusMessage.includes('Failed') ? 'destructive' : 'default'} className="px-6 py-3 text-sm shadow-2xl border-2 border-background ring-4 ring-black/20">
            {statusMessage.includes('Failed') ? <AlertCircle className="mr-2 h-4 w-4" /> : <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {statusMessage}
          </Badge>
        </div>
      )}
    </div>
  )
}
