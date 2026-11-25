import { useState, useEffect, useCallback } from 'react'
import {
  Palette,
  Monitor,
  Sparkles,
  SlidersHorizontal,
  Gamepad2,
  ExternalLink,
  RefreshCw
} from 'lucide-react'
import { useSettingsStore } from '@renderer/shared/model'
import { DataService } from '@renderer/shared/api'
import type { DiscordRpcStatus } from '@common/utils/discordPresence'
import {
  Badge,
  Button,
  Card,
  Input,
  Switch,
  Select,
  SettingsRow,
  SectionHeader
} from '@renderer/shared/ui'
import { DEFAULT_THEMES, PREMIUM_THEMES, ThemeOption } from '@renderer/shared/config/themes'
import { ThemeCard } from '../components/ThemeCard'
import { CustomThemeStudio } from '../components/CustomThemeStudio'

interface GeneralSettingsProps {
  onThemeSelect: (opt: ThemeOption) => void
}

export function GeneralSettings({ onThemeSelect }: GeneralSettingsProps): React.JSX.Element {
  const [isStudioOpen, setIsStudioOpen] = useState(false)
  const {
    theme,
    colorTheme,
    customThemeConfig,
    setTheme,
    displayMode,
    setDisplayMode,
    showNsfw,
    setShowNsfw,
    lockMediaTabs,
    setLockMediaTabs,
    discordRpcEnabled,
    setDiscordRpcEnabled,
    discordRpcClientId,
    setDiscordRpcClientId
  } = useSettingsStore()

  const [rpcClientDraft, setRpcClientDraft] = useState(discordRpcClientId || '')
  const [rpcStatus, setRpcStatus] = useState<DiscordRpcStatus | null>(null)

  useEffect(() => {
    setRpcClientDraft(discordRpcClientId || '')
  }, [discordRpcClientId])

  const refreshRpcStatus = useCallback(async () => {
    try {
      const status = await DataService.discord.getStatus()
      setRpcStatus(status)
    } catch {
      setRpcStatus(null)
    }
  }, [])

  useEffect(() => {
    void refreshRpcStatus()
  }, [discordRpcEnabled, discordRpcClientId, refreshRpcStatus])

  const handleSelect = (opt: ThemeOption) => {
    onThemeSelect(opt)
    if (opt.colorTheme === 'custom') {
      setIsStudioOpen(true)
    }
  }

  return (
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

        {/* Top Themes Grid (Default Dark, Default Light, Custom Theme) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {DEFAULT_THEMES.map((opt) => (
            <ThemeCard
              key={opt.id}
              opt={opt}
              isActive={
                opt.colorTheme === 'custom'
                  ? colorTheme === 'custom'
                  : theme === opt.theme && colorTheme === opt.colorTheme
              }
              onSelect={handleSelect}
            />
          ))}
        </div>

        {/* Compact Bar when Custom Theme is active (Replaces the huge expanded block) */}
        {colorTheme === 'custom' && (
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-primary/30 bg-primary/5 animate-in fade-in duration-300">
            <div className="flex items-center gap-3">
              <div
                className="w-4 h-4 rounded-full shadow-sm ring-2 ring-primary/40 shrink-0"
                style={{ backgroundColor: customThemeConfig?.accent || '#E11D48' }}
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground">Custom Theme Active</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                    MYO
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Accent:{' '}
                  <span className="font-mono text-foreground font-semibold">
                    {customThemeConfig?.accent || '#E11D48'}
                  </span>{' '}
                  · Font:{' '}
                  <span className="text-foreground font-semibold">
                    {customThemeConfig?.font || 'Plus Jakarta Sans'}
                  </span>
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsStudioOpen(true)}
              className="h-8 text-xs font-bold gap-1.5 border-primary/30 hover:bg-primary/10 shadow-sm"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-primary" /> Customize Theme
            </Button>
          </div>
        )}

        {/* Modal Studio Dialog (Only opens on click) */}
        <CustomThemeStudio isOpen={isStudioOpen} onClose={() => setIsStudioOpen(false)} />

        <div className="space-y-4 pt-4">
          <h3 className="text-xs font-black flex items-center gap-2 uppercase tracking-[0.2em] text-amber-500 pl-1">
            <Sparkles className="h-4 w-4" /> Premium Themes
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {PREMIUM_THEMES.map((opt) => (
              <ThemeCard
                key={opt.id}
                opt={opt}
                isPremium
                isActive={
                  colorTheme !== 'custom' && theme === opt.theme && colorTheme === opt.colorTheme
                }
                onSelect={handleSelect}
              />
            ))}
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
          <SettingsRow title="Show NSFW Sources" description="Display 18+ extensions and content.">
            <Switch checked={showNsfw} onCheckedChange={setShowNsfw} />
          </SettingsRow>
          <SettingsRow
            title="Lock Media Tabs"
            description="Sync Manga/Anime tab selection across Browse, Library, Downloads, and History."
          >
            <Switch checked={lockMediaTabs} onCheckedChange={setLockMediaTabs} />
          </SettingsRow>
        </Card>
      </section>

      <section className="space-y-6">
        <SectionHeader title="Discord Rich Presence" icon={Gamepad2}>
          <div className="flex items-center gap-2">
            {discordRpcEnabled ? (
              rpcStatus?.connected ? (
                <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]">
                  Connected
                </Badge>
              ) : (
                <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px]">
                  {rpcStatus?.hasClientId ? 'Waiting for Discord' : 'Client ID Needed'}
                </Badge>
              )
            ) : (
              <Badge variant="secondary" className="text-[10px]">
                Disabled
              </Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void refreshRpcStatus()}
              className="h-8 w-8"
              title="Refresh Discord connection status"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </SectionHeader>
        <Card className="border-border bg-card divide-y divide-border overflow-hidden">
          <SettingsRow
            title="Enable Discord Rich Presence"
            description='Show what you are watching or reading (e.g. "Watching Solo Leveling • Ep 4" or "Reading Vagabond • Ch 120") on your Discord profile.'
          >
            <Switch
              checked={discordRpcEnabled}
              onCheckedChange={async (checked) => {
                await setDiscordRpcEnabled(checked)
                await refreshRpcStatus()
              }}
            />
          </SettingsRow>

          {discordRpcEnabled && (
            <div className="p-6 space-y-4 bg-muted/10">
              <div className="flex flex-col sm:flex-row sm:items-end gap-3 justify-between">
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-bold">Discord Application Client ID</label>
                    <button
                      type="button"
                      onClick={() =>
                        DataService.openExternal('https://discord.com/developers/applications')
                      }
                      className="text-[11px] font-semibold text-primary hover:underline inline-flex items-center gap-1"
                    >
                      Developer Portal <ExternalLink className="h-3 w-3" />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Create a Discord Application and paste its Application ID here to broadcast live
                    watching &amp; reading activity via Discord Desktop IPC.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    value={rpcClientDraft}
                    onChange={(e) => setRpcClientDraft(e.target.value)}
                    placeholder="e.g. 1234567890123456789"
                    className="w-56 font-mono text-xs"
                  />
                  <Button
                    size="sm"
                    onClick={async () => {
                      await setDiscordRpcClientId(rpcClientDraft)
                      await refreshRpcStatus()
                    }}
                  >
                    Save
                  </Button>
                </div>
              </div>

              {rpcStatus?.lastError && !rpcStatus.connected && (
                <p className="text-xs text-amber-400 font-medium">{rpcStatus.lastError}</p>
              )}

              <div className="rounded-xl border border-border/70 bg-background/60 px-4 py-3 text-xs text-muted-foreground flex flex-wrap items-center gap-2">
                <span className="font-bold text-foreground">Preview:</span>
                <span className="px-2 py-0.5 rounded bg-secondary font-mono text-[11px] text-foreground">
                  Watching Solo Leveling • Ep 4
                </span>
                <span>or</span>
                <span className="px-2 py-0.5 rounded bg-secondary font-mono text-[11px] text-foreground">
                  Reading Vagabond • Ch 120
                </span>
              </div>
            </div>
          )}
        </Card>
      </section>
    </div>
  )
}
