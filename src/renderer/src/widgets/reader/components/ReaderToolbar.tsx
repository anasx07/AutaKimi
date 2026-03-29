import { ArrowLeft, ExternalLink, Play, Pause, Hand } from 'lucide-react'
import { Button, Select } from '@renderer/shared/ui'
import { ReadingMode } from '@renderer/shared/model'
import { cn } from '@renderer/shared/lib/utils'
import { memo } from 'react'

interface ReaderToolbarProps {
  chapterNumber: string | number
  chapterTitle?: string
  extensionName: string
  chapterUrl: string
  currentPage: number
  totalPages: number
  isInfiniteScroll: boolean
  autoScrollEnabled: boolean
  autoScrollSpeed: number
  isKbdPaused: boolean
  dragToScroll: boolean
  readingMode: ReadingMode
  readerTheme?: string
  onReadingModeChange: (mode: ReadingMode) => void
  onClose: () => void
  onOpenInBrowser: () => void
  onToggleAutoScroll: () => void
  onChangeAutoScrollSpeed: (speed: number) => void
}

export const ReaderToolbar = memo(({
  chapterNumber,
  chapterTitle,
  extensionName,
  chapterUrl,
  currentPage,
  totalPages,
  isInfiniteScroll,
  autoScrollEnabled,
  autoScrollSpeed,
  isKbdPaused,
  dragToScroll,
  readingMode,
  readerTheme,
  onReadingModeChange,
  onClose,
  onOpenInBrowser,
  onToggleAutoScroll,
  onChangeAutoScrollSpeed
}: ReaderToolbarProps) => {
  const toolbarBg = readerTheme === 'match-app' ? "bg-background/90 border-border" :
    readerTheme === 'light' ? "bg-white/90 border-slate-200" :
    "bg-neutral-900/90 border-neutral-800/50"

  const textTitle = readerTheme === 'light' ? "text-slate-900" : readerTheme === 'match-app' ? "text-foreground" : "text-neutral-100"
  const textSub = readerTheme === 'light' ? "text-slate-500" : "text-neutral-500"

  return (
    <div className={cn("h-14 backdrop-blur-xl border-b px-4 flex items-center justify-between flex-shrink-0 z-20 relative transition-colors", toolbarBg)}>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onClose} className={cn("h-9 w-9", textSub, "hover:bg-black/5")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex flex-col">
          <span className={cn("text-sm font-bold truncate max-w-[200px] sm:max-w-md", textTitle)}>
            Chapter {chapterNumber} {chapterTitle ? `• ${chapterTitle}` : ''}
          </span>
          <button 
            onClick={onOpenInBrowser} 
            className={cn("text-[10px] font-mono tracking-wider uppercase flex items-center gap-2 transition-colors group truncate max-w-[200px] sm:max-w-md", textSub, "hover:text-primary")} 
            title={chapterUrl}
          >
            {extensionName} • {chapterUrl} 
            <ExternalLink className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          </button>
        </div>
      </div>

      {/* ── Center: Chapter & Page indicator ── */}
      <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center select-none pointer-events-none">
        <span className={cn("text-[11px] font-black tracking-widest uppercase", textTitle)}>
          Ch.&nbsp;{chapterNumber}
        </span>
        {totalPages > 0 ? (
          <span className="text-[9px] text-primary font-bold tracking-wider tabular-nums">
            {currentPage}&nbsp;/&nbsp;{totalPages}
          </span>
        ) : (
          <span className="text-[9px] text-neutral-500 font-semibold tracking-wider">
            {isInfiniteScroll ? 'Loading…' : ''}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1">
        {isInfiniteScroll && (
          <div className="flex items-center gap-0.5 px-2 mr-2 border-r border-neutral-800 animate-in slide-in-from-right-4 group relative">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onToggleAutoScroll} 
              className={cn("h-8 w-8 transition-colors", autoScrollEnabled ? "text-primary bg-primary/10" : "text-neutral-500")}
            >
              {(autoScrollEnabled && !isKbdPaused) ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            {autoScrollEnabled && (
              <select 
                value={autoScrollSpeed} 
                onChange={e => onChangeAutoScrollSpeed(parseInt(e.target.value))} 
                className="bg-transparent text-[10px] font-bold text-primary outline-none py-1 px-1 cursor-pointer hover:bg-white/5 rounded transition-all appearance-none text-center min-w-[30px]"
              >
                {[1,2,3,4,5,6,7,8,9,10].map(s => <option key={s} value={s} className="bg-neutral-900">x{s}</option>)}
              </select>
            )}
            {isKbdPaused && (
              <span className="absolute -top-6 right-0 bg-primary/20 text-primary text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest animate-pulse border border-primary/30 backdrop-blur-sm shadow-2xl">
                Paused
              </span>
            )}
          </div>
        )}
        {dragToScroll && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-800/50 text-primary/80 border border-white/5 text-[10px] uppercase font-black">
            <Hand className="h-3.5 w-3.5" /> Drag On
          </div>
        )}
        <div className="ml-1 w-44">
          <Select 
            options={[
              { value: 'continuous-vertical', label: 'Continuous Vertical' },
              { value: 'webtoon', label: 'Webtoon' },
              { value: 'paged-ltr', label: 'Paged LTR' },
              { value: 'paged-rtl', label: 'Paged RTL' },
              { value: 'paged-vertical', label: 'Paged Vertical' },
              { value: 'continuous-ltr', label: 'Continuous LTR' },
              { value: 'continuous-rtl', label: 'Continuous RTL' }
            ]}
            value={readingMode}
            onValueChange={(val) => onReadingModeChange(val as ReadingMode)}
            className={cn("h-8 text-[10px] uppercase font-bold tracking-wider rounded-full pl-3 pr-2 shadow-inner border border-black/5 hover:bg-black/5",
              readerTheme === 'light' ? 'bg-slate-100/50 text-slate-700' : 'bg-neutral-800/50 hover:bg-neutral-800 text-neutral-300'
            )}
          />
        </div>
      </div>
    </div>
  )
})
