import { Loader2, BookOpen, Settings2, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { ThemeType, ColorThemeType } from '@common/types'
import { isMobile } from '@renderer/shared/platform'
import { cn } from '@renderer/shared/lib/utils'
import { useSettingsStore } from '@renderer/shared/model'
import { Badge, Card, CardContent, MobilePage } from '@renderer/shared/ui'
import { ThemeOption } from '@renderer/shared/config/themes'
import { GeneralSettings } from './tabs/GeneralSettings'
import { ReadingSettings } from './tabs/ReadingSettings'
import { AnimeSettings } from './tabs/AnimeSettings'
import { AdvancedSettings } from './tabs/AdvancedSettings'
import { SyncSettings } from './tabs/SyncSettings'
import { WrappedStats } from './tabs/WrappedStats'
import { Share2, Terminal, Film, BarChart3 } from 'lucide-react'

type SettingsTab = 'general' | 'reading' | 'anime' | 'stats' | 'sync' | 'advanced'

const sidebarItems: {
  id: SettingsTab
  label: string
  icon: React.ComponentType<{ className?: string }>
}[] = [
  { id: 'general', label: 'General', icon: Settings2 },
  { id: 'reading', label: 'Reading', icon: BookOpen },
  { id: 'anime', label: 'Anime', icon: Film },
  { id: 'stats', label: 'Wrapped', icon: BarChart3 },
  { id: 'sync', label: 'Sync', icon: Share2 },
  { id: 'advanced', label: 'Advanced', icon: Terminal }
]

interface SidebarItemProps {
  id: SettingsTab
  label: string
  icon: React.ComponentType<{ className?: string }>
  activeTab: SettingsTab
  setActiveTab: (id: SettingsTab) => void
}

function SidebarItem({
  id,
  label,
  icon: Icon,
  activeTab,
  setActiveTab
}: SidebarItemProps): React.JSX.Element {
  return (
    <button
      id={`settings-tab-${id}`}
      onClick={() => setActiveTab(id)}
      className={cn(
        'w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors duration-150 group relative border',
        activeTab === id
          ? 'bg-secondary border-border text-foreground font-semibold'
          : 'border-transparent text-muted-foreground hover:bg-secondary/40 hover:text-foreground'
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={cn(
            'w-8 h-8 rounded-md flex items-center justify-center transition-colors duration-150 shrink-0',
            activeTab === id
              ? 'bg-primary/15 text-primary'
              : 'bg-secondary/70 text-muted-foreground group-hover:text-foreground'
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-[13px] truncate">{label}</span>
      </div>
      <ChevronRight
        className={cn(
          'h-3.5 w-3.5 shrink-0 transition-opacity duration-150',
          activeTab === id ? 'opacity-60 text-foreground' : 'opacity-0 group-hover:opacity-40'
        )}
      />
    </button>
  )
}

export default function SettingsPage(): React.JSX.Element {
  const { setTheme, setColorTheme } = useSettingsStore()

  const [activeTab, setActiveTab] = useState<SettingsTab>('general')
  const [showMobileMenu, setShowMobileMenu] = useState(true)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  const handleThemeSelect = (opt: ThemeOption): void => {
    setTheme(opt.theme as ThemeType)
    setColorTheme(opt.colorTheme as ColorThemeType)
  }

  const handleTabSelect = (id: SettingsTab): void => {
    setActiveTab(id)
    if (isMobile()) setShowMobileMenu(false)
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'general':
        return <GeneralSettings onThemeSelect={handleThemeSelect} />
      case 'reading':
        return <ReadingSettings />
      case 'anime':
        return <AnimeSettings />
      case 'stats':
        return <WrappedStats />
      case 'sync':
        return <SyncSettings />
      case 'advanced':
        return <AdvancedSettings setStatusMessage={setStatusMessage} />
    }
  }

  const statusBadge = statusMessage ? (
    <div className="fixed bottom-6 right-6 animate-in slide-in-from-right-4 duration-200 z-50">
      <Badge
        variant={statusMessage.includes('Failed') ? 'destructive' : 'default'}
        className="px-4 py-2 text-xs font-medium rounded-lg shadow-lg border border-border"
      >
        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
        {statusMessage}
      </Badge>
    </div>
  ) : null

  if (isMobile()) {
    if (showMobileMenu) {
      return (
        <MobilePage title="Settings" subtitle="Configure preferences">
          <nav className="space-y-3 pt-4">
            {sidebarItems.map((item) => (
              <SidebarItem
                key={item.id}
                id={item.id}
                label={item.label}
                icon={item.icon}
                activeTab={activeTab}
                setActiveTab={handleTabSelect}
              />
            ))}
          </nav>
        </MobilePage>
      )
    }

    return (
      <MobilePage
        title={activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
        subtitle="Configuration"
        onBack={() => setShowMobileMenu(true)}
      >
        <div className="p-4">{renderContent()}</div>
        {statusBadge}
      </MobilePage>
    )
  }

  return (
    <div className="flex h-full bg-background overflow-hidden">
      <aside className="w-64 border-r border-border bg-card/40 flex flex-col p-5 gap-6 shrink-0">
        <div className="shrink-0 flex flex-col space-y-0.5 px-1">
          <h1 className="text-xl font-bold tracking-tight text-foreground">Settings</h1>
          <p className="text-muted-foreground text-xs">Configure preferences</p>
        </div>

        <nav className="flex-1 space-y-1 font-medium">
          {sidebarItems.map((item) => (
            <SidebarItem
              key={item.id}
              id={item.id}
              label={item.label}
              icon={item.icon}
              activeTab={activeTab}
              setActiveTab={handleTabSelect}
            />
          ))}
        </nav>

        <Card className="border-border bg-card shadow-none">
          <CardContent className="p-3.5 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-xs font-medium text-foreground">Core Engine Active</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Reading state and library are stored locally in SQLite.
            </p>
          </CardContent>
        </Card>
      </aside>

      <main className="flex-1 overflow-y-auto custom-scrollbar scroll-smooth">
        <div className="p-8 max-w-4xl mx-auto pb-16">{renderContent()}</div>
      </main>

      {statusBadge}
    </div>
  )
}
