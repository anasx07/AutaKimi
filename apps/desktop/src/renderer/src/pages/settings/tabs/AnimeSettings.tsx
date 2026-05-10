import { Zap } from 'lucide-react'
import { useSettingsStore } from '@renderer/shared/model'
import { Card, Switch, SettingsRow, SectionHeader } from '@renderer/shared/ui'

export function AnimeSettings(): React.JSX.Element {
  const {
    autoNextAnime,
    setAutoNextAnime,
    autoSwitchServer,
    setAutoSwitchServer
  } = useSettingsStore()

  return (
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
  )
}
