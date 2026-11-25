import { useEffect, useState, useMemo, useRef, useCallback, ChangeEvent } from 'react'
import {
  ArrowLeft,
  Loader2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Play,
  Menu,
  Zap,
  X,
  SkipForward,
  Maximize,
  RectangleHorizontal,
  ShieldAlert,
  Sparkles,
  PictureInPicture2
} from 'lucide-react'
import type { Chapter } from '@common/types'
import {
  parseEpisodeNumber,
  evaluateSkipUIState,
  type EpisodeSkipTimes
} from '@common/services/skipTimes.service'
import {
  detectVideoStreamType,
  extractRawStreamUrls,
  normalizeStreamServers,
  selectPreferredServerIndex,
  makeEpisodePrefetchKey,
  shouldPrefetchNextEpisode,
  sharedEpisodeStreamCache,
  prefetchNextEpisodeSkipTimes,
  type EpisodeStreamCacheEntry,
  type ServerProbeResult
} from '@common/services/episodePrefetch.service'
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
import { ServerSelector, ServerItem } from './components/ServerSelector'
import { EpisodeDrawer } from './components/EpisodeDrawer'
import { VideoControls, QualityLevel } from './components/VideoControls'
import { MiniPipControls } from './components/MiniPipControls'
import { useHlsPlayer } from './hooks/useHlsPlayer'
import { useMediaSession } from './hooks/useMediaSession'
import { useAmbientGlow } from './hooks/useAmbientGlow'
import {
  usePipPlayerStore,
  recordLivePlaybackSeconds,
  peekLivePlaybackSeconds,
  clearLivePlaybackSeconds,
  type PipSession
} from '@renderer/app/components/pipPlayerStore'

export type { ServerItem, QualityLevel }

function mapEntryToServerItems(entry: EpisodeStreamCacheEntry): ServerItem[] {
  return entry.servers.map((srv, idx) => {
    const probe = entry.probeResults?.find((p) => p.index === idx)
    return {
      name: srv.name,
      url: srv.url,
      type: srv.type,
      headers: srv.headers,
      status: probe ? probe.status : 'checking',
      pingMs: probe?.pingMs,
      error: probe?.error
    }
  })
}

function resolveEffectiveServerIndex(items: ServerItem[], preferredIndex: number): number {
  const candidate = items[preferredIndex]
  if (candidate && candidate.status === 'dead') {
    const aliveDirectIdx = items.findIndex(
      (srv) => srv.status === 'alive' && (srv.type === 'hls' || srv.type === 'mp4')
    )
    if (aliveDirectIdx !== -1) return aliveDirectIdx
    const aliveIdx = items.findIndex((srv) => srv.status === 'alive')
    if (aliveIdx !== -1) return aliveIdx
  }
  return preferredIndex
}

async function fetchAndNormalizeEpisode(
  pkg: string,
  episodeUrl: string
): Promise<EpisodeStreamCacheEntry> {
  const source = await ExtensionResolver.resolve(pkg)
  if (!source) throw new Error('Could not resolve extension source.')

  const res: any = await source.fetchPages(episodeUrl)
  const rawUrls = extractRawStreamUrls(res)
  if (!rawUrls || rawUrls.length === 0) {
    throw new Error('No streaming servers found for this episode.')
  }

  const normalized = normalizeStreamServers(rawUrls)
  if (normalized.length === 0) {
    throw new Error(
      'No playable streaming servers found for this episode (ad-only feeds filtered).'
    )
  }

  return {
    servers: normalized,
    debug: res?.debug || null,
    fetchedAt: Date.now()
  }
}

async function probeEpisodeServers(
  cacheKey: string,
  entry: EpisodeStreamCacheEntry
): Promise<ServerProbeResult[]> {
  const results = await Promise.all(
    entry.servers.map(async (srv, i): Promise<ServerProbeResult> => {
      try {
        const probeRes = await DataService.probeStream(srv.url, srv.headers, 2500)
        return {
          index: i,
          status: probeRes.alive ? 'alive' : 'dead',
          pingMs: probeRes.pingMs,
          error: probeRes.error
        }
      } catch {
        return {
          index: i,
          status: 'dead',
          error: 'Probe error'
        }
      }
    })
  )
  sharedEpisodeStreamCache.updateProbeResults(cacheKey, results)
  return results
}

export interface AnimeViewerProps {
  variant?: 'overlay' | 'inline' | 'mini'
  isTheaterMode?: boolean
  onToggleTheaterMode?: () => void
  miniSession?: PipSession | null
  onExpandMini?: () => void
  onCloseMini?: () => void
  onUpdateMiniChapter?: (chapter: Chapter) => void
  onEnterMiniPip?: () => void
}

