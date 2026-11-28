import { memo, useRef, useState, ChangeEvent, MouseEvent } from 'react'
import {
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  PictureInPicture
} from 'lucide-react'
import type { EpisodeSkipTimes } from '@common/services/skipTimes.service'
import { Button } from '@renderer/shared/ui'
import { cn } from '@renderer/shared/lib/utils'

export interface QualityLevel {
  index: number
  height: number
  bitrate?: number
  label: string
}

export interface VideoControlsProps {
  showControls: boolean
  currentTime: number
  duration: number
  bufferedPercent: number
  isPlaying: boolean
  isMuted: boolean
  volume: number
  playbackRate: number
  isFullscreen: boolean
  isPiP: boolean
  videoType: 'hls' | 'mp4' | 'embed'
  qualityLevels: QualityLevel[]
  selectedQuality: number
  currentQualityLabel: string
  mp4QualityLabel: string
  prevEpisode?: any
  nextEpisode?: any
  onTogglePlay: () => void
  onSeekTo: (seconds: number) => void
  onSeekBy: (deltaSeconds: number) => void
  onToggleMute: () => void
  onVolumeChange: (e: ChangeEvent<HTMLInputElement>) => void
  onChangeSpeed: () => void
  onToggleFullscreen: () => void
  onTogglePiP: () => void
  onQualityChange: (levelIndex: number) => void
  onPrevEpisode?: () => void
  onNextEpisode?: () => void
  skipTimes?: EpisodeSkipTimes | null
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const pad = (n: number) => n.toString().padStart(2, '0')
  if (h > 0) {
    return `${h}:${pad(m)}:${pad(s)}`
  }
  return `${pad(m)}:${pad(s)}`
}

