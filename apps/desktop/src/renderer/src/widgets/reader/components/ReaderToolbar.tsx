import {
  ArrowLeft,
  ExternalLink,
  Play,
  Pause,
  Hand,
  Share2,
  Crop,
  ZoomIn,
  PanelTopClose,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Moon
} from 'lucide-react'
import { Button, Select } from '@renderer/shared/ui'
import { ReadingMode } from '@renderer/shared/model'
import { EyeCareTintPreset } from '@common/types'
import { EYE_CARE_PRESETS, MAX_EYE_CARE_DIMMING, MAX_EYE_CARE_WARMTH } from '@common/utils/eyeCare'
import { DataService } from '@renderer/shared/api'
import { Chapter } from '@renderer/shared/api/sources/types'
import { cn } from '@renderer/shared/lib/utils'
import { memo, useEffect, useRef, useState } from 'react'

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
  cropBorders?: boolean
  zoomLevel?: number
  isZenMode?: boolean
  eyeCareEnabled?: boolean
  eyeCareTint?: EyeCareTintPreset
  eyeCareWarmth?: number
  eyeCareDimming?: number
  onToggleEyeCare?: () => void
  onApplyEyeCarePreset?: (preset: EyeCareTintPreset) => void
  onChangeEyeCareWarmth?: (warmth: number) => void
  onChangeEyeCareDimming?: (dimming: number) => void
  chapters?: Chapter[]
  activeChapterId?: string
  hasPrevChapter?: boolean
  hasNextChapter?: boolean
  onPrevChapter?: () => void
  onNextChapter?: () => void
  onSelectChapter?: (chapterId: string) => void
  onToggleZenMode?: () => void
  onResetZoom?: () => void
  onToggleCropBorders?: () => void
  onReadingModeChange: (mode: ReadingMode) => void
  onClose: () => void
  onOpenInBrowser: () => void
  onToggleAutoScroll: () => void
  onChangeAutoScrollSpeed: (speed: number) => void
  onShare: () => void
}

