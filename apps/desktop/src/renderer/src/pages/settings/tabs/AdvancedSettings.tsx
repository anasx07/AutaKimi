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
  RefreshCcw,
  Download,
  Sparkles
} from 'lucide-react'
import { useState } from 'react'
import { useUIStore, useSettingsStore } from '@renderer/shared/model'
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
  statusMessage: string | null
  setStatusMessage: (msg: string | null) => void
}

export function AdvancedSettings({ statusMessage, setStatusMessage }: AdvancedSettingsProps): React.JSX.Element {
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
    setDownloadConcurrency
  } = useSettingsStore()

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

  return (
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
  )
}
