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
  Database
} from 'lucide-react'
import { useUIStore, useSettingsStore } from '@renderer/shared/model'
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
  const { updateStatus } = useUIStore()
  const {
    bypassCloudflare,
    setBypassCloudflare,
    userAgent,
    setUserAgent,
    timeoutInterval,
    setTimeoutInterval
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
                <span>Logging</span>
              </div>
            } 
            description="Enable detailed network logs in console"
          >
             <Select
              value="disabled"
              onValueChange={() => {}}
              options={[
                { label: 'Disabled', value: 'disabled' },
                { label: 'Enabled', value: 'enabled' }
              ]}
              className="w-32"
            />
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
            className="text-[10px] font-bold uppercase tracking-widest gap-2 opacity-50 hover:opacity-100"
          >
            <RefreshCcw className="h-3 w-3" />
            System Status: {updateStatus}
          </Button>
        </div>
      </section>
    </div>
  )
}
