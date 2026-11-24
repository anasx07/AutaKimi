import { useEffect, useRef } from 'react'

export interface MediaMetadataInput {
  animeTitle?: string | null
  episodeNumber?: number | string | null
  episodeTitle?: string | null
  coverUrl?: string | null
}

export interface EpisodeMediaMetadataPayload {
  title: string
  artist: string
  album: string
  artwork: Array<{ src: string }>
}

/**
 * Formats an OS Media Flyout payload with anime title, episode label, and normalized cover artwork.
 */
export function buildEpisodeMediaMetadataPayload(
  input: MediaMetadataInput
): EpisodeMediaMetadataPayload {
  const title = input.animeTitle?.trim() || 'AutaKimi'
  const rawEpNum = input.episodeNumber
  const epNumStr =
    rawEpNum !== undefined && rawEpNum !== null && String(rawEpNum).trim() !== ''
      ? `Episode ${String(rawEpNum).trim()}`
      : ''
  const rawEpTitle = input.episodeTitle?.trim() || ''

  let artist = 'Watching Now'
  if (rawEpTitle && epNumStr) {
    const normalizedTitle = rawEpTitle.toLowerCase()
    const normalizedNum = epNumStr.toLowerCase()
    artist =
      normalizedTitle === normalizedNum || normalizedTitle === String(rawEpNum).trim().toLowerCase()
        ? epNumStr
        : `${epNumStr} • ${rawEpTitle}`
  } else if (epNumStr) {
    artist = epNumStr
  } else if (rawEpTitle) {
    artist = rawEpTitle
  }

  let artwork: Array<{ src: string }> = []
  const rawCover = input.coverUrl?.trim()
  if (rawCover) {
    const normalizedSrc = rawCover.startsWith('//') ? `https:${rawCover}` : rawCover
    if (
      normalizedSrc.startsWith('https://') ||
      normalizedSrc.startsWith('http://') ||
      normalizedSrc.startsWith('data:') ||
      normalizedSrc.startsWith('autakimi-cache://')
    ) {
      artwork = [{ src: normalizedSrc }]
    }
  }

  return {
    title,
    artist,
    album: 'AutaKimi',
    artwork
  }
}

export interface UseMediaSessionOptions {
  enabled: boolean
  animeTitle?: string | null
  coverUrl?: string | null
  episodeNumber?: number | string | null
  episodeTitle?: string | null
  isPlaying: boolean
  currentTime: number
  duration: number
  playbackRate: number
  hasNextEpisode: boolean
  hasPrevEpisode: boolean
  onPlay: () => void
  onPause: () => void
  onNextEpisode: () => void
  onPrevEpisode: () => void
  onSeekTo: (seconds: number) => void
  onSeekBy: (seconds: number) => void
}

const ALL_MEDIA_ACTIONS: MediaSessionAction[] = [
  'play',
  'pause',
  'stop',
  'nexttrack',
  'previoustrack',
  'seekbackward',
  'seekforward',
  'seekto'
]

function safeSetActionHandler(
  mediaSession: MediaSession,
  action: MediaSessionAction,
  handler: MediaSessionActionHandler | null
): void {
  try {
    mediaSession.setActionHandler(action, handler)
  } catch {
    // Some Chromium/Electron builds restrict specific MediaSession actions
  }
}

/**
 * Integrates Electron's Desktop player with the OS Media Session API (hardware media keys
 * and Windows/macOS Media Transport Flyout with anime cover, title, and episode progress).
 */
