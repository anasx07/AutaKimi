import { Palette, Monitor, Sparkles } from 'lucide-react'
import { useSettingsStore } from '@renderer/shared/model'
import {
  Button,
  Card,
  Switch,
  Select,
  SettingsRow,
  SectionHeader
} from '@renderer/shared/ui'
import { DEFAULT_THEMES, PREMIUM_THEMES, ThemeOption } from '@renderer/shared/config/themes'
import { ThemeCard } from '../components/ThemeCard'

interface GeneralSettingsProps {
  onThemeSelect: (opt: ThemeOption) => void
}

export function GeneralSettings({ onThemeSelect }: GeneralSettingsProps): React.JSX.Element {
  const {
    theme,
    colorTheme,
    setTheme,
    displayMode,
    setDisplayMode,
    showNsfw,
    setShowNsfw,
    minimizeToTray,
    setMinimizeToTray
  } = useSettingsStore()

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {DEFAULT_THEMES.map((opt) => (
            <ThemeCard
              key={opt.id}
              opt={opt}
              isActive={theme === opt.theme && colorTheme === opt.colorTheme}
              onSelect={onThemeSelect}
            />
          ))}
        </div>
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
                isActive={theme === opt.theme && colorTheme === opt.colorTheme}
                onSelect={onThemeSelect}
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
  )
}