export const VideoControls = memo(function VideoControls({
  showControls,
  currentTime,
  duration,
  bufferedPercent,
  isPlaying,
  isMuted,
  volume,
  playbackRate,
  isFullscreen,
  isPiP,
  videoType,
  qualityLevels,
  selectedQuality,
  currentQualityLabel,
  mp4QualityLabel,
  prevEpisode,
  nextEpisode,
  onTogglePlay,
  onSeekTo,
  onSeekBy,
  onToggleMute,
  onVolumeChange,
  onChangeSpeed,
  onToggleFullscreen,
  onTogglePiP,
  onQualityChange,
  onPrevEpisode,
  onNextEpisode,
  skipTimes
}: VideoControlsProps) {
  const progressBarRef = useRef<HTMLDivElement | null>(null)
  const [hoverTime, setHoverTime] = useState<number | null>(null)
  const [hoverX, setHoverX] = useState<number>(0)

  const handleSeek = (e: MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !duration) return
    const rect = progressBarRef.current.getBoundingClientRect()
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    onSeekTo(pos * duration)
  }

  const handleMouseMoveProgressBar = (e: MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !duration) return
    const rect = progressBarRef.current.getBoundingClientRect()
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    setHoverTime(pos * duration)
    setHoverX(e.clientX - rect.left)
  }

  const handleMouseLeaveProgressBar = () => {
    setHoverTime(null)
  }

  return (
    <div
      className={cn(
        'absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent pt-12 pb-4 px-6 z-40 flex flex-col gap-2 transition-all duration-500',
        !showControls && 'translate-y-[110%] opacity-0 pointer-events-none'
      )}
      onClick={(e) => e.stopPropagation()}
      onPointerUpCapture={(e) => {
        const target = e.target as HTMLElement | null
        const focusEl = target?.closest?.('button, input') as HTMLElement | null
        if (focusEl) {
          requestAnimationFrame(() => focusEl.blur())
        }
      }}
    >
      {/* Seekbar */}
      <div
        ref={progressBarRef}
        className="relative w-full h-4 flex items-center cursor-pointer group/seek py-1"
        onClick={handleSeek}
        onMouseMove={handleMouseMoveProgressBar}
        onMouseLeave={handleMouseLeaveProgressBar}
      >
        {/* Background track */}
        <div className="w-full h-1 group-hover/seek:h-2 bg-white/20 rounded-full transition-all overflow-hidden relative">
          {/* Buffered progress */}
          <div
            className="absolute top-0 bottom-0 left-0 bg-white/35 rounded-full transition-all"
            style={{ width: `${bufferedPercent}%` }}
          />
          {/* AniSkip OP / ED timeline markers */}
          {duration > 0 && skipTimes?.op && skipTimes.op.startTime < duration && (
            <div
              className="absolute top-0 bottom-0 bg-amber-400/65 pointer-events-none z-10"
              style={{
                left: `${(skipTimes.op.startTime / duration) * 100}%`,
                width: `${((Math.min(skipTimes.op.endTime, duration) - skipTimes.op.startTime) / duration) * 100}%`
              }}
            />
          )}
          {duration > 0 && skipTimes?.ed && skipTimes.ed.startTime < duration && (
            <div
              className="absolute top-0 bottom-0 bg-emerald-400/65 pointer-events-none z-10"
              style={{
                left: `${(skipTimes.ed.startTime / duration) * 100}%`,
                width: `${((Math.min(skipTimes.ed.endTime, duration) - skipTimes.ed.startTime) / duration) * 100}%`
              }}
            />
          )}
          {/* Played progress */}
          <div
            className="absolute top-0 bottom-0 left-0 bg-primary rounded-full transition-all"
            style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
          />
        </div>

        {/* Scrubber thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-md scale-0 group-hover/seek:scale-100 transition-transform pointer-events-none"
          style={{ left: `${duration ? (currentTime / duration) * 100 : 0}%` }}
        />

        {/* Hover time tooltip */}
        {hoverTime !== null && (
          <div
            className="absolute -top-7 -translate-x-1/2 px-2 py-0.5 rounded bg-neutral-900/90 backdrop-blur border border-white/20 text-[10px] font-mono text-white pointer-events-none whitespace-nowrap"
            style={{ left: `${hoverX}px` }}
          >
            {formatTime(hoverTime)}
            {skipTimes?.op &&
            hoverTime >= skipTimes.op.startTime &&
            hoverTime <= skipTimes.op.endTime
              ? ' • Intro'
              : skipTimes?.ed &&
                  hoverTime >= skipTimes.ed.startTime &&
                  hoverTime <= skipTimes.ed.endTime
                ? ' • Outro'
                : ''}
          </div>
        )}
      </div>

      {/* Controls Row */}
      <div className="flex items-center justify-between relative">
        {/* Left Controls */}
        <div className="flex items-center gap-3">
          {/* Play / Pause */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onTogglePlay}
            className="h-9 w-9 text-white hover:text-primary hover:bg-white/10 rounded-full"
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          >
            {isPlaying ? (
              <Pause className="h-5 w-5 fill-current" />
            ) : (
              <Play className="h-5 w-5 fill-current" />
            )}
          </Button>

          {/* Prev Episode */}
          <Button
            variant="ghost"
            size="icon"
            disabled={!prevEpisode}
            onClick={onPrevEpisode}
            className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-20 rounded-full"
            title="Previous Episode (P)"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {/* Skip Back 10s */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onSeekBy(-10)}
            className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10 rounded-full"
            title="Rewind 10s (ArrowLeft)"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>

          {/* Skip Forward 10s */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onSeekBy(10)}
            className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10 rounded-full"
            title="Forward 10s (ArrowRight)"
          >
            <RotateCw className="h-4 w-4" />
          </Button>

          {/* Next Episode */}
          <Button
            variant="ghost"
            size="icon"
            disabled={!nextEpisode}
            onClick={onNextEpisode}
            className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-20 rounded-full"
            title="Next Episode (N)"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          {/* Volume */}
          <div className="flex items-center gap-1.5 ml-1 group/vol">
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleMute}
              className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10 rounded-full"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="h-4 w-4 text-red-400" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </Button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={onVolumeChange}
              className="w-16 h-1 accent-primary bg-white/20 rounded-lg cursor-pointer"
              title={`Volume: ${Math.round((isMuted ? 0 : volume) * 100)}%`}
            />
          </div>

          {/* Time Display */}
          <div className="text-xs font-mono text-white/70 ml-2 select-none">
            <span className="text-white font-medium">{formatTime(currentTime)}</span>
            <span className="mx-1 text-white/30">/</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Center Branding / Player Indicator */}
        <div className="absolute left-1/2 -translate-x-1/2 hidden sm:flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md select-none pointer-events-none shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-[11px] font-black tracking-wider uppercase italic text-white/90">
            AutaKimi <span className="text-primary not-italic font-bold">Player</span>
          </span>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2">
          {/* HLS Multi-Quality Selector */}
          {videoType === 'hls' && qualityLevels.length > 0 && (
            <div className="flex items-center bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-2.5 h-8 transition-colors">
              <span className="text-[10px] text-white/40 font-bold mr-2 uppercase tracking-tight select-none">
                Quality
              </span>
              <select
                value={selectedQuality}
                onChange={(e) => {
                  onQualityChange(parseInt(e.target.value, 10))
                  e.currentTarget.blur()
                }}
                className="bg-transparent text-xs font-bold text-white/90 outline-none cursor-pointer"
                title="Select Video Quality"
              >
                <option value={-1} className="bg-neutral-900 text-white">
                  {selectedQuality === -1 && currentQualityLabel
                    ? `Auto (${currentQualityLabel})`
                    : 'Auto'}
                </option>
                {qualityLevels.map((q) => (
                  <option key={q.index} value={q.index} className="bg-neutral-900 text-white">
                    {q.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* MP4 Fixed Quality Badge */}
          {videoType === 'mp4' && mp4QualityLabel && (
            <span
              className="h-8 px-2.5 flex items-center text-xs font-bold text-white/50 bg-white/5 border border-white/5 rounded-lg select-none"
              title="Direct Stream Quality (Fixed)"
            >
              {mp4QualityLabel}
            </span>
          )}

          {/* Speed */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onChangeSpeed}
            className="h-8 px-2.5 text-xs font-bold text-white/70 hover:text-white hover:bg-white/10 rounded-lg"
            title="Playback Speed"
          >
            {playbackRate}x
          </Button>

          {/* Picture-in-Picture */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onTogglePiP}
            className={cn(
              'h-8 w-8 rounded-full transition-colors',
              isPiP
                ? 'text-primary bg-primary/20'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            )}
            title="Picture-in-Picture (I)"
          >
            <PictureInPicture className="h-4 w-4" />
          </Button>

          {/* Fullscreen */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleFullscreen}
            className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10 rounded-full"
            title="Fullscreen (F)"
          >
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  )
})