export default function AnimeViewer({
  variant = 'overlay',
  isTheaterMode = false,
  onToggleTheaterMode,
  miniSession = null,
  onExpandMini,
  onCloseMini,
  onUpdateMiniChapter,
  onEnterMiniPip
}: AnimeViewerProps) {
  const isMini = variant === 'mini'
  const isInline = variant === 'inline'
  const mobile = isMobile()
  const platform = DataService.platform
  const { activeChapter, setActiveChapter, selectedManga } = useLibraryStore()
  const { activeExtension } = useExtensionStore()
  const { markChapterRead, loadProgress, pageProgress } = useProgressStore()
  const { addHistoryEntry, updateHistoryDuration } = useHistoryStore()
  const setLivePlayback = usePipPlayerStore((s) => s.setLivePlayback)
  const setLivePlaying = usePipPlayerStore((s) => s.setLivePlaying)

  const effectiveManga = isMini ? (miniSession?.manga ?? null) : selectedManga
  const effectiveChapter = isMini ? (miniSession?.chapter ?? null) : activeChapter
  const effectivePkg = isMini ? (miniSession?.pkg ?? '') : activeExtension || ''

  const setEffectiveEpisode = useCallback(
    (episode: Chapter | null) => {
      if (isMini) {
        if (episode) {
          onUpdateMiniChapter?.(episode)
        } else {
          onCloseMini?.()
        }
        return
      }
      setActiveChapter(episode)
    },
    [isMini, onUpdateMiniChapter, onCloseMini, setActiveChapter]
  )

  const closeAndStopPlayer = useCallback(() => {
    if (effectiveManga?.id && effectiveChapter?.id) {
      clearLivePlaybackSeconds(effectiveManga.id, effectiveChapter.id)
    }
    if (isMini) {
      onCloseMini?.()
      return
    }
    setLivePlayback(null)
    setActiveChapter(null)
  }, [
    effectiveManga?.id,
    effectiveChapter?.id,
    isMini,
    onCloseMini,
    setLivePlayback,
    setActiveChapter
  ])
  const activeSessionRef = useRef<{ mangaId: string; chapterId: string; startTime: number } | null>(
    null
  )

  const containerRef = useRef<HTMLDivElement | null>(null)

  // Native Player State
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [bufferedPercent, setBufferedPercent] = useState(0)
  const [volume, setVolume] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('autakimi-anime-volume')
      if (saved !== null) {
        const parsed = parseFloat(saved)
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) return parsed
      }
    } catch {}
    return 1
  })
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    try {
      return localStorage.getItem('autakimi-anime-muted') === 'true'
    } catch {}
    return false
  })
  const [playbackRate, setPlaybackRate] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('autakimi-anime-playback-rate')
      if (saved !== null) {
        const parsed = parseFloat(saved)
        if (!isNaN(parsed) && parsed > 0) return parsed
      }
    } catch {}
    return 1
  })
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isPiP, setIsPiP] = useState(false)
  const [isBuffering, setIsBuffering] = useState(false)
  const [isHold2x, setIsHold2x] = useState(false)
  const [resumeNotice, setResumeNotice] = useState<string | null>(null)
  const [ambientEnabled, setAmbientEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('autakimi-anime-ambient-mode')
      return saved === null ? true : saved === 'true'
    } catch {
      return true
    }
  })

  const toggleAmbientMode = useCallback(() => {
    setAmbientEnabled((prev) => {
      const next = !prev
      try {
        localStorage.setItem('autakimi-anime-ambient-mode', String(next))
      } catch {}
      return next
    })
  }, [])

  const volumeRef = useRef(volume)
  const isMutedRef = useRef(isMuted)
  const playbackRateRef = useRef(playbackRate)
  const spaceHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isHold2xRef = useRef(false)
  const spaceDownRef = useRef(false)

  useEffect(() => {
    volumeRef.current = volume
  }, [volume])

  useEffect(() => {
    isMutedRef.current = isMuted
  }, [isMuted])

  useEffect(() => {
    playbackRateRef.current = playbackRate
  }, [playbackRate])

  const lastProgressSaveRef = useRef(0)

  // Load reading/watching progress on manga load
  useEffect(() => {
    if (effectiveManga?.id) {
      loadProgress(effectiveManga.id)
    }
  }, [effectiveManga?.id, loadProgress])

  const savedProgressSeconds = useMemo(() => {
    if (!effectiveManga?.id || !effectiveChapter?.id) return 0
    return pageProgress[effectiveManga.id]?.[effectiveChapter.id] || 0
  }, [effectiveManga?.id, effectiveChapter?.id, pageProgress])

  const exactHandoffSeconds = useMemo(() => {
    if (!effectiveManga?.id || !effectiveChapter?.id) return 0
    return peekLivePlaybackSeconds(effectiveManga.id, effectiveChapter.id)
  }, [effectiveManga?.id, effectiveChapter?.id])

  // Sync active playback snapshot for Auto Bottom-Right PiP when leaving the Watch Page
  useEffect(() => {
    if (isMini) return
    if (effectiveManga && effectiveChapter && effectivePkg) {
      setLivePlayback({
        manga: effectiveManga,
        chapter: effectiveChapter,
        pkg: effectivePkg,
        isPlaying: false
      })
    } else {
      setLivePlayback(null)
    }
  }, [isMini, effectiveManga, effectiveChapter, effectivePkg, setLivePlayback])

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
    effectiveManga?.id || '',
    effectivePkg,
    effectiveManga?.url
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
  const [skipTimes, setSkipTimes] = useState<EpisodeSkipTimes | null>(null)
  const [outroDismissed, setOutroDismissed] = useState(false)
  const [outroCountdown, setOutroCountdown] = useState<number | null>(null)
  const outroTriggeredRef = useRef(false)
  const { autoNextAnime, setAutoNextAnime, autoSwitchServer } = useSettingsStore()

  const controlsTimeoutRef = useRef<any | null>(null)
  const loadGenerationRef = useRef(0)
  const prefetchedTransitionsRef = useRef<Set<string>>(new Set())

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

  // Auto-expand debug on error
  useEffect(() => {
    if (error) setShowDebug(true)
  }, [error])

  const sortedEpisodes = useMemo(() => {
    return [...episodes].sort((a, b) => (a.number || 0) - (b.number || 0))
  }, [episodes])

  const currentIndex = sortedEpisodes.findIndex((e) => e.id === effectiveChapter?.id)
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
      if (nextEpisode) setEffectiveEpisode(nextEpisode)
      return
    }
    const timer = setTimeout(() => {
      setAutoNextCountdown((prev) => (prev !== null ? prev - 1 : null))
    }, 1000)
    return () => clearTimeout(timer)
  }, [autoNextCountdown, nextEpisode, setEffectiveEpisode])

  // Reset Skip Intro / Outro state when episode changes
  useEffect(() => {
    setSkipTimes(null)
    setOutroDismissed(false)
    setOutroCountdown(null)
    outroTriggeredRef.current = false
  }, [effectiveChapter?.id])

  // Resolve AniSkip OP / ED timestamps via MAL ID (tracker -> AniList search)
  const durationBucket = duration > 60 ? Math.floor(duration) : 0
  useEffect(() => {
    if (!effectiveManga || !effectiveChapter) return
    const episodeNumber = parseEpisodeNumber(effectiveChapter.number, effectiveChapter.title)
    if (!episodeNumber) return

    let cancelled = false
    const loadSkipTimes = async () => {
      try {
        let malId: number | undefined
        let anilistId: number | undefined
        const trackers = await DataService.tracker.getByManga(effectiveManga.id).catch(() => [])
        if (Array.isArray(trackers)) {
          const malTracker = trackers.find((t: any) => t.provider === 'mal')
          const aniTracker = trackers.find((t: any) => t.provider === 'anilist')
          const rawMal = malTracker
            ? Number(malTracker.remoteId ?? (malTracker as any).remote_id)
            : 0
          const rawAni = aniTracker
            ? Number(aniTracker.remoteId ?? (aniTracker as any).remote_id)
            : 0
          if (Number.isFinite(rawMal) && rawMal > 0) malId = rawMal
          if (Number.isFinite(rawAni) && rawAni > 0) anilistId = rawAni
        }

        const result = await DataService.tracker.getSkipTimes({
          malId,
          anilistId,
          title: effectiveManga.title,
          episodeNumber,
          episodeLength: durationBucket
        })
        if (!cancelled && result) {
          setSkipTimes(result)
        }
      } catch {
        // Silent failure: fallback UI remains active
      }
    }

    loadSkipTimes()
    return () => {
      cancelled = true
    }
  }, [effectiveManga, effectiveChapter, durationBucket])

  const s = servers[activeServerIdx]
  const activeServerUrl = typeof s === 'object' ? (s as any)?.url : s
  const videoType = useMemo(() => detectVideoStreamType(s), [s])

  const failoverToNextServer = useCallback(
    (reason?: string) => {
      console.warn(`[AnimeViewer] Server failover triggered: ${reason || 'Unknown failure'}`)

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
          const srv = updated[checkIdx]
          if (srv?.status === 'alive' && (srv.type === 'hls' || srv.type === 'mp4')) {
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

  // Modular HLS and video player hook
  const {
    videoRef,
    hlsRef,
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
  } = useHlsPlayer({
    activeServerUrl,
    videoType,
    serverConfig: s,
    activeServerIdx,
    volumeRef,
    isMutedRef,
    playbackRateRef,
    savedProgressSeconds,
    exactHandoffSeconds,
    failoverToNextServer,
    setDuration,
    setResumeNotice
  })

  // Persist exact currentTime when unmounting or switching episodes for seamless Inline <-> PiP handoff
  useEffect(() => {
    const curVideo = videoRef.current
    const curMangaId = effectiveManga?.id
    const curChapterId = effectiveChapter?.id
    return () => {
      if (curMangaId && curChapterId && curVideo && curVideo.currentTime > 0) {
        recordLivePlaybackSeconds(curMangaId, curChapterId, curVideo.currentTime)
      }
    }
  }, [videoRef, effectiveManga?.id, effectiveChapter?.id])

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

  const recordWatchSession = useCallback(
    (chapter: Chapter) => {
      if (!effectiveManga) return

      if (
        activeSessionRef.current &&
        (activeSessionRef.current.mangaId !== effectiveManga.id ||
          activeSessionRef.current.chapterId !== chapter.id)
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
        mangaId: effectiveManga.id,
        chapterId: chapter.id,
        startTime: Date.now()
      }

      const existingProgress =
        useProgressStore.getState().pageProgress[effectiveManga.id]?.[chapter.id] || undefined

      markChapterRead(
        effectiveManga.id,
        chapter.id,
        true,
        existingProgress,
        Number(chapter.number) || undefined
      )
      addHistoryEntry({
        mangaId: effectiveManga.id,
        mangaTitle: effectiveManga.title,
        chapterId: chapter.id,
        chapterTitle: chapter.title || undefined,
        startedAt: new Date().toISOString(),
        durationSeconds: 0,
        pkg: effectivePkg || undefined,
        type: 'anime'
      })
    },
    [effectiveManga, effectivePkg, markChapterRead, addHistoryEntry, updateHistoryDuration]
  )

  const applyEntryServers = useCallback(
    (entry: EpisodeStreamCacheEntry, cacheKey: string, currentGen: number) => {
      const initialServers = mapEntryToServerItems(entry)
      const preferredName = localStorage.getItem('autakimi-anime-preferred-server')
      const targetIdx = selectPreferredServerIndex(entry.servers, preferredName)
      const effectiveIdx = resolveEffectiveServerIndex(initialServers, targetIdx)

      setDebugInfo(entry.debug || null)
      setServers(initialServers)
      setActiveServerIdx(effectiveIdx)

      if (!entry.probeResults) {
        probeEpisodeServers(cacheKey, entry).then((results) => {
          if (currentGen !== loadGenerationRef.current) return
          let nextAliveIdx = -1

          setServers((prevServers) => {
            const updated = prevServers.map((srv, i) => {
              const r = results.find((res) => res.index === i)
              if (!r) return srv
              return {
                ...srv,
                status: r.status,
                pingMs: r.pingMs,
                error: r.error
              }
            })
            nextAliveIdx = resolveEffectiveServerIndex(updated, effectiveIdx)
            return updated
          })

          if (nextAliveIdx !== -1 && nextAliveIdx !== effectiveIdx) {
            console.warn(
              `[AnimeViewer] Initial server probed DEAD, fast-switching to index ${nextAliveIdx}...`
            )
            setActiveServerIdx(nextAliveIdx)
          }
        })
      }
    },
    []
  )

  const loadServers = useCallback(async () => {
    if (!effectiveChapter || !effectivePkg) return
    const currentGen = ++loadGenerationRef.current
    const cacheKey = makeEpisodePrefetchKey(effectivePkg, effectiveChapter.url)

    clearWatchdog()
    setError(null)
    setIsSwitchingServer(false)

    // Zero-wait instant handoff when next episode was already prefetched at >=80%
    const cachedEntry = sharedEpisodeStreamCache.getCached(cacheKey)
    if (cachedEntry && cachedEntry.servers.length > 0) {
      applyEntryServers(cachedEntry, cacheKey, currentGen)
      setLoading(false)
      recordWatchSession(effectiveChapter)
      return
    }

    setLoading(true)

    try {
      const entry = await sharedEpisodeStreamCache.getOrLoad(cacheKey, () =>
        fetchAndNormalizeEpisode(effectivePkg, effectiveChapter.url)
      )

      if (currentGen !== loadGenerationRef.current) return

      applyEntryServers(entry, cacheKey, currentGen)
      recordWatchSession(effectiveChapter)
    } catch (err: any) {
      if (currentGen !== loadGenerationRef.current) return
      console.error('[AnimeViewer] Failed to load servers:', err)
      setError(err?.message || 'Failed to load streaming servers.')
    } finally {
      if (currentGen === loadGenerationRef.current) {
        setLoading(false)
      }
    }
  }, [effectiveChapter, effectivePkg, clearWatchdog, applyEntryServers, recordWatchSession])

  useEffect(() => {
    loadServers()
  }, [effectiveChapter?.id, effectivePkg, loadServers])

  // Automatically append autoplay parameters and ensure unmuted parameters for embed URLs
  const activeEmbedUrl = useMemo(() => {
    if (videoType !== 'embed' || !activeServerUrl) return activeServerUrl
    try {
      const parsed = new URL(activeServerUrl)
      if (!parsed.searchParams.has('autoplay')) {
        parsed.searchParams.set('autoplay', '1')
      }
      if (parsed.searchParams.get('mute') === '1') {
        parsed.searchParams.set('mute', '0')
      }
      if (parsed.searchParams.get('muted') === '1') {
        parsed.searchParams.set('muted', '0')
      }
      return parsed.toString()
    } catch {
      let url = activeServerUrl
      if (!url.includes('autoplay=')) {
        url = url.includes('?') ? `${url}&autoplay=1` : `${url}?autoplay=1`
      }
      url = url.replace(/([?&])muted=1\b/g, '$1muted=0')
      url = url.replace(/([?&])mute=1\b/g, '$1mute=0')
      return url
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
    if (videoRef.current) {
      videoRef.current.muted = isMutedRef.current
      videoRef.current.volume = volumeRef.current > 0 ? volumeRef.current : 1
      videoRef.current.playbackRate = playbackRateRef.current
    }
    setQualityLevels([])
    setSelectedQuality(-1)
    setCurrentQualityLabel('')
    setMp4QualityLabel('')
  }, [
    effectiveChapter?.id,
    activeServerIdx,
    hasResumedRef,
    setQualityLevels,
    setSelectedQuality,
    setCurrentQualityLabel,
    setMp4QualityLabel,
    videoRef
  ])

  // Picture-in-Picture event listeners and toggle
  const togglePiP = useCallback(async () => {
    const video = videoRef.current
    if (!video) return
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture()
      } else if (document.pictureInPictureEnabled && video.requestPictureInPicture) {
        await video.requestPictureInPicture()
      }
    } catch (err) {
      console.warn('[AnimeViewer] PiP toggle failed:', err)
    }
  }, [videoRef])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const onEnterPiP = () => setIsPiP(true)
    const onLeavePiP = () => setIsPiP(false)
    video.addEventListener('enterpictureinpicture', onEnterPiP)
    video.addEventListener('leavepictureinpicture', onLeavePiP)
    return () => {
      video.removeEventListener('enterpictureinpicture', onEnterPiP)
      video.removeEventListener('leavepictureinpicture', onLeavePiP)
    }
  }, [videoRef])

  const prefetchNextEpisodeInBackground = useCallback(
    (episodeDurationSec: number) => {
      if (!effectivePkg || !nextEpisode?.url) return
      const nextKey = makeEpisodePrefetchKey(effectivePkg, nextEpisode.url)

      sharedEpisodeStreamCache
        .prefetchInBackground(nextKey, () =>
          fetchAndNormalizeEpisode(effectivePkg, nextEpisode.url)
        )
        .then((entry) => {
          if (entry && entry.servers.length > 0 && !entry.probeResults) {
            probeEpisodeServers(nextKey, entry).catch(() => {})
          }
        })
        .catch(() => {})

      prefetchNextEpisodeSkipTimes({
        animeId: effectiveManga?.id,
        animeTitle: effectiveManga?.title,
        nextEpisode,
        episodeLength: episodeDurationSec > 60 ? Math.floor(episodeDurationSec) : 0,
        getTrackers: (id) => DataService.tracker.getByManga(id),
        getSkipTimes: (req) => DataService.tracker.getSkipTimes(req)
      }).catch(() => {})
    },
    [effectivePkg, nextEpisode, effectiveManga?.id, effectiveManga?.title]
  )

  const handleTimeUpdate = () => {
    clearWatchdog()
    const video = videoRef.current
    if (!video) return
    setCurrentTime(video.currentTime)

    if (effectiveManga?.id && effectiveChapter?.id && Number.isFinite(video.currentTime)) {
      recordLivePlaybackSeconds(effectiveManga.id, effectiveChapter.id, video.currentTime)
    }

    const dur = video.duration || duration || 0

    // Calculate buffered percentage
    if (video.buffered.length > 0) {
      const bufferedEnd = video.buffered.end(video.buffered.length - 1)
      setBufferedPercent(Math.min(100, (bufferedEnd / (dur || 1)) * 100))
    }

    // Background pre-fetch next episode stream URLs + AniSkip timestamps once playback hits 80%
    if (effectivePkg && effectiveChapter && nextEpisode?.url) {
      const transitionKey = `${effectivePkg}::${effectiveChapter.id}->${nextEpisode.id}`
      if (
        shouldPrefetchNextEpisode({
          currentTime: video.currentTime,
          duration: dur,
          pkg: effectivePkg,
          nextEpisodeUrl: nextEpisode.url,
          prefetchedKeys: prefetchedTransitionsRef.current,
          transitionKey
        })
      ) {
        prefetchedTransitionsRef.current.add(transitionKey)
        prefetchNextEpisodeInBackground(dur)
      }
    }

    // Throttle database progress save every 4 seconds
    const currentSec = Math.floor(video.currentTime)
    if (
      effectiveManga &&
      effectiveChapter &&
      currentSec > 0 &&
      Math.abs(currentSec - lastProgressSaveRef.current) >= 4
    ) {
      lastProgressSaveRef.current = currentSec
      markChapterRead(effectiveManga.id, effectiveChapter.id, true, currentSec)
    }
  }

  const handleVideoEnded = () => {
    setIsPlaying(false)
    if (!isMini) {
      setLivePlaying(Boolean(autoNextAnime && nextEpisode))
    }
    if (effectiveManga && effectiveChapter && duration > 0) {
      clearLivePlaybackSeconds(effectiveManga.id, effectiveChapter.id)
      markChapterRead(
        effectiveManga.id,
        effectiveChapter.id,
        true,
        Math.floor(duration),
        Number(effectiveChapter.number) || undefined
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
  }, [videoRef])

  const seekTo = useCallback(
    (seconds: number) => {
      const video = videoRef.current
      if (!video) return
      const target = Math.max(0, Math.min(video.duration || 0, seconds))
      video.currentTime = target
      setCurrentTime(target)
    },
    [videoRef]
  )

  const seekBy = useCallback(
    (seconds: number) => {
      const video = videoRef.current
      if (!video) return
      const target = Math.max(0, Math.min(video.duration || 0, video.currentTime + seconds))
      video.currentTime = target
      setCurrentTime(target)
    },
    [videoRef]
  )

  useMediaSession({
    enabled: Boolean(effectiveChapter && effectiveManga && !error),
    animeTitle: effectiveManga?.title,
    coverUrl: effectiveManga?.coverUrl,
    episodeNumber: effectiveChapter?.number,
    episodeTitle: effectiveChapter?.title,
    isPlaying,
    currentTime,
    duration,
    playbackRate: isHold2x ? 2 : playbackRate,
    hasNextEpisode: Boolean(nextEpisode),
    hasPrevEpisode: Boolean(prevEpisode),
    onPlay: () => {
      if (videoType !== 'embed' && videoRef.current) {
        videoRef.current.play().catch(() => {})
      } else {
        try {
          document.querySelector('iframe')?.contentWindow?.postMessage({ type: 'togglePlay' }, '*')
        } catch {}
      }
    },
    onPause: () => {
      if (videoType !== 'embed' && videoRef.current) {
        videoRef.current.pause()
      } else {
        try {
          document.querySelector('iframe')?.contentWindow?.postMessage({ type: 'togglePlay' }, '*')
        } catch {}
      }
    },
    onNextEpisode: () => {
      if (nextEpisode) setEffectiveEpisode(nextEpisode)
    },
    onPrevEpisode: () => {
      if (prevEpisode) setEffectiveEpisode(prevEpisode)
    },
    onSeekTo: seekTo,
    onSeekBy: (offset) => {
      if (videoType !== 'embed' && videoRef.current) {
        seekBy(offset)
      } else {
        try {
          document
            .querySelector('iframe')
            ?.contentWindow?.postMessage({ type: 'seek', offset }, '*')
        } catch {}
      }
    }
  })

  const { canvasARef, canvasBRef, activeBuffer, hasVideoFrame } = useAmbientGlow({
    enabled: Boolean(isInline && !isFullscreen && ambientEnabled && !loading && !error),
    videoRef,
    videoType,
    activeServerUrl,
    isPlaying
  })

  const skipUIState = useMemo(
    () =>
      evaluateSkipUIState({
        skipTimes,
        currentTime,
        duration,
        hasNextEpisode: Boolean(nextEpisode),
        outroDismissed
      }),
    [skipTimes, currentTime, duration, nextEpisode, outroDismissed]
  )

  const handleSkipIntro = useCallback(() => {
    if (
      videoType !== 'embed' &&
      videoRef.current &&
      skipTimes?.op &&
      currentTime >= skipTimes.op.startTime &&
      currentTime < skipTimes.op.endTime
    ) {
      seekTo(skipTimes.op.endTime)
    }
  }, [videoType, videoRef, skipTimes, currentTime, seekTo])

  // Start optional 10s outro countdown when entering AniSkip ED segment with autoNextAnime enabled
  useEffect(() => {
    if (
      skipUIState.isExactOutro &&
      autoNextAnime &&
      autoNextCountdown === null &&
      !outroTriggeredRef.current
    ) {
      outroTriggeredRef.current = true
      setOutroCountdown(10)
    } else if (!skipUIState.isExactOutro || !autoNextAnime) {
      if (outroCountdown !== null) {
        setOutroCountdown(null)
      }
      if (!skipUIState.isExactOutro) {
        outroTriggeredRef.current = false
      }
    }
  }, [skipUIState.isExactOutro, autoNextAnime, autoNextCountdown, outroCountdown])

  useEffect(() => {
    if (outroCountdown === null) return
    if (outroCountdown <= 0) {
      setOutroCountdown(null)
      if (nextEpisode) setEffectiveEpisode(nextEpisode)
      return
    }
    const timer = setTimeout(() => {
      setOutroCountdown((prev) => (prev !== null ? prev - 1 : null))
    }, 1000)
    return () => clearTimeout(timer)
  }, [outroCountdown, nextEpisode, setEffectiveEpisode])

  const adjustVolume = useCallback(
    (delta: number) => {
      const video = videoRef.current
      if (!video) return
      const newVol = Math.max(0, Math.min(1, Number((video.volume + delta).toFixed(2))))
      video.volume = newVol
      video.muted = newVol === 0
      volumeRef.current = newVol
      isMutedRef.current = newVol === 0
      setVolume(newVol)
      setIsMuted(newVol === 0)
      try {
        localStorage.setItem('autakimi-anime-volume', String(newVol))
        localStorage.setItem('autakimi-anime-muted', String(newVol === 0))
      } catch {}
    },
    [videoRef]
  )

  const toggleMute = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (isMuted) {
      video.muted = false
      setIsMuted(false)
      isMutedRef.current = false
      const targetVol = volume > 0 ? volume : 1
      video.volume = targetVol
      volumeRef.current = targetVol
      setVolume(targetVol)
      try {
        localStorage.setItem('autakimi-anime-muted', 'false')
        localStorage.setItem('autakimi-anime-volume', String(targetVol))
      } catch {}
    } else {
      video.muted = true
      setIsMuted(true)
      isMutedRef.current = true
      try {
        localStorage.setItem('autakimi-anime-muted', 'true')
      } catch {}
    }
  }, [isMuted, volume, videoRef])

  const handleVolumeChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value)
      volumeRef.current = val
      isMutedRef.current = val === 0
      setVolume(val)
      setIsMuted(val === 0)
      if (videoRef.current) {
        videoRef.current.volume = val
        videoRef.current.muted = val === 0
      }
      try {
        localStorage.setItem('autakimi-anime-volume', String(val))
        localStorage.setItem('autakimi-anime-muted', String(val === 0))
      } catch {}
    },
    [videoRef]
  )

  const changeSpeed = useCallback(() => {
    const speedOptions = [0.5, 0.75, 1, 1.25, 1.5, 2]
    const curIdx = speedOptions.indexOf(playbackRate)
    const nextIdx = (curIdx + 1) % speedOptions.length
    const newSpeed = speedOptions[nextIdx]
    setPlaybackRate(newSpeed)
    playbackRateRef.current = newSpeed
    if (videoRef.current) {
      videoRef.current.playbackRate = newSpeed
    }
    try {
      localStorage.setItem('autakimi-anime-playback-rate', String(newSpeed))
    } catch {}
  }, [playbackRate, videoRef])

  const toggleFullscreen = useCallback(async () => {
    // Inline mode uses Element.requestFullscreen() so ONLY the video container (not Sidebar/Episodes) enters fullscreen
    if (isInline) {
      if (!document.fullscreenElement) {
        const container = containerRef.current
        if (container?.requestFullscreen) {
          try {
            await container.requestFullscreen()
            setIsFullscreen(true)
            return
          } catch (err) {
            console.warn('[AnimeViewer] Element fullscreen failed, trying native window:', err)
          }
        }
      } else if (document.exitFullscreen) {
        try {
          await document.exitFullscreen()
          setIsFullscreen(false)
          return
        } catch (err) {
          console.warn('[AnimeViewer] Exit element fullscreen failed:', err)
        }
      }
    }

    // 1. Desktop native window fullscreen via Electron (default for overlay or fallback)
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
    } else if (document.exitFullscreen) {
      document
        .exitFullscreen()
        .then(() => setIsFullscreen(false))
        .catch(() => {})
    }
  }, [isInline])

  // Sync fullscreen state with HTML5 / Electron and clean up on unmount
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isHtml5 = !!document.fullscreenElement
      if (isInline) {
        setIsFullscreen(isHtml5)
        return
      }
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

    // Check initial native fullscreen state in overlay mode
    if (!isInline && typeof window !== 'undefined' && window.api?.window) {
      DataService.window
        .isFullScreen()
        .then((isNative) => {
          if (isNative) setIsFullscreen(true)
        })
        .catch(() => {})
    }

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      if (isInline && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {})
      } else if (!isInline && typeof window !== 'undefined' && window.api?.window) {
        // When exiting overlay anime viewer, restore native window from fullscreen
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
  }, [isInline])

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
  }, [videoType, loadServers, hlsRef, videoRef])

  const stopHold2x = useCallback(() => {
    if (spaceHoldTimerRef.current) {
      clearTimeout(spaceHoldTimerRef.current)
      spaceHoldTimerRef.current = null
    }
    if (isHold2xRef.current) {
      isHold2xRef.current = false
      setIsHold2x(false)
      if (videoRef.current) {
        videoRef.current.playbackRate = playbackRateRef.current
      }
    }
  }, [videoRef])

  // Keyboard Shortcuts (disabled in Mini PiP so users can search/type freely in main pages)
  useEffect(() => {
    if (isMini) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      ) {
        return
      }

      switch (e.key.toLowerCase()) {
        case ' ':
          e.preventDefault()
          if (videoType === 'embed' || !videoRef.current) {
            if (!e.repeat) {
              try {
                const iframe = document.querySelector('iframe')
                iframe?.contentWindow?.postMessage({ type: 'togglePlay' }, '*')
              } catch {}
            }
            break
          }
          if (e.repeat) break
          spaceDownRef.current = true
          if (spaceHoldTimerRef.current) clearTimeout(spaceHoldTimerRef.current)
          spaceHoldTimerRef.current = setTimeout(() => {
            spaceHoldTimerRef.current = null
            if (!videoRef.current) return
            isHold2xRef.current = true
            setIsHold2x(true)
            videoRef.current.playbackRate = 2
          }, 220)
          break
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
        case 's':
          e.preventDefault()
          handleSkipIntro()
          break
        case 'i':
          e.preventDefault()
          if (videoType !== 'embed') {
            togglePiP()
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
          if (nextEpisode) setEffectiveEpisode(nextEpisode)
          break
        case 'p':
          if (prevEpisode) setEffectiveEpisode(prevEpisode)
          break
        case 'm':
          e.preventDefault()
          toggleMute()
          break
        case 'e':
          e.preventDefault()
          setIsEpisodesOpen((prev) => !prev)
          break
        case 't':
          e.preventDefault()
          if (isFullscreen) {
            toggleFullscreen()
          } else if (isInline && onToggleTheaterMode) {
            onToggleTheaterMode()
          }
          break
        case 'escape':
          if (isFullscreen) {
            e.preventDefault()
            toggleFullscreen()
          } else if (isEpisodesOpen) {
            setIsEpisodesOpen(false)
          } else if (isInline && isTheaterMode && onToggleTheaterMode) {
            onToggleTheaterMode()
          } else {
            closeAndStopPlayer()
          }
          break
        case 'r':
          e.preventDefault()
          reloadPlayer()
          break
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key !== ' ') return
      if (!spaceDownRef.current) return
      e.preventDefault()
      spaceDownRef.current = false
      if (isHold2xRef.current) {
        stopHold2x()
      } else {
        if (spaceHoldTimerRef.current) {
          clearTimeout(spaceHoldTimerRef.current)
          spaceHoldTimerRef.current = null
        }
        if (videoType !== 'embed' && videoRef.current) {
          togglePlay()
        }
      }
    }

    const handleWindowBlur = () => {
      spaceDownRef.current = false
      stopHold2x()
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleWindowBlur)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleWindowBlur)
      spaceDownRef.current = false
      stopHold2x()
    }
  }, [
    videoType,
    togglePlay,
    stopHold2x,
    seekBy,
    handleSkipIntro,
    togglePiP,
    adjustVolume,
    toggleFullscreen,
    isFullscreen,
    toggleMute,
    nextEpisode,
    prevEpisode,
    isEpisodesOpen,
    setEffectiveEpisode,
    closeAndStopPlayer,
    reloadPlayer,
    videoRef,
    isMini,
    isInline,
    isTheaterMode,
    onToggleTheaterMode
  ])

  if (!effectiveChapter || !effectiveManga) return null

  const mediaSurface = activeServerUrl ? (
    videoType === 'embed' ? (
      <iframe
        key={activeEmbedUrl}
        src={activeEmbedUrl}
        className="w-full h-full border-none shadow-2xl bg-black"
        allowFullScreen
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        title="Video Player"
        onLoad={() => {
          clearWatchdog()
        }}
        onError={() => {
          failoverToNextServer(`Server ${activeServerIdx + 1} failed to respond.`)
        }}
      />
    ) : (
      <div
        className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden"
        onClick={togglePlay}
        onDoubleClick={isMini ? () => onExpandMini?.() : toggleFullscreen}
      >
        <video
          ref={videoRef}
          className="w-full h-full object-contain cursor-pointer"
          playsInline
          autoPlay
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onCanPlay={() => {
            clearWatchdog()
            if (videoRef.current && videoRef.current.paused) {
              videoRef.current.play().catch(() => {})
            }
          }}
          onPlay={() => {
            clearWatchdog()
            setIsPlaying(true)
            if (!isMini) setLivePlaying(true)
          }}
          onPause={() => {
            setIsPlaying(false)
            if (!isMini) setLivePlaying(false)
          }}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => {
            clearWatchdog()
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

        {isBuffering && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <div className="p-4 rounded-full bg-black/60 backdrop-blur-md">
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
            </div>
          </div>
        )}
      </div>
    )
  ) : null

  if (isMini) {
    return (
      <div className="fixed bottom-5 right-5 z-[95] w-[360px] sm:w-[400px] aspect-video bg-black rounded-2xl border border-white/15 shadow-2xl shadow-black/80 overflow-hidden text-white select-none group/pip animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="relative w-full h-full flex items-center justify-center bg-black">
          {loading ? (
            <div className="flex flex-col items-center gap-2 text-white/60">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Loading...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-2 p-4 text-center z-40">
              <p className="text-xs font-semibold text-white/80 line-clamp-2">{error}</p>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={loadServers} className="h-7 text-[11px]">
                  Retry
                </Button>
                {onExpandMini && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onExpandMini}
                    className="h-7 text-[11px] border-white/20 text-white hover:bg-white/10"
                  >
                    Expand
                  </Button>
                )}
              </div>
            </div>
          ) : (
            mediaSurface
          )}
        </div>

        <MiniPipControls
          title={effectiveManga.title}
          episodeNumber={effectiveChapter.number}
          isPlaying={isPlaying}
          isMuted={isMuted}
          currentTime={currentTime}
          duration={duration}
          playbackRate={playbackRate}
          videoType={videoType}
          hasPrevEpisode={Boolean(prevEpisode)}
          hasNextEpisode={Boolean(nextEpisode)}
          showSkipIntro={skipUIState.isInIntro}
          showNextEpisodePill={Boolean(
            (skipUIState.showNextEpisode || autoNextCountdown !== null) && nextEpisode
          )}
          nextEpisodeNumber={nextEpisode?.number}
          outroCountdown={outroCountdown ?? autoNextCountdown}
          skipTimes={skipTimes}
          onTogglePlay={togglePlay}
          onSeekTo={seekTo}
          onToggleMute={toggleMute}
          onChangeSpeed={changeSpeed}
          onPrevEpisode={() => prevEpisode && setEffectiveEpisode(prevEpisode)}
          onNextEpisode={() => nextEpisode && setEffectiveEpisode(nextEpisode)}
          onSkipIntro={handleSkipIntro}
          onPopOutOsPip={togglePiP}
          onExpand={() => onExpandMini?.()}
          onClose={closeAndStopPlayer}
        />
      </div>
    )
  }

  const showBoxedInline = isInline && !isFullscreen
  const handleSelectServer = (idx: number) => {
    setActiveServerIdx(idx)
    const server = servers[idx]
    const sName = typeof server === 'object' ? server.name : server
    if (sName) {
      localStorage.setItem('autakimi-anime-preferred-server', sName)
    }
  }

  return (
    <div className={cn(showBoxedInline ? 'w-full flex flex-col gap-3' : 'contents')}>
      <div className={cn(showBoxedInline ? 'relative w-full' : 'contents')}>
        {showBoxedInline && ambientEnabled && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-4 z-0 rounded-3xl blur-2xl saturate-200 brightness-110 opacity-75 dark:opacity-85 transition-opacity duration-700"
          >
            <canvas
              ref={canvasARef}
              width={16}
              height={9}
              className={cn(
                'absolute inset-0 w-full h-full object-cover rounded-3xl transition-opacity duration-[1500ms] ease-in-out',
                hasVideoFrame && activeBuffer === 'A' ? 'opacity-100' : 'opacity-0'
              )}
            />
            <canvas
              ref={canvasBRef}
              width={16}
              height={9}
              className={cn(
                'absolute inset-0 w-full h-full object-cover rounded-3xl transition-opacity duration-[1500ms] ease-in-out',
                hasVideoFrame && activeBuffer === 'B' ? 'opacity-100' : 'opacity-0'
              )}
            />
            {!hasVideoFrame && effectiveManga.coverUrl && (
              <img
                src={effectiveManga.coverUrl}
                alt=""
                className="w-full h-full object-cover rounded-3xl scale-105 opacity-75"
              />
            )}
          </div>
        )}
        <div
          ref={containerRef}
          onMouseLeave={() => {
            if (showBoxedInline && isPlaying) {
              setShowControls(false)
            }
          }}
          className={cn(
            'bg-black flex flex-col overflow-hidden text-white select-none',
            showBoxedInline
              ? 'relative z-10 w-full aspect-video max-h-[76vh] rounded-2xl border border-white/10 shadow-2xl'
              : 'fixed inset-0 z-[100] animate-in fade-in duration-500',
            !showControls && !showBoxedInline && 'cursor-none',
            mobile &&
              !showBoxedInline &&
              'pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]'
          )}
        >
          {/* Top Header Overlay */}
          {showBoxedInline ? (
            <div
              className={cn(
                'absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-black/80 via-black/35 to-transparent px-4 flex items-center justify-between z-40 transition-all duration-300',
                !showControls && 'translate-y-[-110%] opacity-0 pointer-events-none'
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="bg-primary text-primary-foreground px-2 py-0.5 rounded-md text-[10px] font-black uppercase shrink-0">
                  EP {effectiveChapter.number}
                </span>
                <span className="text-xs font-bold text-white/90 truncate">
                  {effectiveChapter.title || effectiveManga.title}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {onEnterMiniPip && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onEnterMiniPip}
                    className="h-8 w-8 rounded-full text-white/75 hover:text-white hover:bg-white/10"
                    title="Minimize to In-App PiP"
                  >
                    <PictureInPicture2 className="h-4 w-4" />
                  </Button>
                )}
                {onToggleTheaterMode && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onToggleTheaterMode}
                    className={cn(
                      'h-8 w-8 rounded-full',
                      isTheaterMode
                        ? 'bg-primary/25 text-primary'
                        : 'text-white/75 hover:text-white hover:bg-white/10'
                    )}
                    title="Theater Mode (T)"
                  >
                    <RectangleHorizontal className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleFullscreen}
                  className="h-8 w-8 rounded-full text-white/75 hover:text-white hover:bg-white/10"
                  title="Fullscreen (F)"
                >
                  <Maximize className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={closeAndStopPlayer}
                  className="h-8 w-8 rounded-full text-white/75 hover:text-white hover:bg-white/10"
                  title="Close Player"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
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
                    if (!isInline) {
                      closeAndStopPlayer()
                    }
                  }}
                  className="h-10 w-10 text-white/70 hover:text-white hover:bg-white/10 rounded-full"
                  title={isInline ? 'Exit Fullscreen (Esc)' : 'Back to Details (Esc)'}
                >
                  <ArrowLeft className="h-6 w-6" />
                </Button>
              </div>

              {/* Centered Title Section */}
              <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center min-w-0 text-center pointer-events-none">
                <h1 className="text-base font-black tracking-tighter text-white truncate max-w-[200px] sm:max-w-md uppercase italic drop-shadow-md">
                  {effectiveManga.title}
                </h1>
                <div className="flex items-center gap-2 text-[10px] text-white/40 font-bold uppercase tracking-widest drop-shadow-sm">
                  <span className="bg-primary/20 text-primary px-1.5 py-0.5 rounded text-[9px]">
                    EP {effectiveChapter.number}
                  </span>
                  <span className="truncate max-w-[150px] opacity-60 italic">
                    {effectiveChapter.title || 'Watching Now'}
                  </span>
                </div>
              </div>

              <div
                className="flex items-center gap-3"
                style={{ WebkitAppRegion: 'no-drag' } as any}
              >
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

                <ServerSelector
                  servers={servers}
                  activeServerIdx={activeServerIdx}
                  onSelectServer={handleSelectServer}
                  onSwitchServer={handleManualSwitch}
                />

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
          )}

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
                  onClick={() => prevEpisode && setEffectiveEpisode(prevEpisode)}
                >
                  <ChevronLeft className="h-10 w-10 text-white/30 hover:text-white/70 transition-colors" />
                </div>

                <div
                  className={cn(
                    'absolute right-0 top-0 bottom-0 w-24 z-30 cursor-pointer transition-all duration-300 bg-gradient-to-l from-black/60 to-transparent flex items-center justify-end pr-6',
                    showControls ? 'opacity-100' : 'opacity-0 pointer-events-none',
                    !nextEpisode && 'hidden'
                  )}
                  onClick={() => nextEpisode && setEffectiveEpisode(nextEpisode)}
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
                    onClick={() => DataService.openInternalBrowser(effectiveChapter.url)}
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
                          {debugInfo.htmlLength}{' '}
                          {debugInfo.htmlLength < 500 ? '(Likely blocked)' : ''}
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
            ) : (
              mediaSurface
            )}
          </div>

          {/* Hold-to-2x Speed Pill */}
          {isHold2x && (
            <div className="absolute top-6 sm:top-12 left-1/2 -translate-x-1/2 z-50 px-4 py-1.5 rounded-full bg-black/80 backdrop-blur-md border border-white/25 text-white text-xs font-black tracking-wider flex items-center gap-1.5 shadow-2xl pointer-events-none animate-in fade-in zoom-in-95 duration-150">
              <span>2x</span>
              <span className="text-primary tracking-tighter">&gt;&gt;</span>
            </div>
          )}

          {/* Resume Progress Toast */}
          {resumeNotice && (
            <div className="absolute top-12 sm:top-16 left-1/2 -translate-x-1/2 z-50 bg-black/80 backdrop-blur-md border border-primary/40 px-4 py-2 rounded-full text-xs font-bold text-primary shadow-xl animate-in fade-in slide-in-from-top-2 duration-300">
              {resumeNotice}
            </div>
          )}

          {/* Episodes Sidebar Overlay (Fullscreen / Overlay / Theater mode) */}
          {(!showBoxedInline || isTheaterMode) && (
            <EpisodeDrawer
              isOpen={isEpisodesOpen}
              onClose={() => setIsEpisodesOpen(false)}
              episodes={sortedEpisodes}
              activeChapterId={effectiveChapter.id}
              onSelectEpisode={(ep) => setEffectiveEpisode(ep)}
            />
          )}

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
                onClick={() => prevEpisode && setEffectiveEpisode(prevEpisode)}
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
                  EPISODE {effectiveChapter.number}
                </span>
              </div>

              <div className="h-8 w-px bg-white/10 mx-1" />

              <Button
                variant="ghost"
                size="icon"
                disabled={!nextEpisode}
                onClick={() => nextEpisode && setEffectiveEpisode(nextEpisode)}
                className="h-12 w-12 rounded-full text-white/50 hover:text-white hover:bg-white/10 disabled:opacity-20 transition-colors"
              >
                <ChevronRight className="h-6 w-6" />
              </Button>
            </div>
          )}

          {/* Native Video Player Control Bar */}
          {videoType !== 'embed' && !loading && !error && activeServerUrl && (
            <VideoControls
              showControls={showControls}
              currentTime={currentTime}
              duration={duration}
              bufferedPercent={bufferedPercent}
              isPlaying={isPlaying}
              isMuted={isMuted}
              volume={volume}
              playbackRate={playbackRate}
              isFullscreen={isFullscreen}
              isPiP={isPiP}
              videoType={videoType}
              qualityLevels={qualityLevels}
              selectedQuality={selectedQuality}
              currentQualityLabel={currentQualityLabel}
              mp4QualityLabel={mp4QualityLabel}
              prevEpisode={prevEpisode}
              nextEpisode={nextEpisode}
              onTogglePlay={togglePlay}
              onSeekTo={seekTo}
              onSeekBy={seekBy}
              onToggleMute={toggleMute}
              onVolumeChange={handleVolumeChange}
              onChangeSpeed={changeSpeed}
              onToggleFullscreen={toggleFullscreen}
              onTogglePiP={togglePiP}
              onQualityChange={handleQualityChange}
              onPrevEpisode={() => prevEpisode && setEffectiveEpisode(prevEpisode)}
              onNextEpisode={() => nextEpisode && setEffectiveEpisode(nextEpisode)}
              skipTimes={skipTimes}
            />
          )}

          {/* Netflix-style Floating Skip Intro / Next Episode Buttons */}
          {videoType !== 'embed' && !loading && !error && activeServerUrl && !isEpisodesOpen && (
            <div
              className={cn(
                'absolute right-4 sm:right-6 z-50 flex flex-col items-end gap-2.5 transition-all duration-300',
                showControls ? 'bottom-20 sm:bottom-24' : 'bottom-5 sm:bottom-8'
              )}
              onClick={(e) => e.stopPropagation()}
            >
              {skipUIState.isInIntro && (
                <button
                  type="button"
                  onClick={handleSkipIntro}
                  className="group/skip flex items-center gap-2.5 px-5 py-2.5 rounded-xl bg-neutral-900/90 hover:bg-white text-white hover:text-black border border-white/25 hover:border-white backdrop-blur-xl shadow-2xl shadow-black/70 font-bold text-sm transition-all duration-200 cursor-pointer animate-in fade-in slide-in-from-bottom-2"
                >
                  <SkipForward className="h-4 w-4 fill-current" />
                  <span>Skip Intro</span>
                  <span className="ml-1 px-1.5 py-0.5 text-[10px] font-mono rounded bg-white/15 group-hover/skip:bg-black/15 text-white/80 group-hover/skip:text-black/80">
                    S
                  </span>
                </button>
              )}

              {skipUIState.showNextEpisode && autoNextCountdown === null && nextEpisode && (
                <div className="flex items-center gap-1.5 rounded-xl bg-neutral-900/95 border border-primary/40 backdrop-blur-xl p-1.5 shadow-2xl shadow-black/80 animate-in fade-in slide-in-from-bottom-2">
                  <button
                    type="button"
                    onClick={() => {
                      setOutroCountdown(null)
                      setEffectiveEpisode(nextEpisode)
                    }}
                    className="flex items-center gap-2.5 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm transition-colors cursor-pointer"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    <div className="flex flex-col items-start leading-tight">
                      <span>
                        Next Episode →{outroCountdown !== null ? ` (${outroCountdown}s)` : ''}
                      </span>
                      <span className="text-[10px] font-medium opacity-85 truncate max-w-[180px]">
                        Ep {nextEpisode.number}
                        {nextEpisode.title ? ` • ${nextEpisode.title}` : ''}
                      </span>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOutroDismissed(true)
                      setOutroCountdown(null)
                    }}
                    className="px-2.5 py-2 rounded-lg text-xs font-semibold text-neutral-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                    title="Cancel / Dismiss"
                  >
                    {outroCountdown !== null ? 'Cancel' : <X className="h-4 w-4" />}
                  </button>
                </div>
              )}
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
                    setEffectiveEpisode(nextEpisode)
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
      </div>

      {/* Compact Control Strip Below Video in Inline Watch Mode */}
      {showBoxedInline && (
        <div className="relative z-10 rounded-xl bg-card/90 backdrop-blur-md border border-border/80 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2.5 shadow-sm">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 rounded-lg bg-secondary/60 p-0.5 border border-border/60">
              <Button
                variant="ghost"
                size="icon"
                disabled={!prevEpisode}
                onClick={() => prevEpisode && setEffectiveEpisode(prevEpisode)}
                className="h-7 w-7 rounded-md"
                title="Previous Episode (P)"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-2 text-xs font-bold text-foreground whitespace-nowrap">
                EP {effectiveChapter.number}
              </span>
              <Button
                variant="ghost"
                size="icon"
                disabled={!nextEpisode}
                onClick={() => nextEpisode && setEffectiveEpisode(nextEpisode)}
                className="h-7 w-7 rounded-md"
                title="Next Episode (N)"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAutoNextAnime(!autoNextAnime)}
              className={cn(
                'h-8 px-3 text-[11px] font-bold rounded-full border transition-all',
                autoNextAnime
                  ? 'bg-primary/15 border-primary/40 text-primary hover:bg-primary/25'
                  : 'bg-secondary/50 border-border text-muted-foreground hover:text-foreground'
              )}
            >
              <Zap className={cn('h-3.5 w-3.5 mr-1.5', autoNextAnime && 'fill-current')} />
              Auto-Next
            </Button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <ServerSelector
              servers={servers}
              activeServerIdx={activeServerIdx}
              onSelectServer={handleSelectServer}
              onSwitchServer={handleManualSwitch}
              tone="surface"
            />

            <Button
              variant="ghost"
              size="icon"
              onClick={() => DataService.openInternalBrowser(effectiveChapter.url)}
              className="h-8 w-8 rounded-full text-amber-500 hover:text-amber-600 hover:bg-amber-500/10"
              title="Resolve Cloudflare in Browser"
            >
              <ShieldAlert className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={reloadPlayer}
              className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
              title="Reload Player (R)"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={toggleAmbientMode}
              className={cn(
                'h-8 px-2.5 rounded-full text-xs font-semibold gap-1.5 border',
                ambientEnabled
                  ? 'bg-primary/15 border-primary/40 text-primary'
                  : 'border-border/70 text-muted-foreground hover:text-foreground'
              )}
              title="Toggle Ambient Glow"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Ambient</span>
            </Button>

            {onEnterMiniPip && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onEnterMiniPip}
                className="h-8 px-2.5 rounded-full text-xs font-semibold gap-1.5 border border-border/70 text-muted-foreground hover:text-foreground"
                title="Minimize to Bottom-Right Mini Player"
              >
                <PictureInPicture2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Mini PiP</span>
              </Button>
            )}

            {onToggleTheaterMode && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleTheaterMode}
                className={cn(
                  'h-8 px-2.5 rounded-full text-xs font-semibold gap-1.5 border',
                  isTheaterMode
                    ? 'bg-primary/15 border-primary/40 text-primary'
                    : 'border-border/70 text-muted-foreground hover:text-foreground'
                )}
                title="Toggle Theater Mode (T)"
              >
                <RectangleHorizontal className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Theater</span>
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={toggleFullscreen}
              className="h-8 px-2.5 rounded-full text-xs font-semibold gap-1.5 border border-border/70 text-muted-foreground hover:text-foreground"
              title="Fullscreen (F)"
            >
              <Maximize className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Fullscreen</span>
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={closeAndStopPlayer}
              className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              title="Close Player"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
