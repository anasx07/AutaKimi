import { useEffect, useRef, useState, useCallback } from 'react'
import Hls from 'hls.js'
import { DataService } from '@renderer/shared/api'
import { QualityLevel } from '../components/VideoControls'

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

export interface UseHlsPlayerOptions {
  activeServerUrl?: string
  videoType: 'hls' | 'mp4' | 'embed'
  serverConfig?: any
  activeServerIdx: number
  volumeRef: React.MutableRefObject<number>
  isMutedRef: React.MutableRefObject<boolean>
  playbackRateRef: React.MutableRefObject<number>
  savedProgressSeconds: number
  exactHandoffSeconds?: number
  startPaused?: boolean
  failoverToNextServer: (reason: string) => void
  setDuration: (dur: number) => void
  setResumeNotice: (notice: string | null) => void
}

export function useHlsPlayer({
  activeServerUrl,
  videoType,
  serverConfig,
  activeServerIdx,
  volumeRef,
  isMutedRef,
  playbackRateRef,
  savedProgressSeconds,
  exactHandoffSeconds = 0,
  startPaused = false,
  failoverToNextServer,
  setDuration,
  setResumeNotice
}: UseHlsPlayerOptions) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const hlsRef = useRef<Hls | null>(null)
  const watchdogRef = useRef<NodeJS.Timeout | null>(null)
  const hasResumedRef = useRef(false)
  const startPausedRef = useRef(startPaused)

  useEffect(() => {
    startPausedRef.current = startPaused
  }, [startPaused])

  const [qualityLevels, setQualityLevels] = useState<QualityLevel[]>([])
  const [selectedQuality, setSelectedQuality] = useState<number>(-1) // -1 = Auto
  const [currentQualityLabel, setCurrentQualityLabel] = useState<string>('')
  const [mp4QualityLabel, setMp4QualityLabel] = useState<string>('')

  const clearWatchdog = useCallback(() => {
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current)
      watchdogRef.current = null
    }
  }, [])

  // Setup HLS / Video playback & attach proxy headers
  useEffect(() => {
    if (!activeServerUrl) return

    let isMounted = true

    clearWatchdog()

    // Active Watchdog: 4500ms for direct streams, 6500ms for embeds
    const timeoutDuration = videoType === 'embed' ? 6500 : 4500
    watchdogRef.current = setTimeout(() => {
      if (!isMounted) return
      const video = videoRef.current
      if (videoType !== 'embed' && video && video.readyState < 2 && video.currentTime === 0) {
        console.warn(
          `[AnimeViewer] Watchdog triggered on server ${activeServerIdx + 1} (${timeoutDuration}ms)`
        )
        failoverToNextServer('Server stream stalled or timed out.')
      }
    }, timeoutDuration)

    if (videoType === 'embed') {
      return () => {
        isMounted = false
        clearWatchdog()
      }
    }

    const setupPlayer = async () => {
      if (
        typeof serverConfig === 'object' &&
        serverConfig?.headers &&
        Object.keys(serverConfig.headers).length > 0
      ) {
        try {
          await DataService.setStreamHeaders(activeServerUrl, serverConfig.headers)
        } catch (err) {
          console.warn('[AnimeViewer] Failed to set stream headers:', err)
        }
      }

      if (!isMounted) return
      const video = videoRef.current
      if (!video) return

      video.muted = isMutedRef.current
      video.volume = volumeRef.current > 0 ? volumeRef.current : 1
      video.playbackRate = playbackRateRef.current

      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }

      if (videoType === 'hls') {
        if (Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: false,
            backBufferLength: 120,
            maxBufferLength: 60,
            maxMaxBufferLength: 180,
            maxBufferSize: 60 * 1000 * 1000,
            abrEwmaDefaultEstimate: 8000000,
            abrEwmaDefaultEstimateMax: 25000000,
            manifestLoadingTimeOut: 5000,
            manifestLoadingMaxRetry: 2,
            manifestLoadingRetryDelay: 500,
            levelLoadingTimeOut: 5000,
            levelLoadingMaxRetry: 2,
            fragLoadingTimeOut: 10000,
            fragLoadingMaxRetry: 3
          })
          hlsRef.current = hls
          hls.loadSource(activeServerUrl)
          hls.attachMedia(video)

          hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
            clearWatchdog()
            if (isMounted) {
              const rawLevels = (data as any)?.levels || hls.levels || []
              if (rawLevels && rawLevels.length > 0) {
                const parsed: QualityLevel[] = rawLevels.map((lvl: any, idx: number) => {
                  const height = lvl.height || 0
                  const label =
                    height > 0 ? `${height}p` : lvl.name || `${Math.round(lvl.bitrate / 1000)}k`
                  return {
                    index: idx,
                    height,
                    bitrate: lvl.bitrate,
                    label
                  }
                })

                // Deduplicate by height keeping highest bitrate, and sort descending
                const heightMap = new Map<number, QualityLevel>()
                for (const lvl of parsed) {
                  const existing = heightMap.get(lvl.height)
                  if (!existing || (lvl.bitrate && lvl.bitrate > (existing.bitrate || 0))) {
                    heightMap.set(lvl.height, lvl)
                  }
                }
                const sorted = Array.from(heightMap.values()).sort((a, b) => b.height - a.height)
                setQualityLevels(sorted)

                // Check stored preference
                const savedQuality =
                  localStorage.getItem('autakimi-anime-preferred-quality') || 'auto'
                if (savedQuality && savedQuality !== 'auto') {
                  const matched = sorted.find(
                    (q) =>
                      q.label.toLowerCase() === savedQuality.toLowerCase() ||
                      (parseInt(savedQuality, 10) > 0 && q.height === parseInt(savedQuality, 10))
                  )
                  if (matched) {
                    hls.currentLevel = matched.index
                    setSelectedQuality(matched.index)
                    setCurrentQualityLabel(matched.label)
                  } else {
                    hls.currentLevel = -1
                    setSelectedQuality(-1)
                  }
                } else {
                  hls.currentLevel = -1
                  setSelectedQuality(-1)
                }
              }

              video.muted = isMutedRef.current
              video.volume = volumeRef.current > 0 ? volumeRef.current : 1
              video.playbackRate = playbackRateRef.current
              if (!startPausedRef.current) {
                const playPromise = video.play()
                if (playPromise !== undefined) {
                  playPromise.catch(() => {
                    video.play().catch(() => {})
                  })
                }
              }
            }
          })

          hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
            if (!isMounted) return
            const currentLvl = hls.levels[data.level]
            if (currentLvl) {
              const lbl = currentLvl.height
                ? `${currentLvl.height}p`
                : `${Math.round(currentLvl.bitrate / 1000)}k`
              setCurrentQualityLabel(lbl)
            }
          })

          hls.on(Hls.Events.ERROR, (_event, data) => {
            console.warn('[AnimeViewer] HLS Error:', data)
            if (data.fatal) {
              switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  if (
                    data.details === 'manifestLoadError' ||
                    data.details === 'manifestLoadTimeOut' ||
                    data.details === 'levelLoadError' ||
                    data.details === 'levelLoadTimeOut'
                  ) {
                    failoverToNextServer(`HLS stream unreachable (${data.details})`)
                  } else {
                    hls.startLoad()
                  }
                  break
                case Hls.ErrorTypes.MEDIA_ERROR:
                  hls.recoverMediaError()
                  break
                default:
                  hls.destroy()
                  failoverToNextServer(`HLS playback error: ${data.details || 'fatal'}`)
                  break
              }
            }
          })
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = activeServerUrl
          if (!startPausedRef.current) {
            video.play().catch(() => {})
          }
        } else {
          failoverToNextServer('HLS playback is not supported on this browser.')
        }
      } else if (videoType === 'mp4') {
        video.src = activeServerUrl
        video.muted = isMutedRef.current
        video.volume = volumeRef.current > 0 ? volumeRef.current : 1
        video.playbackRate = playbackRateRef.current
        video.load()
        if (!startPausedRef.current) {
          const playPromise = video.play()
          if (playPromise !== undefined) {
            playPromise.catch(() => {
              video.play().catch(() => {})
            })
          }
        }
      }
    }

    setupPlayer()

    const videoEl = videoRef.current
    return () => {
      isMounted = false
      clearWatchdog()
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
      if (videoEl) {
        videoEl.pause()
        videoEl.removeAttribute('src')
        videoEl.load()
      }
    }
  }, [
    activeServerUrl,
    videoType,
    serverConfig,
    failoverToNextServer,
    activeServerIdx,
    clearWatchdog,
    isMutedRef,
    volumeRef,
    playbackRateRef
  ])

  const handleLoadedMetadata = useCallback(() => {
    clearWatchdog()
    const video = videoRef.current
    if (!video) return
    const dur = video.duration || 0
    setDuration(dur)

    video.muted = isMutedRef.current
    video.volume = volumeRef.current > 0 ? volumeRef.current : 1
    video.playbackRate = playbackRateRef.current

    if (video.videoHeight) {
      setMp4QualityLabel(`${video.videoHeight}p`)
    }

    // Seamless exact handoff between Inline Watch <-> Bottom-Right PiP takes precedence
    if (!hasResumedRef.current && exactHandoffSeconds > 0 && exactHandoffSeconds < dur - 1) {
      video.currentTime = exactHandoffSeconds
      hasResumedRef.current = true
    } else if (
      !hasResumedRef.current &&
      savedProgressSeconds > 10 &&
      savedProgressSeconds < dur - 15
    ) {
      video.currentTime = savedProgressSeconds
      hasResumedRef.current = true
      setResumeNotice(`Resumed from ${formatTime(savedProgressSeconds)}`)
      setTimeout(() => setResumeNotice(null), 3500)
    }

    if (!startPausedRef.current && video.paused) {
      video.play().catch(() => {})
    }
  }, [
    clearWatchdog,
    isMutedRef,
    volumeRef,
    playbackRateRef,
    savedProgressSeconds,
    exactHandoffSeconds,
    setDuration,
    setResumeNotice
  ])

  const handleQualityChange = useCallback(
    (levelIndex: number) => {
      setSelectedQuality(levelIndex)
      if (hlsRef.current) {
        hlsRef.current.currentLevel = levelIndex
      }
      if (levelIndex === -1) {
        localStorage.setItem('autakimi-anime-preferred-quality', 'auto')
      } else {
        const chosen = qualityLevels.find((q) => q.index === levelIndex)
        if (chosen) {
          localStorage.setItem('autakimi-anime-preferred-quality', chosen.label)
          setCurrentQualityLabel(chosen.label)
        }
      }
    },
    [qualityLevels]
  )

  return {
    videoRef,
    hlsRef,
    watchdogRef,
    hasResumedRef,
    qualityLevels,
    setQualityLevels,
    selectedQuality,
    setSelectedQuality,
    currentQualityLabel,
    setCurrentQualityLabel,
    mp4QualityLabel,
    setMp4QualityLabel,
    handleLoadedMetadata,
    handleQualityChange,
    clearWatchdog
  }
}
