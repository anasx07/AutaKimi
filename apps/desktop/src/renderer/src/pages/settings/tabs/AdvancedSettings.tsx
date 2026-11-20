import { useState } from 'react'
import {
  Shield,
  Globe,
  Clock,
  Trash2,
  Eraser,
  Cloud,
  Terminal,
  ExternalLink,
  RefreshCcw,
  Sparkles,
  Database,
  Download,
  Upload,
  Archive,
  Loader2
} from 'lucide-react'
import { useUIStore, useSettingsStore, useLibraryStore, useHistoryStore } from '@renderer/shared/model'
import { cn } from '@renderer/shared/lib/utils'
import {
  Button,
  Card,
  Input,
  Badge,
  Switch,
  Select,
  SettingsRow,
  SectionHeader
} from '@renderer/shared/ui'
import { DataService } from '@renderer/shared/api'

interface AdvancedSettingsProps {
  setStatusMessage: (msg: string | null) => void
}

export function AdvancedSettings({ setStatusMessage }: AdvancedSettingsProps): React.JSX.Element {
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const { updateStatus } = useUIStore()
  const {
    bypassCloudflare,
    setBypassCloudflare,
    userAgent,
    setUserAgent,
    timeoutInterval,
    setTimeoutInterval,
    enableLog,
    setEnableLog,
    downloadConcurrency,
    setDownloadConcurrency,
    devMode,
    setDevMode
  } = useSettingsStore()

  const handleClearCache = async () => {
    setStatusMessage('Clearing system cache...')
    try {
      await DataService.clearCache()
      setStatusMessage('Cache cleared successfully')
    } catch (e: any) {
      setStatusMessage(`Failed to clear cache: ${e.message}`)
    }
    setTimeout(() => setStatusMessage(null), 3000)
  }

  const handleClearCookies = async () => {
    setStatusMessage('Clearing cookies...')
    try {
      await DataService.clearCookies()
      setStatusMessage('Cookies cleared successfully')
    } catch (e: any) {
      setStatusMessage(`Failed to clear cookies: ${e.message}`)
    }
    setTimeout(() => setStatusMessage(null), 3000)
  }

  const handleExportBackup = async () => {
    setIsExporting(true)
    setStatusMessage('Exporting backup...')
    try {
      const res = await DataService.backup.export()
      if (res.canceled) {
        setStatusMessage(null)
        return
      }
      if (res.success && res.counts) {
        const { library, readingProgress, readingHistory, sourceRepositories } = res.counts
        setStatusMessage(
          `Backup exported successfully! (${library} titles, ${readingProgress} progress, ${readingHistory} history, ${sourceRepositories} repos)`
        )
      } else if (res.error) {
        setStatusMessage(`Export failed: ${res.error}`)
      }
    } catch (e: any) {
      setStatusMessage(`Export failed: ${e?.message || 'Unknown error'}`)
    } finally {
      setIsExporting(false)
      setTimeout(() => setStatusMessage(null), 5000)
    }
  }

  const handleImportBackup = async () => {
    setIsImporting(true)
    setStatusMessage('Selecting and restoring backup file...')
    try {
      const res = await DataService.backup.import()
      if (res.canceled) {
        setStatusMessage(null)
        return
      }
      if (res.success && res.counts) {
        const { library, readingProgress, readingHistory, sourceRepositories } = res.counts
        await Promise.all([
          useLibraryStore.getState().loadFromDb(),
          useHistoryStore.getState().loadHistory()
        ])
        setStatusMessage(
          `Backup restored successfully! (${library} titles, ${readingProgress} progress, ${readingHistory} history, ${sourceRepositories} repos)`
        )
      } else if (res.error) {
        setStatusMessage(`Import failed: ${res.error}`)
      }
    } catch (e: any) {
      setStatusMessage(`Import failed: ${e?.message || 'Unknown error'}`)
    } finally {
      setIsImporting(false)
      setTimeout(() => setStatusMessage(null), 5000)
    }
  }

  const handleCheckForUpdates = async () => {
    setIsCheckingUpdate(true)
    setStatusMessage('Checking for application updates...')
    try {
      await DataService.checkForUpdates()
      setTimeout(() => {
        setStatusMessage('Application is up to date')
        setTimeout(() => setStatusMessage(null), 3000)
      }, 1500)
    } catch (e: any) {
      setStatusMessage(`Update check failed: ${e.message}`)
      setTimeout(() => setStatusMessage(null), 3000)
    } finally {
      setIsCheckingUpdate(false)
    }
  }

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      {/* Network Configuration */}
      <section className="space-y-6">
        <SectionHeader title="Network Engine" icon={Globe} />
        <Card className="p-1 border-border/40 bg-card/30 backdrop-blur-md">
          <SettingsRow
            title={
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <span>Bypass Cloudflare</span>
              </div>
            }
            description="Use internal browser engine to navigate protection"
          >
            <Switch checked={bypassCloudflare} onCheckedChange={setBypassCloudflare} />
          </SettingsRow>

          <SettingsRow
            title={
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>Request Timeout</span>
              </div>
            }
            description="Global network timeout in milliseconds"
          >
            <Input
              type="number"
              value={timeoutInterval}
              onChange={(e) => setTimeoutInterval(e.target.value)}
              className="w-24 text-right font-mono"
            />
          </SettingsRow>

          <SettingsRow 
            title={
              <div className="flex items-center gap-2">
                <RefreshCcw className="h-4 w-4" />
                <span>Verbose Logging</span>
              </div>
            } 
            description="Enable detailed network and scraper logs in console"
          >
            <Switch checked={enableLog} onCheckedChange={setEnableLog} />
          </SettingsRow>

          <SettingsRow
            title={
              <div className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                <span>Download Concurrency</span>
              </div>
            }
            description="Simultaneous active chapter downloads (1 - 5)"
          >
            <div className="w-44">
              <Select
                value={downloadConcurrency.toString()}
                onValueChange={(val) => setDownloadConcurrency(parseInt(val))}
                options={[
                  { label: '1 (Low Bandwidth)', value: '1' },
                  { label: '2 Parallel', value: '2' },
                  { label: '3 Parallel (Default)', value: '3' },
                  { label: '4 Parallel', value: '4' },
                  { label: '5 Parallel (Fast)', value: '5' }
                ]}
              />
            </div>
          </SettingsRow>

          <SettingsRow
            title={
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4" />
                <span>Developer Mode</span>
              </div>
            }
            description="Enable local extensions development and advanced diagnostics"
          >
            <Switch checked={devMode} onCheckedChange={setDevMode} />
          </SettingsRow>
        </Card>
      </section>

      {/* User Agent */}
      <section className="space-y-6">
        <SectionHeader title="Browser Identity" icon={Terminal} />
        <Card className="p-6 border-border/40 bg-card/30 backdrop-blur-md space-y-4">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground opacity-50">
              Custom User-Agent String
            </label>
            <textarea
              className="w-full h-24 bg-secondary/30 border border-border/50 rounded-xl p-4 text-xs font-mono resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              value={userAgent}
              onChange={(e) => setUserAgent(e.target.value)}
              spellCheck={false}
            />
          </div>
          <div className="flex items-center justify-between pt-2">
            <p className="text-[10px] text-muted-foreground max-w-md italic">
              Advanced: Changing this can help bypass strict bot protection on some sources.
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="text-[10px] font-bold uppercase"
              onClick={() =>
                setUserAgent(
                  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                )
              }
            >
              Reset to Default
            </Button>
          </div>
        </Card>
      </section>

      {/* Storage Management */}
      <section className="space-y-6">
        <SectionHeader title="Storage & System" icon={Database} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-6 border-border/40 bg-card/30 backdrop-blur-md flex flex-col justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-primary">
                <Cloud className="h-4 w-4" />
                <h4 className="text-sm font-bold uppercase tracking-tight">Image Cache</h4>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Clear all locally cached manga pages and thumbnails to free up space.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 font-bold uppercase text-[10px]"
              onClick={handleClearCache}
            >
              <Eraser className="h-3 w-3" />
              Purge Cache
            </Button>
          </Card>

          <Card className="p-6 border-border/40 bg-card/30 backdrop-blur-md flex flex-col justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-amber-500">
                <Sparkles className="h-4 w-4" />
                <h4 className="text-sm font-bold uppercase tracking-tight">Session Data</h4>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Remove all stored cookies and site-specific session information.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 font-bold uppercase text-[10px]"
              onClick={handleClearCookies}
            >
              <Trash2 className="h-3 w-3" />
              Reset Cookies
            </Button>
          </Card>
        </div>

        {/* Data Backup & Restore */}
        <Card className="p-6 border-border/40 bg-card/30 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center gap-2 text-emerald-400">
              <Archive className="h-4 w-4" />
              <h4 className="text-sm font-bold uppercase tracking-tight">Data Backup & Migration</h4>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Export or restore your library, reading progress, reading history, source repositories, and trackers in a single compressed backup (<code className="text-foreground font-mono bg-secondary/40 px-1 py-0.5 rounded">.json.gz</code>) within an atomic database transaction.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 font-bold uppercase text-[10px] border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
              onClick={handleExportBackup}
              disabled={isExporting || isImporting}
            >
              {isExporting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Download className="h-3 w-3" />
              )}
              Export Backup (.json.gz)
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="gap-2 font-bold uppercase text-[10px] hover:bg-secondary/50"
              onClick={handleImportBackup}
              disabled={isExporting || isImporting}
            >
              {isImporting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Upload className="h-3 w-3" />
              )}
              Import Backup
            </Button>
          </div>
        </Card>
      </section>

      {/* Developer Information */}
      <section className="pt-10 border-t border-border/20 flex flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2">
          <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] px-3">
            v{DataService.version}-STABLE
          </Badge>
          <p className="text-[10px] text-muted-foreground opacity-40 uppercase font-black tracking-[0.3em]">
            AutaKimi Core Architecture
          </p>
        </div>
        <div className="flex gap-4">
          <Button
            variant="ghost"
            size="sm"
            className="text-[10px] font-bold uppercase tracking-widest gap-2 opacity-50 hover:opacity-100"
            onClick={() => DataService.openExternal('https://github.com/anasx07/AutaKimi')}
          >
            <ExternalLink className="h-3 w-3" />
            Source Code
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-[10px] font-bold uppercase tracking-widest gap-2 opacity-70 hover:opacity-100"
            onClick={handleCheckForUpdates}
            disabled={isCheckingUpdate}
          >
            <RefreshCcw className={cn('h-3 w-3', isCheckingUpdate && 'animate-spin')} />
            System Status: {updateStatus || 'Up to date'}
          </Button>
        </div>
      </section>
    </div>
  )
}
