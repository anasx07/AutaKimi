import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import Hls from 'hls.js'
import {
  ArrowLeft,
  Loader2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Play,
  Pause,
  Menu,
  Zap,
  History,
  X,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  RotateCcw,
  RotateCw
} from 'lucide-react'
import {
  useLibraryStore,
  useExtensionStore,
  useProgressStore,
  useHistoryStore,
  useSettingsStore
} from '@renderer/shared/model'
import { Button } from '@renderer/shared/ui'
import { cn } from '@renderer/shared/lib/utils'
import { useMediaItems } from '@renderer/entities/media/api/useMediaQueries'
import { DataService } from '@renderer/shared/api'
import { ExtensionResolver } from '@renderer/shared/api/sources/resolver'
import { isMobile } from '@renderer/shared/platform'

export interface ServerItem {
  name: string
  url: string
  type?: 'hls' | 'mp4' | 'embed'
  headers?: Record<string, string>
  status?: 'alive' | 'dead' | 'checking' | 'untested'
  pingMs?: number
  error?: string
}

function getVideoType(server: any): 'hls' | 'mp4' | 'embed' {
  if (!server) return 'embed'
  if (typeof server === 'object' && server.type) {
    const t = String(server.type).toLowerCase()
    if (t === 'hls' || t === 'm3u8') return 'hls'
    if (t === 'mp4' || t === 'webm') return 'mp4'
    if (t === 'embed') return 'embed'
  }
  const url = typeof server === 'object' ? server.url || '' : String(server || '')
  const cleanUrl = url.split('?')[0].toLowerCase()
  const lowerUrl = url.toLowerCase()
  if (
    cleanUrl.endsWith('.m3u8') ||
    lowerUrl.includes('.m3u8') ||
    lowerUrl.includes('hls_proxy') ||
    lowerUrl.includes('mode=m3u8')
  ) {
    return 'hls'
  }
  if (
    cleanUrl.endsWith('.mp4') ||
    cleanUrl.endsWith('.webm') ||
    lowerUrl.includes('.mp4') ||
    lowerUrl.includes('stream_proxy')
  ) {
    return 'mp4'
  }
  return 'embed'
}

const AD_DOMAINS = [
  'a-ads.com',
  'doubleclick.net',
  'googlesyndication.com',
  'googleadservices.com',
  'popads.net',
  'propellerads.com',
  'adsterra.com',
  'exoclick.com',
  'juicyads.com',
  'trafficjunky.com',
  'adnxs.com',
  'adform.net',
  'wingsmob.com',
  'sleeklyyallaer.com',
  'luckypick.top',
  'bc.game',
  '1xbet',
  'melbet',
  'betway',
  'bet365'
]

