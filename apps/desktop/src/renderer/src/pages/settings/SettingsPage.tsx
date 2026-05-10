import {
  Loader2,
  BookOpen,
  Settings2,
  Zap,
  ChevronRight
} from 'lucide-react'
import { useState } from 'react'
import { ThemeType, ColorThemeType } from '@common/types'
import { isMobile } from '@renderer/shared/platform'
import { cn } from '@renderer/shared/lib/utils'
import { useSettingsStore } from '@renderer/shared/model'
import {
  Badge,
  Card,
  CardContent,
  MobilePage
} from '@renderer/shared/ui'
import { ThemeOption } from '@renderer/shared/config/themes'
import { GeneralSettings } from './tabs/GeneralSettings'
import { ReadingSettings } from './tabs/ReadingSettings'
import { AnimeSettings } from './tabs/AnimeSettings'
import { AdvancedSettings } from './tabs/AdvancedSettings'
import { SyncSettings } from './tabs/SyncSettings'
import { SourceSettings } from './tabs/SourceSettings'
import { Share2, Globe } from 'lucide-react'

type SettingsTab = 'general' | 'reading' | 'anime' | 'sync' | 'sources' | 'advanced'

const sidebarItems: { id: SettingsTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'general', label: 'General', icon: Settings2 },
  { id: 'reading', label: 'Reading', icon: BookOpen },
  { id: 'anime', label: 'Anime', icon: Zap },
  { id: 'sync', label: 'Sync', icon: Share2 },
  { id: 'sources', label: 'Sources', icon: Globe },
  { id: 'advanced', label: 'Advanced', icon: Zap }
]

interface SidebarItemProps {
  id: SettingsTab
  label: string
  icon: React.ComponentType<{ className?: string }>
  activeTab: SettingsTab
  setActiveTab: (id: SettingsTab) => void
}

function SidebarItem({ id, label, icon: Icon, activeTab, setActiveTab }: SidebarItemProps): React.JSX.Element {
  return (
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
      case 'sync':
        return <SyncSettings />
      case 'sources':
        return <SourceSettings />
      case 'advanced':
        return <AdvancedSettings setStatusMessage={setStatusMessage} />
    }
  }

  const statusBadge = statusMessage ? (
    <div className="fixed bottom-10 right-10 animate-in slide-in-from-right-8 duration-500 z-50">
      <Badge
        variant={statusMessage.includes('Failed') ? 'destructive' : 'default'}
        className="px-8 py-4 text-sm font-black uppercase tracking-widest shadow-2xl border-2 border-border/20 backdrop-blur-3xl ring-4 ring-black/10"
      >
        {statusMessage.includes('Failed') ? (
          <Loader2 className="mr-3 h-5 w-5 animate-spin" />
        ) : (
          <Loader2 className="mr-3 h-5 w-5 animate-spin" />
        )}
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

      {statusBadge}
    </div>
  )
}