export const ReaderToolbar = memo(
  ({
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
    cropBorders = false,
    zoomLevel = 1,
    isZenMode = false,
    eyeCareEnabled = false,
    eyeCareTint = 'sepia',
    eyeCareWarmth = 45,
    eyeCareDimming = 30,
    onToggleEyeCare,
    onApplyEyeCarePreset,
    onChangeEyeCareWarmth,
    onChangeEyeCareDimming,
    chapters = [],
    activeChapterId,
    hasPrevChapter = false,
    hasNextChapter = false,
    onPrevChapter,
    onNextChapter,
    onSelectChapter,
    onToggleZenMode,
    onResetZoom,
    onToggleCropBorders,
    onReadingModeChange,
    onClose,
    onOpenInBrowser,
    onToggleAutoScroll,
    onChangeAutoScrollSpeed,
    onShare
  }: ReaderToolbarProps) => {
    const platform = DataService.platform
    const [showEyeCareMenu, setShowEyeCareMenu] = useState(false)
    const eyeCareMenuRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
      if (!showEyeCareMenu) return
      const handleOutsideClick = (e: MouseEvent) => {
        if (eyeCareMenuRef.current && !eyeCareMenuRef.current.contains(e.target as Node)) {
          setShowEyeCareMenu(false)
        }
      }
      document.addEventListener('mousedown', handleOutsideClick)
      return () => document.removeEventListener('mousedown', handleOutsideClick)
    }, [showEyeCareMenu])
    const toolbarBg =
      readerTheme === 'match-app'
        ? 'bg-background/90 border-border'
        : readerTheme === 'light'
          ? 'bg-white/90 border-slate-200'
          : 'bg-neutral-900/90 border-neutral-800/50'

    const textTitle =
      readerTheme === 'light'
        ? 'text-slate-900'
        : readerTheme === 'match-app'
          ? 'text-foreground'
          : 'text-neutral-100'
    const textSub = readerTheme === 'light' ? 'text-slate-500' : 'text-neutral-500'

    return (
      <div
        className={cn(
          'h-14 backdrop-blur-xl border-b px-4 flex items-center justify-between flex-shrink-0 z-20 relative transition-colors select-none',
          platform === 'win32' && 'pr-[144px]',
          platform === 'darwin' && 'pl-20',
          toolbarBg
        )}
        style={{ WebkitAppRegion: 'drag' } as any}
      >
        <div className="flex items-center gap-3" style={{ WebkitAppRegion: 'no-drag' } as any}>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className={cn('h-9 w-9', textSub, 'hover:bg-black/5')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex flex-col">
            <span className={cn('text-sm font-bold truncate max-w-[200px] sm:max-w-md', textTitle)}>
              Chapter {chapterNumber} {chapterTitle ? `• ${chapterTitle}` : ''}
            </span>
            <button
              onClick={onOpenInBrowser}
              className={cn(
                'text-[10px] font-mono tracking-wider uppercase flex items-center gap-2 transition-colors group truncate max-w-[200px] sm:max-w-md',
                textSub,
                'hover:text-primary'
              )}
              title={chapterUrl}
            >
              {extensionName} • {chapterUrl}
              <ExternalLink className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            </button>
          </div>
        </div>

        {/* ── Center: Chapter Switcher (< Prev | Ch. Dropdown | Next >) & Page indicator ── */}
        <div
          className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1 select-none"
          style={{ WebkitAppRegion: 'no-drag' } as any}
        >
          {/* Prev Chapter Button */}
          {onPrevChapter && (
            <Button
              variant="ghost"
              size="icon"
              disabled={!hasPrevChapter}
              onClick={onPrevChapter}
              className={cn(
                'h-7 w-7 rounded-full transition-colors',
                textSub,
                'hover:text-primary hover:bg-black/5 disabled:opacity-20'
              )}
              title="Previous Chapter ([)"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}

          {/* Chapter Selector Dropdown / Badge */}
          <div className="flex flex-col items-center px-1">
            {chapters && chapters.length > 1 && onSelectChapter ? (
              <div className="relative flex items-center group/ch">
                <select
                  value={activeChapterId}
                  onChange={(e) => onSelectChapter(e.target.value)}
                  className={cn(
                    'bg-transparent text-[11px] font-black tracking-wider uppercase cursor-pointer outline-none appearance-none pr-3.5 py-0.5 text-center transition-colors max-w-[130px] sm:max-w-[180px] truncate',
                    textTitle,
                    'group-hover/ch:text-primary'
                  )}
                  title="Switch Chapter (or use [ and ])"
                >
                  {chapters.map((ch) => (
                    <option
                      key={ch.id}
                      value={ch.id}
                      className="bg-neutral-900 text-white font-sans text-xs"
                    >
                      Ch. {ch.number} {ch.title ? `• ${ch.title}` : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown className="h-2.5 w-2.5 absolute right-0 text-neutral-400 pointer-events-none group-hover/ch:text-primary transition-colors" />
              </div>
            ) : (
              <span className={cn('text-[11px] font-black tracking-widest uppercase', textTitle)}>
                Ch.&nbsp;{chapterNumber}
              </span>
            )}

            {totalPages > 0 ? (
              <span className="text-[9px] text-primary font-bold tracking-wider tabular-nums leading-none">
                {currentPage}&nbsp;/&nbsp;{totalPages}
              </span>
            ) : (
              <span className="text-[9px] text-neutral-500 font-semibold tracking-wider leading-none">
                {isInfiniteScroll ? 'Loading…' : ''}
              </span>
            )}
          </div>

          {/* Next Chapter Button */}
          {onNextChapter && (
            <Button
              variant="ghost"
              size="icon"
              disabled={!hasNextChapter}
              onClick={onNextChapter}
              className={cn(
                'h-7 w-7 rounded-full transition-colors',
                textSub,
                'hover:text-primary hover:bg-black/5 disabled:opacity-20'
              )}
              title="Next Chapter (])"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as any}>
          {isInfiniteScroll && (
            <div className="flex items-center gap-0.5 px-2 mr-2 border-r border-neutral-800 animate-in slide-in-from-right-4 group relative">
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleAutoScroll}
                className={cn(
                  'h-8 w-8 transition-colors',
                  autoScrollEnabled ? 'text-primary bg-primary/10' : 'text-neutral-500'
                )}
              >
                {autoScrollEnabled && !isKbdPaused ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
              {autoScrollEnabled && (
                <select
                  value={autoScrollSpeed}
                  onChange={(e) => onChangeAutoScrollSpeed(parseInt(e.target.value))}
                  className="bg-transparent text-[10px] font-bold text-primary outline-none py-1 px-1 cursor-pointer hover:bg-white/5 rounded transition-all appearance-none text-center min-w-[30px]"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((s) => (
                    <option key={s} value={s} className="bg-neutral-900">
                      x{s}
                    </option>
                  ))}
                </select>
              )}
              {isKbdPaused && (
                <span className="absolute -top-6 right-0 bg-primary/20 text-primary text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest animate-pulse border border-primary/30 backdrop-blur-sm shadow-2xl">
                  Paused
                </span>
              )}
            </div>
          )}
          {isInfiniteScroll && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleCropBorders}
              className={cn(
                'h-9 w-9 transition-colors',
                cropBorders
                  ? 'text-primary bg-primary/10 border border-primary/30'
                  : cn(textSub, 'hover:text-primary hover:bg-primary/10')
              )}
              title={
                cropBorders
                  ? 'Crop Borders: Enabled (Click to disable)'
                  : 'Crop Borders / Smart Trim (Webtoon)'
              }
            >
              <Crop className="h-4 w-4" />
            </Button>
          )}
          {dragToScroll && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-800/50 text-primary/80 border border-white/5 text-[10px] uppercase font-black">
              <Hand className="h-3.5 w-3.5" /> Drag On
            </div>
          )}
          {/* Zoom Indicator */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onResetZoom}
            className={cn(
              'h-8 px-2 flex items-center gap-1 text-[11px] font-mono font-bold rounded-full transition-all border',
              zoomLevel !== 1
                ? 'text-primary bg-primary/10 border-primary/40 hover:bg-primary/20 shadow-sm'
                : cn(textSub, 'border-transparent hover:text-primary hover:bg-black/5')
            )}
            title={
              zoomLevel !== 1
                ? `Zoom: ${Math.round(zoomLevel * 100)}% (Click or Ctrl+0 to reset to 100%)`
                : 'Zoom: 100% (Ctrl+Wheel or Ctrl +/- to zoom)'
            }
          >
            <ZoomIn className={cn('h-3.5 w-3.5', zoomLevel !== 1 && 'text-primary')} />
            <span className="tabular-nums">{Math.round(zoomLevel * 100)}%</span>
          </Button>

          {/* Night Eye-Care Filter (Kindle) */}
          {onToggleEyeCare && (
            <div ref={eyeCareMenuRef} className="relative">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowEyeCareMenu((prev) => !prev)}
                className={cn(
                  'h-9 w-9 transition-colors',
                  eyeCareEnabled
                    ? 'text-amber-400 bg-amber-500/15 border border-amber-500/35 hover:bg-amber-500/20'
                    : cn(textSub, 'hover:text-amber-400 hover:bg-amber-500/10')
                )}
                title={
                  eyeCareEnabled
                    ? `Night Eye-Care: ${EYE_CARE_PRESETS[eyeCareTint].label} (${eyeCareDimming}% dim)`
                    : 'Night Eye-Care Filter (Warm/Sepia & Dimming)'
                }
              >
                <Moon className="h-4 w-4" />
              </Button>

              {showEyeCareMenu && (
                <div
                  className={cn(
                    'absolute right-0 top-11 w-72 rounded-2xl border p-4 shadow-2xl backdrop-blur-xl z-50 animate-in fade-in zoom-in-95 duration-150 space-y-4',
                    readerTheme === 'light'
                      ? 'bg-white/95 border-slate-200 text-slate-900'
                      : 'bg-neutral-900/95 border-white/10 text-neutral-100'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Moon className="h-4 w-4 text-amber-400" />
                      <span className="text-xs font-bold tracking-wide">Night Eye-Care</span>
                    </div>
                    <button
                      type="button"
                      onClick={onToggleEyeCare}
                      className={cn(
                        'px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border transition-colors',
                        eyeCareEnabled
                          ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                          : readerTheme === 'light'
                            ? 'bg-slate-100 text-slate-500 border-slate-200'
                            : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                      )}
                    >
                      {eyeCareEnabled ? 'ON' : 'OFF'}
                    </button>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5">
                    {(Object.keys(EYE_CARE_PRESETS) as EyeCareTintPreset[]).map((key) => {
                      const preset = EYE_CARE_PRESETS[key]
                      const isActive = eyeCareEnabled && eyeCareTint === key
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => onApplyEyeCarePreset?.(key)}
                          className={cn(
                            'flex flex-col items-center gap-1.5 py-2 px-1 rounded-xl border text-[10px] font-bold transition-all',
                            isActive
                              ? 'border-amber-500/50 bg-amber-500/15 text-amber-400 shadow-sm'
                              : readerTheme === 'light'
                                ? 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                                : 'border-white/5 bg-white/5 text-neutral-400 hover:text-neutral-200 hover:bg-white/10'
                          )}
                        >
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-inner"
                            style={{ backgroundColor: preset.swatchHex }}
                          />
                          <span className="truncate max-w-full">{preset.label}</span>
                        </button>
                      )
                    })}
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-semibold">
                        <span className={textSub}>Warm / Sepia Tint</span>
                        <span className="font-mono text-amber-400 tabular-nums">
                          {eyeCareTint === 'dim' ? 'Off' : `${eyeCareWarmth}%`}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={MAX_EYE_CARE_WARMTH}
                        step={1}
                        value={eyeCareTint === 'dim' ? 0 : eyeCareWarmth}
                        disabled={eyeCareTint === 'dim'}
                        onChange={(e) => onChangeEyeCareWarmth?.(Number(e.target.value))}
                        className="w-full h-1.5 accent-amber-500 bg-neutral-700/60 rounded-lg cursor-pointer disabled:opacity-35"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-semibold">
                        <span className={textSub}>Reader Dimming</span>
                        <span className="font-mono text-amber-400 tabular-nums">
                          {eyeCareDimming}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={MAX_EYE_CARE_DIMMING}
                        step={1}
                        value={eyeCareDimming}
                        onChange={(e) => onChangeEyeCareDimming?.(Number(e.target.value))}
                        className="w-full h-1.5 accent-amber-500 bg-neutral-700/60 rounded-lg cursor-pointer"
                      />
                    </div>
                  </div>

                  <p className={cn('text-[10px] leading-tight', textSub)}>
                    Tints and dims reader pages only without changing Windows display brightness.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Zen / Borderless Mode Toggle Button */}
          {onToggleZenMode && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleZenMode}
              className={cn(
                'h-9 w-9 transition-colors',
                isZenMode
                  ? 'text-primary bg-primary/10 border border-primary/30'
                  : cn(textSub, 'hover:text-primary hover:bg-primary/10')
              )}
              title={isZenMode ? 'Exit Zen Mode (H)' : 'Zen Mode: Hide Toolbar (H)'}
            >
              <PanelTopClose className="h-4 w-4" />
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={onShare}
            className={cn('h-9 w-9', textSub, 'hover:text-primary hover:bg-primary/10')}
            title="Share progress"
          >
            <Share2 className="h-4 w-4" />
          </Button>
          <div className="ml-1 w-44">
            <Select
              options={[
                { value: 'continuous-vertical', label: 'Continuous Vertical' },
                { value: 'webtoon', label: 'Webtoon' },
                { value: 'paged-ltr', label: 'Paged LTR' },
                { value: 'paged-rtl', label: 'Paged RTL' },
                { value: 'paged-double-ltr', label: 'Double Page LTR' },
                { value: 'paged-double-rtl', label: 'Double Page RTL' },
                { value: 'paged-vertical', label: 'Paged Vertical' },
                { value: 'continuous-ltr', label: 'Continuous LTR' },
                { value: 'continuous-rtl', label: 'Continuous RTL' }
              ]}
              value={readingMode}
              onValueChange={(val) => onReadingModeChange(val as ReadingMode)}
              className={cn(
                'h-8 text-[10px] uppercase font-bold tracking-wider rounded-full pl-3 pr-2 shadow-inner border border-black/5 hover:bg-black/5',
                readerTheme === 'light'
                  ? 'bg-slate-100/50 text-slate-700'
                  : 'bg-neutral-800/50 hover:bg-neutral-800 text-neutral-300'
              )}
            />
          </div>
        </div>
      </div>
    )
  }
)