function isAdUrl(url?: string): boolean {
  if (!url || typeof url !== 'string') return false
  const lower = url.toLowerCase().trim()
  if (!lower.startsWith('http://') && !lower.startsWith('https://') && !lower.startsWith('//')) {
    return false
  }
  for (const domain of AD_DOMAINS) {
    if (lower.includes(domain)) return true
  }
  if (
    (lower.includes('/ad/') || lower.includes('/ads/') || lower.includes('/banner/')) &&
    !lower.includes('.mp4') &&
    !lower.includes('.m3u8')
  ) {
    return true
  }
  return false
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

export default function AnimeViewer() {
  const mobile = isMobile()
  const platform = DataService.platform
  const { activeChapter, setActiveChapter, selectedManga } = useLibraryStore()
  const { activeExtension } = useExtensionStore()
  const { markChapterRead, loadProgress, pageProgress } = useProgressStore()
  const { addHistoryEntry, updateHistoryDuration } = useHistoryStore()
  const activeSessionRef = useRef<{ mangaId: string; chapterId: string; startTime: number } | null>(
    null
  )

  const containerRef = useRef<HTMLDivElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const hlsRef = useRef<Hls | null>(null)
  const progressBarRef = useRef<HTMLDivElement | null>(null)

  // Native Player State
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [bufferedPercent, setBufferedPercent] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isBuffering, setIsBuffering] = useState(false)
  const [hoverTime, setHoverTime] = useState<number | null>(null)
  const [hoverX, setHoverX] = useState<number>(0)
  const [resumeNotice, setResumeNotice] = useState<string | null>(null)

  const hasResumedRef = useRef(false)
  const lastProgressSaveRef = useRef(0)

  // Load reading/watching progress on manga load
  useEffect(() => {
    if (selectedManga?.id) {
      loadProgress(selectedManga.id)
    }
  }, [selectedManga?.id, loadProgress])

  const savedProgressSeconds = useMemo(() => {
    if (!selectedManga?.id || !activeChapter?.id) return 0
    return pageProgress[selectedManga.id]?.[activeChapter.id] || 0
  }, [selectedManga?.id, activeChapter?.id, pageProgress])

  // Finalize watching duration on unmount
  useEffect(() => {
    return () => {
      if (activeSessionRef.current) {
        const elapsed = Math.round((Date.now() - activeSessionRef.current.startTime) / 1000)
        if (elapsed > 0) {
          updateHistoryDuration({
            mangaId: activeSessionRef.current.mangaId,
            chapterId: activeSessionRef.current.chapterId,
            durationSeconds: elapsed
          })
        }
      }
    }
  }, [updateHistoryDuration])

  const { data: episodes = [] } = useMediaItems(
    'anime',
    selectedManga?.id || '',
    activeExtension || '',
    selectedManga?.url
  )

  const [servers, setServers] = useState<ServerItem[]>([])
  const [activeServerIdx, setActiveServerIdx] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const [showDebug, setShowDebug] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [isEpisodesOpen, setIsEpisodesOpen] = useState(false)
  const [isSwitchingServer, setIsSwitchingServer] = useState(false)
  const [switchingNotice, setSwitchingNotice] = useState<string | null>(null)
  const [autoNextCountdown, setAutoNextCountdown] = useState<number | null>(null)
  const { autoNextAnime, setAutoNextAnime, autoSwitchServer } = useSettingsStore()

  const controlsTimeoutRef = useRef<any | null>(null)
  const activeEpisodeRef = useRef<HTMLButtonElement | null>(null)
  const watchdogRef = useRef<any | null>(null)
  const loadGenerationRef = useRef(0)

  // Cinema Mode: Auto-hide controls
  useEffect(() => {
    const handleMouseMove = () => {
      setShowControls(true)
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current)
      controlsTimeoutRef.current = setTimeout(() => {
        if (!isEpisodesOpen) setShowControls(false)
      }, 3500)
    }

    window.addEventListener('mousemove', handleMouseMove)
    handleMouseMove()

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current)
    }
  }, [isEpisodesOpen])

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // Auto-scroll active episode into center view when opening drawer
  useEffect(() => {
    if (isEpisodesOpen && activeEpisodeRef.current) {
      setTimeout(() => {
        activeEpisodeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 100)
    }
  }, [isEpisodesOpen])

  // Auto-expand debug on error
  useEffect(() => {
    if (error) setShowDebug(true)
  }, [error])

  const sortedEpisodes = useMemo(() => {
    return [...episodes].sort((a, b) => (a.number || 0) - (b.number || 0))
  }, [episodes])

  const currentIndex = sortedEpisodes.findIndex((e) => e.id === activeChapter?.id)
  const nextEpisode =
    currentIndex !== -1 && currentIndex + 1 < sortedEpisodes.length
      ? sortedEpisodes[currentIndex + 1]
      : null
  const prevEpisode =
    currentIndex !== -1 && currentIndex > 0 ? sortedEpisodes[currentIndex - 1] : null

  // Auto-next countdown timer listener for iframe postMessage
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'videoEnded' || e.data?.event === 'ended') {
        if (autoNextAnime && nextEpisode) {
          setAutoNextCountdown(5)
        }
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [autoNextAnime, nextEpisode])

  useEffect(() => {
    if (autoNextCountdown === null) return
    if (autoNextCountdown <= 0) {
      setAutoNextCountdown(null)
      if (nextEpisode) setActiveChapter(nextEpisode)
      return
    }
    const timer = setTimeout(() => {
      setAutoNextCountdown((prev) => (prev !== null ? prev - 1 : null))
    }, 1000)
    return () => clearTimeout(timer)
  }, [autoNextCountdown, nextEpisode, setActiveChapter])

  const failoverToNextServer = useCallback(
    (reason?: string) => {
      console.warn(`[AnimeViewer] Server failover triggered: ${reason || 'Unknown failure'}`)

      if (watchdogRef.current) {
        clearTimeout(watchdogRef.current)
        watchdogRef.current = null
      }

      setServers((prevServers) => {
        if (!prevServers || prevServers.length === 0) {
          setError(reason || 'Failed to play video stream on this server.')
          return prevServers
        }

        // Mark current server as dead
        const updated = [...prevServers]
        if (updated[activeServerIdx]) {
          updated[activeServerIdx] = {
            ...updated[activeServerIdx],
            status: 'dead',
            error: reason
          }
        }

        if (!autoSwitchServer || updated.length <= 1) {
          setError(reason || `Server ${activeServerIdx + 1} failed to respond.`)
          return updated
        }

        // Search for next viable server:
        // Priority 1: Next server that is known 'alive' AND direct stream
        let nextIdx = -1
        for (let step = 1; step < updated.length; step++) {
          const checkIdx = (activeServerIdx + step) % updated.length
          const s = updated[checkIdx]
          if (s?.status === 'alive' && (s.type === 'hls' || s.type === 'mp4')) {
            nextIdx = checkIdx
            break
          }
        }

        // Priority 2: Next server that is known 'alive' (any type)
        if (nextIdx === -1) {
          for (let step = 1; step < updated.length; step++) {
            const checkIdx = (activeServerIdx + step) % updated.length
            if (updated[checkIdx]?.status === 'alive') {
              nextIdx = checkIdx
              break
            }
          }
        }

        // Priority 3: Next server that is 'checking' or 'untested'
        if (nextIdx === -1) {
          for (let step = 1; step < updated.length; step++) {
            const checkIdx = (activeServerIdx + step) % updated.length
            if (updated[checkIdx]?.status !== 'dead') {
              nextIdx = checkIdx
              break
            }
          }
        }

        if (nextIdx !== -1) {
          const target = updated[nextIdx]
          const targetName = target.name || `Server ${nextIdx + 1}`
          setIsSwitchingServer(true)
          setSwitchingNotice(`Switching to ${targetName} (${nextIdx + 1}/${updated.length})`)

          setTimeout(() => {
            setActiveServerIdx(nextIdx)
            setIsSwitchingServer(false)
            setError(null)
          }, 350)
        } else {
          setError('All streaming servers for this episode were tested and unreachable.')
        }

        return updated
      })
    },
    [activeServerIdx, autoSwitchServer]
  )

  const handleManualSwitch = useCallback(() => {
    if (servers.length <= 1) return

    // Find next server (prefer alive or not dead)
    let nextIdx = (activeServerIdx + 1) % servers.length
    for (let step = 1; step < servers.length; step++) {
      const checkIdx = (activeServerIdx + step) % servers.length
      if (servers[checkIdx]?.status !== 'dead') {
        nextIdx = checkIdx
        break
      }
    }

    setActiveServerIdx(nextIdx)
    const targetServer = servers[nextIdx]
    const sName = typeof targetServer === 'object' ? targetServer.name : targetServer
    if (sName) {
      localStorage.setItem('autakimi-anime-preferred-server', sName)
    }
  }, [servers, activeServerIdx])

  const loadServers = useCallback(async () => {
    if (!activeChapter || !activeExtension) return
    const currentGen = ++loadGenerationRef.current

    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current)
      watchdogRef.current = null
    }

    setLoading(true)
    setError(null)
    setIsSwitchingServer(false)

    try {
      console.log(`[AnimeViewer] Resolving source for: ${activeExtension}`)
      const source = await ExtensionResolver.resolve(activeExtension)
      if (!source) throw new Error('Could not resolve extension source.')

      console.log(`[AnimeViewer] Fetching servers from: ${source.name} (v${source.version})`)
      const res: any = await source.fetchPages(activeChapter.url)

      if (currentGen !== loadGenerationRef.current) return

      const urls = res?.urls || (Array.isArray(res) ? res : [])
      const debug = res?.debug || null
      setDebugInfo(debug)

      if (urls && urls.length > 0) {
        // Filter out obvious advertisement and banner URLs
        const validUrls = urls.filter((srv: any) => {
          const u = typeof srv === 'object' ? srv?.url : String(srv || '')
          return !isAdUrl(u)
        })

        if (validUrls.length === 0) {
          setError('No playable streaming servers found for this episode (ad-only feeds filtered).')
          return
        }

        // Normalize candidate server items
        const initialServers: ServerItem[] = validUrls.map((srv: any, idx: number) => {
          if (typeof srv === 'object') {
            return {
              name: srv.name || `Server ${idx + 1}`,
              url: srv.url,
              type: srv.type || getVideoType(srv),
              headers: srv.headers,
              status: 'checking'
            }
          }
          return {
            name: `Server ${idx + 1}`,
            url: String(srv),
            type: getVideoType(srv),
            status: 'checking'
          }
        })

        setServers(initialServers)

        // Find initial optimistic target index: ALWAYS prioritize direct native streams
        const hasDirectServers = initialServers.some((s) => s.type === 'hls' || s.type === 'mp4')
        const lastServer = localStorage.getItem('autakimi-anime-preferred-server')
        let targetIdx = -1
        if (lastServer) {
          targetIdx = initialServers.findIndex((s) => s.name === lastServer)
        }
        if (targetIdx === -1 || (hasDirectServers && initialServers[targetIdx]?.type === 'embed')) {
          const directIdx = initialServers.findIndex((s) => s.type === 'hls' || s.type === 'mp4')
          targetIdx = directIdx !== -1 ? directIdx : 0
        }
        setActiveServerIdx(targetIdx)

        // Concurrently probe all servers in the background with strict timeout
        const probePromises = initialServers.map(async (srv, i) => {
          try {
            const probeRes = await DataService.probeStream(srv.url, srv.headers, 2500)
            return {
              i,
              status: (probeRes.alive ? 'alive' : 'dead') as 'alive' | 'dead',
              pingMs: probeRes.pingMs,
              error: probeRes.error
            }
          } catch {
            return {
              i,
              status: 'dead' as const,
              error: 'Probe error'
            }
          }
        })

        Promise.all(probePromises).then((results) => {
          if (currentGen !== loadGenerationRef.current) return
          let nextAliveIdx = -1

          setServers((prevServers) => {
            const updated = prevServers.map((srv, i) => {
              const res = results.find((r) => r.i === i)
              if (!res) return srv
              return {
                ...srv,
                status: res.status,
                pingMs: res.pingMs,
                error: res.error
              }
            })

            const current = updated[targetIdx]
            if (current && current.status === 'dead') {
              const aliveDirectIdx = updated.findIndex(
                (s) => s.status === 'alive' && (s.type === 'hls' || s.type === 'mp4')
              )
              if (aliveDirectIdx !== -1) {
                nextAliveIdx = aliveDirectIdx
              } else {
                nextAliveIdx = updated.findIndex((s) => s.status === 'alive')
              }
            }

            return updated
          })

          if (nextAliveIdx !== -1 && nextAliveIdx !== targetIdx) {
            console.warn(
              `[AnimeViewer] Initial server probed DEAD, fast-switching to index ${nextAliveIdx}...`
            )
            setActiveServerIdx(nextAliveIdx)
          }
        })

        // Trigger history immediately when servers are ready
        if (selectedManga && activeChapter) {
          if (
            activeSessionRef.current &&
            (activeSessionRef.current.mangaId !== selectedManga.id ||
              activeSessionRef.current.chapterId !== activeChapter.id)
          ) {
            const elapsed = Math.round((Date.now() - activeSessionRef.current.startTime) / 1000)
            if (elapsed > 0) {
              updateHistoryDuration({
                mangaId: activeSessionRef.current.mangaId,
                chapterId: activeSessionRef.current.chapterId,
                durationSeconds: elapsed
              })
            }
          }

          activeSessionRef.current = {
            mangaId: selectedManga.id,
            chapterId: activeChapter.id,
            startTime: Date.now()
          }

          const existingProgress =
            useProgressStore.getState().pageProgress[selectedManga.id]?.[activeChapter.id] ||
            undefined

          markChapterRead(
            selectedManga.id,
            activeChapter.id,
            true,
            existingProgress,
            Number(activeChapter.number) || undefined
          )
          addHistoryEntry({
            mangaId: selectedManga.id,
            mangaTitle: selectedManga.title,
            chapterId: activeChapter.id,
            chapterTitle: activeChapter.title || undefined,
            startedAt: new Date().toISOString(),
            durationSeconds: 0,
            pkg: activeExtension || undefined,
            type: 'anime'
          })
        }
      } else {
        setError('No streaming servers found for this episode.')
      }
    } catch (err: any) {
      console.error('[AnimeViewer] Failed to load servers:', err)
      setError(err?.message || 'Failed to load streaming servers.')
    } finally {
      if (currentGen === loadGenerationRef.current) {
        setLoading(false)
      }
    }
  }, [
    activeChapter?.id,
    activeChapter?.url,
    activeChapter?.number,
    activeChapter?.title,
    activeExtension,
    selectedManga?.id,
    selectedManga?.title
  ])

  useEffect(() => {
    loadServers()
  }, [activeChapter?.id, activeExtension])

  const s = servers[activeServerIdx]
  const activeServerUrl = typeof s === 'object' ? (s as any)?.url : s
  const videoType = useMemo(() => getVideoType(s), [s])

  // Automatically append autoplay parameters to embed URLs so they trigger playback immediately
  const activeEmbedUrl = useMemo(() => {
    if (videoType !== 'embed' || !activeServerUrl) return activeServerUrl
    try {
      const parsed = new URL(activeServerUrl)
      if (!parsed.searchParams.has('autoplay')) {
        parsed.searchParams.set('autoplay', '1')
      }
      return parsed.toString()
    } catch {
      if (!activeServerUrl.includes('autoplay=')) {
        return activeServerUrl.includes('?')
          ? `${activeServerUrl}&autoplay=1`
          : `${activeServerUrl}?autoplay=1`
      }
      return activeServerUrl
    }
  }, [activeServerUrl, videoType])

  // Reset player state on episode or server change
  useEffect(() => {
    hasResumedRef.current = false
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    setBufferedPercent(0)
    setIsBuffering(false)
  }, [activeChapter?.id, activeServerIdx])

  // Setup HLS / Video playback & attach proxy headers
  useEffect(() => {
    if (!activeServerUrl) return

    let isMounted = true

    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current)
      watchdogRef.current = null
    }

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
        if (watchdogRef.current) {
          clearTimeout(watchdogRef.current)
          watchdogRef.current = null
        }
      }
    }

    const setupPlayer = async () => {
      if (typeof s === 'object' && s?.headers && Object.keys(s.headers).length > 0) {
        try {
          await DataService.setStreamHeaders(activeServerUrl, s.headers)
        } catch (err) {
          console.warn('[AnimeViewer] Failed to set stream headers:', err)
        }
      }

      if (!isMounted) return
      const video = videoRef.current
      if (!video) return

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

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (watchdogRef.current) {
              clearTimeout(watchdogRef.current)
              watchdogRef.current = null
            }
            if (isMounted) {
              const playPromise = video.play()
              if (playPromise !== undefined) {
                playPromise.catch(() => {
                  video.muted = true
                  setIsMuted(true)
                  video.play().catch(() => {})
                })
              }
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
          video.play().catch(() => {})
        } else {
          failoverToNextServer('HLS playback is not supported on this browser.')
        }
      } else if (videoType === 'mp4') {
        video.src = activeServerUrl
        video.load()
        const playPromise = video.play()
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            video.muted = true
            setIsMuted(true)
            video.play().catch(() => {})
          })
        }
      }
    }

    setupPlayer()

    return () => {
      isMounted = false
      if (watchdogRef.current) {
        clearTimeout(watchdogRef.current)
        watchdogRef.current = null
      }
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
      if (videoRef.current) {
        videoRef.current.pause()
        videoRef.current.removeAttribute('src')
        videoRef.current.load()
      }
    }
  }, [activeServerUrl, videoType, s, failoverToNextServer, activeServerIdx])

  const handleLoadedMetadata = () => {
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current)
      watchdogRef.current = null
    }
    const video = videoRef.current
    if (!video) return
    const dur = video.duration || 0
    setDuration(dur)

    // Auto-resume from saved progress if user was at least 10s into the video
    // and not within the last 15 seconds
    if (!hasResumedRef.current && savedProgressSeconds > 10 && savedProgressSeconds < dur - 15) {
      video.currentTime = savedProgressSeconds
      hasResumedRef.current = true
      setResumeNotice(`Resumed from ${formatTime(savedProgressSeconds)}`)
      setTimeout(() => setResumeNotice(null), 3500)
    }

    if (video.paused) {
      video.play().catch(() => {})
    }
  }

  const handleTimeUpdate = () => {
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current)
      watchdogRef.current = null
    }
    const video = videoRef.current
    if (!video) return
    setCurrentTime(video.currentTime)

    // Calculate buffered percentage
    if (video.buffered.length > 0) {
      const bufferedEnd = video.buffered.end(video.buffered.length - 1)
      const dur = video.duration || 1
      setBufferedPercent(Math.min(100, (bufferedEnd / dur) * 100))
    }

    // Throttle database progress save every 4 seconds
    const currentSec = Math.floor(video.currentTime)
    if (
      selectedManga &&
      activeChapter &&
      currentSec > 0 &&
      Math.abs(currentSec - lastProgressSaveRef.current) >= 4
    ) {
      lastProgressSaveRef.current = currentSec
      markChapterRead(selectedManga.id, activeChapter.id, true, currentSec)
    }
  }

  const handleVideoEnded = () => {
    setIsPlaying(false)
    if (selectedManga && activeChapter && duration > 0) {
      markChapterRead(
        selectedManga.id,
        activeChapter.id,
        true,
        Math.floor(duration),
        Number(activeChapter.number) || undefined
      )
    }
    if (autoNextAnime && nextEpisode) {
      setAutoNextCountdown(5)
    }
  }

  const handleVideoError = () => {
    console.error('[AnimeViewer] Native video playback error')
    failoverToNextServer(`Server ${activeServerIdx + 1} stream playback error.`)
  }

  const togglePlay = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      video.play().catch(() => {})
    } else {
      video.pause()
    }
  }, [])

  const seekBy = useCallback((seconds: number) => {
    const video = videoRef.current
    if (!video) return
    const target = Math.max(0, Math.min(video.duration || 0, video.currentTime + seconds))
    video.currentTime = target
    setCurrentTime(target)
  }, [])

  const adjustVolume = useCallback((delta: number) => {
    const video = videoRef.current
    if (!video) return
    const newVol = Math.max(0, Math.min(1, Number((video.volume + delta).toFixed(2))))
    video.volume = newVol
    video.muted = newVol === 0
    setVolume(newVol)
    setIsMuted(newVol === 0)
  }, [])

  const toggleMute = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (isMuted) {
      video.muted = false
      setIsMuted(false)
      video.volume = volume || 1
    } else {
      video.muted = true
      setIsMuted(true)
    }
  }, [isMuted, volume])

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value)
    setVolume(val)
    setIsMuted(val === 0)
    if (videoRef.current) {
      videoRef.current.volume = val
      videoRef.current.muted = val === 0
    }
  }

  const changeSpeed = () => {
    const speedOptions = [0.5, 0.75, 1, 1.25, 1.5, 2]
    const curIdx = speedOptions.indexOf(playbackRate)
    const nextIdx = (curIdx + 1) % speedOptions.length
    const newSpeed = speedOptions[nextIdx]
    setPlaybackRate(newSpeed)
    if (videoRef.current) {
      videoRef.current.playbackRate = newSpeed
    }
  }

  const toggleFullscreen = useCallback(async () => {
    // 1. Desktop native window fullscreen via Electron
    if (typeof window !== 'undefined' && window.api?.window) {
      try {
        const isFull = await DataService.window.isFullScreen()
        const target = !isFull
        await DataService.window.setFullScreen(target)
        setIsFullscreen(target)
        return
      } catch (err) {
        console.warn('[AnimeViewer] Native window fullscreen toggle failed, using fallback:', err)
      }
    }

    // 2. HTML5 Fullscreen fallback
    if (!document.fullscreenElement) {
      const container = containerRef.current || document.documentElement
      if (container.requestFullscreen) {
        container
          .requestFullscreen()
          .then(() => setIsFullscreen(true))
          .catch(() => {})
      }
    } else {
      if (document.exitFullscreen) {
        document
          .exitFullscreen()
          .then(() => setIsFullscreen(false))
          .catch(() => {})
      }
    }
  }, [])

  // Sync fullscreen state with HTML5 / Electron and clean up on unmount
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isHtml5 = !!document.fullscreenElement
      if (typeof window !== 'undefined' && window.api?.window) {
        DataService.window
          .isFullScreen()
          .then((isNative) => {
            setIsFullscreen(Boolean(isNative || isHtml5))
          })
          .catch(() => {
            setIsFullscreen(isHtml5)
          })
      } else {
        setIsFullscreen(isHtml5)
      }
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)

    // Check initial native fullscreen state
    if (typeof window !== 'undefined' && window.api?.window) {
      DataService.window
        .isFullScreen()
        .then((isNative) => {
          if (isNative) setIsFullscreen(true)
        })
        .catch(() => {})
    }

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      // When exiting anime viewer, restore native window from fullscreen
      if (typeof window !== 'undefined' && window.api?.window) {
        DataService.window
          .isFullScreen()
          .then((isNative) => {
            if (isNative) {
              DataService.window.setFullScreen(false).catch(() => {})
            }
          })
          .catch(() => {})
      }
    }
  }, [])

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !videoRef.current || !duration) return
    const rect = progressBarRef.current.getBoundingClientRect()
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const newTime = pos * duration
    videoRef.current.currentTime = newTime
    setCurrentTime(newTime)
  }

  const handleMouseMoveProgressBar = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !duration) return
    const rect = progressBarRef.current.getBoundingClientRect()
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    setHoverTime(pos * duration)
    setHoverX(e.clientX - rect.left)
  }

  const handleMouseLeaveProgressBar = () => {
    setHoverTime(null)
  }

  const reloadPlayer = useCallback(() => {
    if (videoType !== 'embed' && videoRef.current) {
      const cur = videoRef.current.currentTime
      if (videoType === 'hls' && hlsRef.current) {
        hlsRef.current.stopLoad()
        hlsRef.current.startLoad()
      } else {
        videoRef.current.load()
      }
      videoRef.current.currentTime = cur
      videoRef.current.play().catch(() => {})
    } else {
      const iframe = document.querySelector('iframe')
      if (iframe && iframe.src) {
        try {
          const currentSrc = iframe.src
          iframe.src = currentSrc
        } catch {
          loadServers()
        }
      } else {
        loadServers()
      }
    }
  }, [videoType, loadServers])

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault()
          if (videoType !== 'embed' && videoRef.current) {
            togglePlay()
          } else {
            try {
              const iframe = document.querySelector('iframe')
              iframe?.contentWindow?.postMessage({ type: 'togglePlay' }, '*')
            } catch {}
          }
          break
        case 'f':
          e.preventDefault()
          toggleFullscreen()
          break
        case 'arrowleft':
        case 'j':
          e.preventDefault()
          if (videoType !== 'embed' && videoRef.current) {
            seekBy(-10)
          } else {
            try {
              const iframe = document.querySelector('iframe')
              iframe?.contentWindow?.postMessage({ type: 'seek', offset: -10 }, '*')
            } catch {}
          }
          break
        case 'arrowright':
        case 'l':
          e.preventDefault()
          if (videoType !== 'embed' && videoRef.current) {
            seekBy(10)
          } else {
            try {
              const iframe = document.querySelector('iframe')
              iframe?.contentWindow?.postMessage({ type: 'seek', offset: 10 }, '*')
            } catch {}
          }
          break
        case 'arrowup':
          e.preventDefault()
          if (videoType !== 'embed' && videoRef.current) {
            adjustVolume(0.1)
          } else {
            try {
              const iframe = document.querySelector('iframe')
              iframe?.contentWindow?.postMessage({ type: 'volume', delta: 0.1 }, '*')
            } catch {}
          }
          break
        case 'arrowdown':
          e.preventDefault()
          if (videoType !== 'embed' && videoRef.current) {
            adjustVolume(-0.1)
          } else {
            try {
              const iframe = document.querySelector('iframe')
              iframe?.contentWindow?.postMessage({ type: 'volume', delta: -0.1 }, '*')
            } catch {}
          }
          break
        case 'n':
          if (nextEpisode) setActiveChapter(nextEpisode)
          break
        case 'p':
          if (prevEpisode) setActiveChapter(prevEpisode)
          break
        case 'm':
          e.preventDefault()
          if (videoRef.current) {
            const nextMuted = !isMuted
            videoRef.current.muted = nextMuted
            setIsMuted(nextMuted)
          }
          break
        case 'e':
          e.preventDefault()
          setIsEpisodesOpen((prev) => !prev)
          break
        case 't':
          e.preventDefault()
          if (isFullscreen) {
            toggleFullscreen()
          }
          break
        case 'escape':
          if (isFullscreen) {
            e.preventDefault()
            toggleFullscreen()
          } else if (isEpisodesOpen) {
            setIsEpisodesOpen(false)
          } else {
            setActiveChapter(null)
          }
          break
        case 'r':
          e.preventDefault()
          reloadPlayer()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    videoType,
    togglePlay,
    seekBy,
    adjustVolume,
    toggleFullscreen,
    isFullscreen,
    isMuted,
    nextEpisode,
    prevEpisode,
    isEpisodesOpen,
    setActiveChapter,
    reloadPlayer
  ])

  if (!activeChapter || !selectedManga) return null

  return (
    <div
      ref={containerRef}
      className={cn(
        'fixed inset-0 bg-black z-[100] flex flex-col overflow-hidden animate-in fade-in duration-500 text-white select-none',
        !showControls && 'cursor-none',
        mobile && 'pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]'
      )}
    >
      {/* Top Header Overlay */}
      <div
        className={cn(
          'absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-black/85 via-black/50 to-transparent backdrop-blur-sm px-6 flex items-center justify-between z-40 transition-all duration-500',
          !showControls && 'translate-y-[-110%] opacity-0 pointer-events-none'
        )}
        style={{ WebkitAppRegion: !isFullscreen ? 'drag' : 'no-drag' } as any}
      >
        <div
          className={cn(
            'flex items-center gap-4',
            platform === 'darwin' && !isFullscreen && 'pl-20'
          )}
          style={{ WebkitAppRegion: 'no-drag' } as any}
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (isFullscreen) {
                toggleFullscreen()
              }
              setActiveChapter(null)
            }}
            className="h-10 w-10 text-white/70 hover:text-white hover:bg-white/10 rounded-full"
            title="Back to Details (Esc)"
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
        </div>

        {/* Centered Title Section */}
        <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center min-w-0 text-center pointer-events-none">
          <h1 className="text-base font-black tracking-tighter text-white truncate max-w-[200px] sm:max-w-md uppercase italic drop-shadow-md">
            {selectedManga.title}
          </h1>
          <div className="flex items-center gap-2 text-[10px] text-white/40 font-bold uppercase tracking-widest drop-shadow-sm">
            <span className="bg-primary/20 text-primary px-1.5 py-0.5 rounded text-[9px]">
              EP {activeChapter.number}
            </span>
            <span className="truncate max-w-[150px] opacity-60 italic">
              {activeChapter.title || 'Watching Now'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3" style={{ WebkitAppRegion: 'no-drag' } as any}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAutoNextAnime(!autoNextAnime)}
            className={cn(
              'h-9 px-3 text-[11px] font-bold rounded-full border transition-all',
              autoNextAnime
                ? 'bg-primary/20 border-primary/50 text-primary hover:bg-primary/30'
                : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
            )}
          >
            <Zap className={cn('h-3.5 w-3.5 mr-2', autoNextAnime && 'fill-current')} />
            Auto-Next
          </Button>

          {servers.length > 1 && (
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-white/5 backdrop-blur-md rounded-full px-4 py-1.5 border border-white/10">
                <span className="text-[10px] text-white/40 font-bold mr-3 uppercase tracking-tighter">
                  Server
                </span>
                <select
                  value={activeServerIdx}
                  onChange={(e) => {
                    const idx = parseInt(e.target.value)
                    setActiveServerIdx(idx)
                    const server = servers[idx]
                    const sName = typeof server === 'object' ? server.name : server
                    if (sName) {
                      localStorage.setItem('autakimi-anime-preferred-server', sName)
                    }
                  }}
                  className="bg-transparent text-xs text-primary font-bold outline-none cursor-pointer min-w-[80px]"
                >
                  {servers.map((srv: any, i) => {
                    const name = typeof srv === 'object' ? srv.name : `Server ${i + 1}`
                    const isAlive = srv.status === 'alive'
                    const isDead = srv.status === 'dead'
                    const isChecking = srv.status === 'checking'
                    const isDirect = srv.type === 'hls' || srv.type === 'mp4'
                    const badge = isAlive
                      ? isDirect
                        ? '🟢⚡ '
                        : '🟢 '
                      : isDead
                        ? '🔴 '
                        : isChecking
                          ? '⏳ '
                          : isDirect
                            ? '⚡ '
                            : '🌐 '
                    const ping = srv.pingMs ? ` (${srv.pingMs}ms)` : ''
                    const displayName = `${badge}${name}${ping}`
                    return (
                      <option key={i} value={i} className="bg-neutral-900 text-white">
                        {displayName}
                      </option>
                    )
                  })}
                </select>
              </div>
              <Button
                variant="ghost"
                size="icon"
                title="Mirror/Switch to Next Working Server"
                onClick={handleManualSwitch}
                className="h-9 w-9 text-primary/60 hover:text-primary hover:bg-primary/10 rounded-full"
              >
                <RefreshCw className="h-4.5 w-4.5" />
              </Button>
            </div>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={reloadPlayer}
            className="h-9 w-9 text-white/60 hover:text-white hover:bg-white/10 rounded-full"
            title="Reload Player (R)"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsEpisodesOpen(!isEpisodesOpen)}
            className={cn(
              'h-10 w-10 rounded-full transition-all',
              isEpisodesOpen
                ? 'bg-primary text-white'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            )}
            title="Episodes List (E)"
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* Reserved Space for Native Windows Caption Buttons (— ❐ ✕) in Windowed/Cinematic Mode */}
          {platform === 'win32' && !isFullscreen && (
            <div className="w-[140px] h-8 shrink-0 pointer-events-none" />
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative flex items-center justify-center bg-black group">
        {/* Navigation Overlays (Invisible zones for quick prev/next on sides) */}
        {!loading && !error && (
          <>
            <div
              className={cn(
                'absolute left-0 top-0 bottom-0 w-24 z-30 cursor-pointer transition-all duration-300 bg-gradient-to-r from-black/60 to-transparent flex items-center justify-start pl-6',
                showControls ? 'opacity-100' : 'opacity-0 pointer-events-none',
                !prevEpisode && 'hidden'
              )}
              onClick={() => prevEpisode && setActiveChapter(prevEpisode)}
            >
              <ChevronLeft className="h-10 w-10 text-white/30 hover:text-white/70 transition-colors" />
            </div>

            <div
              className={cn(
                'absolute right-0 top-0 bottom-0 w-24 z-30 cursor-pointer transition-all duration-300 bg-gradient-to-l from-black/60 to-transparent flex items-center justify-end pr-6',
                showControls ? 'opacity-100' : 'opacity-0 pointer-events-none',
                !nextEpisode && 'hidden'
              )}
              onClick={() => nextEpisode && setActiveChapter(nextEpisode)}
            >
              <ChevronRight className="h-10 w-10 text-white/30 hover:text-white/70 transition-colors" />
            </div>
          </>
        )}

        {isSwitchingServer && (
          <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
            <div className="relative">
              <RefreshCw className="h-14 w-14 text-primary animate-spin opacity-20" />
              <Loader2 className="absolute inset-0 h-14 w-14 text-primary animate-spin" />
            </div>
            <div className="mt-6 text-center space-y-1">
              <h2 className="text-lg font-bold tracking-tight text-white uppercase italic">
                Switching Server
              </h2>
              <p className="text-xs text-white/60 font-medium tracking-widest uppercase">
                {switchingNotice ||
                  `Trying alternative source (${activeServerIdx + 1}/${servers.length})`}
              </p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center gap-4 text-neutral-500">
            <Loader2 className="h-10 w-10 animate-spin text-primary opacity-50" />
            <p className="text-sm font-medium animate-pulse italic tracking-widest uppercase">
              Initializing player...
            </p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-6 p-8 text-center max-w-2xl bg-neutral-900/50 rounded-2xl border border-white/5 backdrop-blur-xl z-20">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
              <Play className="h-8 w-8 rotate-180" />
            </div>
            <div className="space-y-2">
              <p className="text-xl font-bold text-neutral-200">
                {error.includes('No streaming servers') || error.includes('failed to respond')
                  ? 'This Video is not available on this Server at this time.'
                  : error}
              </p>
              <p className="text-sm text-white/40 max-w-md mx-auto italic">
                Please try changing to another server or resolving Cloudflare protection.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button
                onClick={loadServers}
                className="bg-primary hover:bg-primary/90 text-white gap-2 font-bold"
              >
                <RefreshCw className="h-4 w-4" /> Retry All Servers
              </Button>
              <Button
                onClick={() => DataService.openInternalBrowser(activeChapter.url)}
                variant="outline"
                className="border-neutral-700 text-neutral-200 hover:bg-neutral-800 gap-2 font-bold"
              >
                <RefreshCw className="h-4 w-4" /> Resolve Cloudflare
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowDebug(!showDebug)}
                className="border-neutral-700 text-neutral-400 gap-2"
              >
                {showDebug ? 'Hide Debug' : 'Show Debug Info'}
              </Button>
              {servers.length > 1 && (
                <Button
                  variant="ghost"
                  onClick={handleManualSwitch}
                  className="text-primary hover:bg-primary/10 gap-2 font-bold"
                >
                  <RefreshCw className="h-4 w-4" /> Try Next Server
                </Button>
              )}
            </div>

            {showDebug && (
              <div className="w-full mt-4 text-left p-4 bg-black/60 rounded-lg border border-white/10 font-mono text-[10px] space-y-2 overflow-x-auto max-h-60">
                <p className="text-primary font-bold uppercase tracking-wider border-b border-primary/20 pb-1 mb-2">
                  Technical Logs
                </p>
                {debugInfo ? (
                  <div className="grid grid-cols-[100px_1fr] gap-x-2 gap-y-1">
                    <span className="text-neutral-500">Target URL:</span>
                    <span className="text-neutral-300 break-all">{debugInfo.url}</span>
                    <span className="text-neutral-500">HTML Bytes:</span>
                    <span
                      className={cn(
                        'font-bold',
                        debugInfo.htmlLength > 1000 ? 'text-green-500' : 'text-red-500'
                      )}
                    >
                      {debugInfo.htmlLength} {debugInfo.htmlLength < 500 ? '(Likely blocked)' : ''}
                    </span>
                    <span className="text-neutral-500">CF Blocked:</span>
                    <span className={debugInfo.isBlocked ? 'text-amber-500' : 'text-green-500'}>
                      {debugInfo.isBlocked ? 'YES (Challenge Detected)' : 'NO (Clear HTML)'}
                    </span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded text-[9px] text-amber-200 font-mono">
                      <p>⚠️ No structured telemetry returned from extension.</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : activeServerUrl ? (
          videoType === 'embed' ? (
            <iframe
              key={activeEmbedUrl}
              src={activeEmbedUrl}
              className="w-full h-full border-none shadow-2xl bg-black"
              allowFullScreen
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              title="Video Player"
              onLoad={() => {
                if (watchdogRef.current) {
                  clearTimeout(watchdogRef.current)
                  watchdogRef.current = null
                }
              }}
              onError={() => {
                failoverToNextServer(`Server ${activeServerIdx + 1} failed to respond.`)
              }}
            />
          ) : (
            <div
              className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden"
              onClick={togglePlay}
              onDoubleClick={toggleFullscreen}
            >
              <video
                ref={videoRef}
                className="w-full h-full object-contain cursor-pointer"
                playsInline
                autoPlay
                onLoadedMetadata={handleLoadedMetadata}
                onTimeUpdate={handleTimeUpdate}
                onCanPlay={() => {
                  if (watchdogRef.current) {
                    clearTimeout(watchdogRef.current)
                    watchdogRef.current = null
                  }
                  if (videoRef.current && videoRef.current.paused) {
                    videoRef.current.play().catch(() => {})
                  }
                }}
                onPlay={() => {
                  if (watchdogRef.current) {
                    clearTimeout(watchdogRef.current)
                    watchdogRef.current = null
                  }
                  setIsPlaying(true)
                }}
                onPause={() => setIsPlaying(false)}
                onWaiting={() => setIsBuffering(true)}
                onPlaying={() => {
                  if (watchdogRef.current) {
                    clearTimeout(watchdogRef.current)
                    watchdogRef.current = null
                  }
                  setIsBuffering(false)
                }}
                onEnded={handleVideoEnded}
                onError={handleVideoError}
              >
                {typeof s === 'object' &&
                  Array.isArray((s as any).subtitles) &&
                  (s as any).subtitles.map((sub: any, idx: number) => (
                    <track
                      key={sub.url || idx}
                      kind="subtitles"
                      src={sub.url}
                      srcLang={sub.lang || 'en'}
                      label={sub.label || sub.lang || `Track ${idx + 1}`}
                      default={sub.default || idx === 0}
                    />
                  ))}
              </video>

              {/* Buffering Indicator */}
              {isBuffering && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                  <div className="p-4 rounded-full bg-black/60 backdrop-blur-md">
                    <Loader2 className="h-10 w-10 text-primary animate-spin" />
                  </div>
                </div>
              )}
            </div>
          )
        ) : null}
      </div>

      {/* Resume Progress Toast */}
      {resumeNotice && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-black/80 backdrop-blur-md border border-primary/40 px-4 py-2 rounded-full text-xs font-bold text-primary shadow-xl animate-in fade-in slide-in-from-top-2 duration-300">
          {resumeNotice}
        </div>
      )}

      {/* Episodes Sidebar Overlay */}
      <div
        className={cn(
          'absolute right-0 top-0 bottom-0 w-80 bg-neutral-900/95 backdrop-blur-2xl border-l border-white/10 z-50 transition-transform duration-500 ease-in-out flex flex-col pt-8',
          !isEpisodesOpen && 'translate-x-full'
        )}
      >
        <div className="h-16 flex items-center justify-between px-6 border-b border-white/5 mt-2">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            Episodes
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsEpisodesOpen(false)}
            className="h-8 w-8 rounded-full"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
          {sortedEpisodes.map((ep) => (
            <button
              key={ep.id}
              ref={ep.id === activeChapter.id ? activeEpisodeRef : null}
              onClick={() => {
                setActiveChapter(ep)
                setIsEpisodesOpen(false)
              }}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group',
                ep.id === activeChapter.id
                  ? 'bg-primary text-white shadow-lg shadow-primary/20 font-bold'
                  : 'hover:bg-white/5 text-neutral-400 hover:text-white'
              )}
            >
              <div
                className={cn(
                  'h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold transition-colors',
                  ep.id === activeChapter.id
                    ? 'bg-white/20'
                    : 'bg-neutral-800 group-hover:bg-neutral-700'
                )}
              >
                {ep.number}
              </div>
              <div className="flex flex-col items-start min-w-0">
                <span className="text-[11px] truncate w-full">Episode {ep.number}</span>
                {ep.title && (
                  <span className="text-[9px] opacity-60 truncate w-full">{ep.title}</span>
                )}
              </div>
              {ep.id === activeChapter.id && (
                <Play className="h-3 w-3 ml-auto fill-current animate-pulse" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Bottom Floating Navigation (HUD) for Embed/Iframe Mode */}
      {videoType === 'embed' && (
        <div
          className={cn(
            'absolute bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-2 p-1 bg-black/40 backdrop-blur-xl border border-white/10 rounded-full z-40 transition-all duration-500',
            !showControls && 'translate-y-[150%] opacity-0 pointer-events-none'
          )}
        >
          <Button
            variant="ghost"
            size="icon"
            disabled={!prevEpisode}
            onClick={() => prevEpisode && setActiveChapter(prevEpisode)}
            className="h-12 w-12 rounded-full text-white/50 hover:text-white hover:bg-white/10 disabled:opacity-20 transition-colors"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>

          <div className="h-8 w-px bg-white/10 mx-1" />

          <div className="px-6 py-2 flex flex-col items-center justify-center min-w-[140px]">
            <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest leading-none mb-1">
              Playing Now
            </span>
            <span className="text-xs font-bold text-primary tracking-tight">
              EPISODE {activeChapter.number}
            </span>
          </div>

          <div className="h-8 w-px bg-white/10 mx-1" />

          <Button
            variant="ghost"
            size="icon"
            disabled={!nextEpisode}
            onClick={() => nextEpisode && setActiveChapter(nextEpisode)}
            className="h-12 w-12 rounded-full text-white/50 hover:text-white hover:bg-white/10 disabled:opacity-20 transition-colors"
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        </div>
      )}

      {/* Native Video Player Control Bar */}
      {videoType !== 'embed' && !loading && !error && activeServerUrl && (
        <div
          className={cn(
            'absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent pt-12 pb-4 px-6 z-40 flex flex-col gap-2 transition-all duration-500',
            !showControls && 'translate-y-[110%] opacity-0 pointer-events-none'
          )}
          onClick={(e) => e.stopPropagation()}
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
                className="absolute -top-7 -translate-x-1/2 px-2 py-0.5 rounded bg-neutral-900/90 backdrop-blur border border-white/20 text-[10px] font-mono text-white pointer-events-none"
                style={{ left: `${hoverX}px` }}
              >
                {formatTime(hoverTime)}
              </div>
            )}
          </div>

          {/* Controls Row */}
          <div className="flex items-center justify-between">
            {/* Left Controls */}
            <div className="flex items-center gap-3">
              {/* Play / Pause */}
              <Button
                variant="ghost"
                size="icon"
                onClick={togglePlay}
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
                onClick={() => prevEpisode && setActiveChapter(prevEpisode)}
                className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-20 rounded-full"
                title="Previous Episode (P)"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              {/* Skip Back 10s */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => seekBy(-10)}
                className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10 rounded-full"
                title="Rewind 10s (ArrowLeft)"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>

              {/* Skip Forward 10s */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => seekBy(10)}
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
                onClick={() => nextEpisode && setActiveChapter(nextEpisode)}
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
                  onClick={toggleMute}
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
                  onChange={handleVolumeChange}
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

            {/* Right Controls */}
            <div className="flex items-center gap-2">
              {/* Speed */}
              <Button
                variant="ghost"
                size="sm"
                onClick={changeSpeed}
                className="h-8 px-2.5 text-xs font-bold text-white/70 hover:text-white hover:bg-white/10 rounded-lg"
                title="Playback Speed"
              >
                {playbackRate}x
              </Button>

              {/* Fullscreen */}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleFullscreen}
                className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10 rounded-full"
                title="Fullscreen (F)"
              >
                {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Animated Auto-Next Countdown HUD Card */}
      {autoNextCountdown !== null && nextEpisode && (
        <div className="absolute bottom-20 right-8 z-50 bg-neutral-900/95 backdrop-blur-2xl border border-primary/40 p-5 rounded-2xl shadow-2xl shadow-black max-w-sm animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center justify-between gap-4 mb-2">
            <span className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-1.5">
              <Play className="h-3.5 w-3.5 fill-current animate-pulse" /> Next Episode in{' '}
              {autoNextCountdown}s
            </span>
            <button
              onClick={() => setAutoNextCountdown(null)}
              className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              title="Cancel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-sm font-semibold text-white truncate mb-4">
            Episode {nextEpisode.number} {nextEpisode.title ? `• ${nextEpisode.title}` : ''}
          </p>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                setAutoNextCountdown(null)
                setActiveChapter(nextEpisode)
              }}
              className="flex-1 bg-primary text-primary-foreground font-bold text-xs h-9 rounded-xl shadow-lg shadow-primary/20 hover:bg-primary/90"
            >
              Watch Now
            </Button>
            <Button
              variant="outline"
              onClick={() => setAutoNextCountdown(null)}
              className="border-neutral-700 hover:bg-white/5 text-neutral-300 text-xs h-9 rounded-xl"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