export function useMediaSession(options: UseMediaSessionOptions): void {
  const {
    enabled,
    animeTitle,
    coverUrl,
    episodeNumber,
    episodeTitle,
    isPlaying,
    currentTime,
    duration,
    playbackRate,
    hasNextEpisode,
    hasPrevEpisode,
    onPlay,
    onPause,
    onNextEpisode,
    onPrevEpisode,
    onSeekTo,
    onSeekBy
  } = options

  const callbacksRef = useRef({
    onPlay,
    onPause,
    onNextEpisode,
    onPrevEpisode,
    onSeekTo,
    onSeekBy
  })
  callbacksRef.current = {
    onPlay,
    onPause,
    onNextEpisode,
    onPrevEpisode,
    onSeekTo,
    onSeekBy
  }

  const lastPositionSyncRef = useRef<{
    timestamp: number
    duration: number
    playbackRate: number
    isPlaying: boolean
  }>({
    timestamp: 0,
    duration: 0,
    playbackRate: 1,
    isPlaying: false
  })

  // 1. Update OS Media Flyout metadata (artwork, anime title, episode label)
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return
    const ms = navigator.mediaSession

    if (!enabled) {
      ms.metadata = null
      ms.playbackState = 'none'
      return
    }

    if (typeof MediaMetadata !== 'undefined') {
      const payload = buildEpisodeMediaMetadataPayload({
        animeTitle,
        episodeNumber,
        episodeTitle,
        coverUrl
      })
      ms.metadata = new MediaMetadata(payload)
    }
  }, [enabled, animeTitle, episodeNumber, episodeTitle, coverUrl])

  // 2. Register hardware media key & OS flyout button handlers
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return
    const ms = navigator.mediaSession

    if (!enabled) {
      for (const action of ALL_MEDIA_ACTIONS) {
        safeSetActionHandler(ms, action, null)
      }
      return
    }

    safeSetActionHandler(ms, 'play', () => callbacksRef.current.onPlay())
    safeSetActionHandler(ms, 'pause', () => callbacksRef.current.onPause())
    safeSetActionHandler(ms, 'stop', () => callbacksRef.current.onPause())
    safeSetActionHandler(
      ms,
      'nexttrack',
      hasNextEpisode ? () => callbacksRef.current.onNextEpisode() : null
    )
    safeSetActionHandler(
      ms,
      'previoustrack',
      hasPrevEpisode ? () => callbacksRef.current.onPrevEpisode() : null
    )
    safeSetActionHandler(ms, 'seekbackward', (details) => {
      callbacksRef.current.onSeekBy(-(details?.seekOffset ?? 10))
    })
    safeSetActionHandler(ms, 'seekforward', (details) => {
      callbacksRef.current.onSeekBy(details?.seekOffset ?? 10)
    })
    safeSetActionHandler(ms, 'seekto', (details) => {
      if (typeof details?.seekTime === 'number' && Number.isFinite(details.seekTime)) {
        callbacksRef.current.onSeekTo(details.seekTime)
      }
    })
  }, [enabled, hasNextEpisode, hasPrevEpisode])

  // 3. Keep OS playbackState and timeline scrubber synchronized
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return
    const ms = navigator.mediaSession

    if (!enabled) return

    ms.playbackState = isPlaying ? 'playing' : 'paused'

    if (
      typeof ms.setPositionState === 'function' &&
      Number.isFinite(duration) &&
      duration > 0 &&
      Number.isFinite(currentTime) &&
      currentTime >= 0
    ) {
      const safeRate = Number.isFinite(playbackRate) && playbackRate > 0 ? playbackRate : 1
      const now = Date.now()
      const prev = lastPositionSyncRef.current
      const metadataOrStateChanged =
        prev.duration !== duration || prev.playbackRate !== safeRate || prev.isPlaying !== isPlaying

      if (metadataOrStateChanged || now - prev.timestamp >= 1000) {
        lastPositionSyncRef.current = {
          timestamp: now,
          duration,
          playbackRate: safeRate,
          isPlaying
        }
        try {
          ms.setPositionState({
            duration,
            playbackRate: safeRate,
            position: Math.min(Math.max(0, currentTime), duration)
          })
        } catch {
          // Ignore invalid position/duration edge cases during stream transitions
        }
      }
    }
  }, [enabled, isPlaying, currentTime, duration, playbackRate])

  // 4. Clean up OS Media Session completely on unmount
  useEffect(() => {
    return () => {
      if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return
      const ms = navigator.mediaSession
      ms.metadata = null
      ms.playbackState = 'none'
      for (const action of ALL_MEDIA_ACTIONS) {
        safeSetActionHandler(ms, action, null)
      }
    }
  }, [])
}
