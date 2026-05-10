import { BookOpen, Terminal, MoveHorizontal, Rows, Zap, ArrowUpDown } from 'lucide-react'
import { useReaderStore } from '@renderer/shared/model'
import { ReadingMode } from '@common/types'
import { cn } from '@renderer/shared/lib/utils'
import {
  Card,
  Input,
  Switch,
  Select,
  SettingsRow,
  SectionHeader
} from '@renderer/shared/ui'
import { ShortcutInput } from '../components/ShortcutInput'

export function ReadingSettings(): React.JSX.Element {
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

  const readingModes = [
    { id: 'paged-ltr' as ReadingMode, label: 'Paged LTR', icon: <MoveHorizontal className="h-4 w-4" /> },
    { id: 'paged-rtl' as ReadingMode, label: 'Paged RTL', icon: <MoveHorizontal className="h-4 w-4 rotate-180" /> },
    { id: 'paged-vertical' as ReadingMode, label: 'Paged Vert', icon: <ArrowUpDown className="h-4 w-4" /> },
    { id: 'continuous-vertical' as ReadingMode, label: 'Continuous', icon: <Rows className="h-4 w-4" /> },
    { id: 'webtoon' as ReadingMode, label: 'Webtoon', icon: <Zap className="h-4 w-4 text-primary animate-pulse" /> }
  ]

  return (
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
              {readingModes.map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => setReadingMode(mode.id)}
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
  )
}
