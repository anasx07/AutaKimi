import { memo, useRef, MouseEvent } from 'react'
import {
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Volume2,
  VolumeX,
  Maximize2,
  PictureInPicture,
  X,
  SkipForward
} from 'lucide-react'
import type { EpisodeSkipTimes } from '@common/services/skipTimes.service'
import { cn } from '@renderer/shared/lib/utils'

function formatMiniTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

export interface MiniPipControlsProps {
  title: string
  episodeNumber?: number | string
  isPlaying: boolean
  isMuted: boolean
  currentTime: number
  duration: number
  playbackRate: number
  videoType: 'hls' | 'mp4' | 'embed'
  hasPrevEpisode: boolean
  hasNextEpisode: boolean
  showSkipIntro: boolean
  showNextEpisodePill: boolean
  nextEpisodeNumber?: number | string
  outroCountdown: number | null
  skipTimes?: EpisodeSkipTimes | null
  onTogglePlay: () => void
  onSeekTo: (seconds: number) => void
  onToggleMute: () => void
  onChangeSpeed: () => void
  onPrevEpisode: () => void
  onNextEpisode: () => void
  onSkipIntro: () => void
  onPopOutOsPip: () => void
  onExpand: () => void
  onClose: () => void
}

export const MiniPipControls = memo(function MiniPipControls({
  title,
  episodeNumber,
  isPlaying,
  isMuted,
  currentTime,
  duration,
  playbackRate,
  videoType,
  hasPrevEpisode,
  hasNextEpisode,
  showSkipIntro,
  showNextEpisodePill,
  nextEpisodeNumber,
  outroCountdown,
  skipTimes,
  onTogglePlay,
  onSeekTo,
  onToggleMute,
  onChangeSpeed,
  onPrevEpisode,
  onNextEpisode,
  onSkipIntro,
  onPopOutOsPip,
  onExpand,
  onClose
}: MiniPipControlsProps) {
  const barRef = useRef<HTMLDivElement | null>(null)

  const handleSeek = (e: MouseEvent<HTMLDivElement>) => {
    e.stopPropagation()
    if (!barRef.current || !duration) return
    const rect = barRef.current.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    onSeekTo(ratio * duration)
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex flex-col justify-between">
      {/* Top Overlay Header */}
      <div
        className={cn(
          'pointer-events-auto flex items-center justify-between gap-2 px-3 py-2 bg-gradient-to-b from-black/90 via-black/55 to-transparent transition-opacity duration-200',
          isPlaying ? 'opacity-0 group-hover/pip:opacity-100' : 'opacity-100'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onExpand}
          className="flex items-center gap-1.5 min-w-0 text-left group/title"
          title="Return to Episode Page"
        >
          {episodeNumber !== undefined && (
            <span className="px-1.5 py-0.5 rounded bg-primary text-primary-foreground text-[9px] font-black uppercase shrink-0">
              EP {episodeNumber}
            </span>
          )}
          <span className="text-[11px] font-bold text-white/90 group-hover/title:text-primary truncate transition-colors">
            {title}
          </span>
        </button>

        <div className="flex items-center gap-1 shrink-0">
          {videoType !== 'embed' && (
            <button
              type="button"
              onClick={onPopOutOsPip}
              className="h-6 w-6 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-white/15 transition-colors"
              title="Pop out outside AutaKimi (OS PiP)"
            >
              <PictureInPicture className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={onExpand}
            className="h-6 w-6 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-white/15 transition-colors"
            title="Expand Player"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-6 w-6 rounded-full flex items-center justify-center text-white/80 hover:text-red-400 hover:bg-white/15 transition-colors"
            title="Close Mini Player"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Center Play / Pause Quick Circle (non-embed) */}
      {videoType !== 'embed' && (
        <div
          className={cn(
            'flex items-center justify-center transition-opacity duration-200',
            isPlaying ? 'opacity-0 group-hover/pip:opacity-100' : 'opacity-100'
          )}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onTogglePlay()
            }}
            className="pointer-events-auto h-11 w-11 rounded-full bg-black/65 hover:bg-primary text-white border border-white/25 backdrop-blur-md flex items-center justify-center shadow-xl transition-all hover:scale-105 cursor-pointer"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="h-5 w-5 fill-current" />
            ) : (
              <Play className="h-5 w-5 fill-current ml-0.5" />
            )}
          </button>
        </div>
      )}

      {/* Bottom Controls + Skip Intro / Next Episode Compact Pills */}
      <div className="flex flex-col">
        {(showSkipIntro || showNextEpisodePill) && videoType !== 'embed' && (
          <div
            className="pointer-events-auto px-3 pb-1.5 flex items-center justify-end gap-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            {showSkipIntro && (
              <button
                type="button"
                onClick={onSkipIntro}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-900/90 hover:bg-white text-white hover:text-black border border-white/25 text-[11px] font-bold shadow-lg transition-colors cursor-pointer"
              >
                <SkipForward className="h-3 w-3 fill-current" />
                <span>Skip Intro</span>
              </button>
            )}
            {showNextEpisodePill && hasNextEpisode && (
              <button
                type="button"
                onClick={onNextEpisode}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-[11px] font-bold shadow-lg transition-colors cursor-pointer"
              >
                <Play className="h-3 w-3 fill-current" />
                <span>
                  Next EP{nextEpisodeNumber !== undefined ? ` ${nextEpisodeNumber}` : ''}
                  {outroCountdown !== null ? ` (${outroCountdown}s)` : ''}
                </span>
              </button>
            )}
          </div>
        )}

        <div
          className={cn(
            'pointer-events-auto bg-gradient-to-t from-black/95 via-black/80 to-transparent px-3 pt-4 pb-2 transition-opacity duration-200',
            isPlaying ? 'opacity-0 group-hover/pip:opacity-100' : 'opacity-100'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Mini Seekbar (non-embed) */}
          {videoType !== 'embed' && (
            <div
              ref={barRef}
              onClick={handleSeek}
              className="relative w-full h-3 flex items-center cursor-pointer group/miniseek mb-1"
            >
              <div className="w-full h-1 group-hover/miniseek:h-1.5 bg-white/25 rounded-full overflow-hidden relative transition-all">
                {duration > 0 && skipTimes?.op && skipTimes.op.startTime < duration && (
                  <div
                    className="absolute top-0 bottom-0 bg-amber-400/70 pointer-events-none"
                    style={{
                      left: `${(skipTimes.op.startTime / duration) * 100}%`,
                      width: `${((Math.min(skipTimes.op.endTime, duration) - skipTimes.op.startTime) / duration) * 100}%`
                    }}
                  />
                )}
                <div
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          {/* Controls Row */}
          <div className="flex items-center justify-between gap-2 text-white">
            <div className="flex items-center gap-1">
              {videoType !== 'embed' && (
                <button
                  type="button"
                  onClick={onTogglePlay}
                  className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-white/15 transition-colors"
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? (
                    <Pause className="h-3.5 w-3.5 fill-current" />
                  ) : (
                    <Play className="h-3.5 w-3.5 fill-current" />
                  )}
                </button>
              )}

              <button
                type="button"
                disabled={!hasPrevEpisode}
                onClick={onPrevEpisode}
                className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-white/15 disabled:opacity-30 transition-colors"
                title="Previous Episode"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <button
                type="button"
                disabled={!hasNextEpisode}
                onClick={onNextEpisode}
                className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-white/15 disabled:opacity-30 transition-colors"
                title="Next Episode"
              >
                <ChevronRight className="h-4 w-4" />
              </button>

              {videoType !== 'embed' && (
                <button
                  type="button"
                  onClick={onToggleMute}
                  className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-white/15 transition-colors"
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? (
                    <VolumeX className="h-3.5 w-3.5 text-red-400" />
                  ) : (
                    <Volume2 className="h-3.5 w-3.5" />
                  )}
                </button>
              )}

              {videoType !== 'embed' && (
                <span className="text-[10px] font-mono text-white/75 ml-1">
                  {formatMiniTime(currentTime)} / {formatMiniTime(duration)}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {videoType !== 'embed' && (
                <button
                  type="button"
                  onClick={onChangeSpeed}
                  className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[10px] font-bold transition-colors"
                  title="Playback Speed"
                >
                  {playbackRate}x
                </button>
              )}
              <button
                type="button"
                onClick={onExpand}
                className="px-2 py-0.5 rounded bg-primary/85 hover:bg-primary text-primary-foreground text-[10px] font-bold transition-colors"
                title="Expand to Watch View"
              >
                Expand
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})
