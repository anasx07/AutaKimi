import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  View,
  ActivityIndicator,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Modal,
  ScrollView,
  Dimensions
} from 'react-native'
import { useLocalSearchParams, router, Stack } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { StatusBar } from 'expo-status-bar'
import { useEventListener } from 'expo'
import { useVideoPlayer, VideoView } from 'expo-video'
import { WebView } from 'react-native-webview'
import * as WebBrowser from 'expo-web-browser'
import { Typography, Button } from '@mobile/native/ui'
import { DataService } from '@renderer/shared/api'
import {
  ArrowLeft,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Server,
  Play,
  X,
  Radio
} from 'lucide-react-native'
import { getVideoHeaders, DEFAULT_MOBILE_USER_AGENT } from '../../src/mobile/cf-cookies'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

export interface ServerOption {
  name: string
  url: string
  type: 'hls' | 'mp4' | 'embed'
  headers?: Record<string, string>
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

const INJECTED_POPUP_BLOCKER = `
(function() {
  window.open = function() { return null; };
  window.alert = function() {};
  window.confirm = function() { return false; };
  window.prompt = function() { return null; };

  function sanitizeLinks() {
    var links = document.querySelectorAll('a[target]');
    for (var i = 0; i < links.length; i++) {
      links[i].removeAttribute('target');
    }
  }
  setInterval(sanitizeLinks, 1000);

  function hookVideos() {
    var videos = document.querySelectorAll('video');
    for (var i = 0; i < videos.length; i++) {
      var v = videos[i];
      if (v.__hooked) continue;
      v.__hooked = true;
      v.addEventListener('timeupdate', function() {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'timeupdate',
            currentTime: v.currentTime,
            duration: v.duration
          }));
        }
      });
      v.addEventListener('ended', function() {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'ended'
          }));
        }
      });
    }
  }
  setInterval(hookVideos, 1000);
})();
true;
`

// Direct Native Stream Player (HLS / MP4)
function DirectVideoPlayer({
  server,
  refererUrl,
  initialTime,
  onProgress,
  onEnd
}: {
  server: ServerOption
  refererUrl?: string
  initialTime: number
  onProgress: (currentTime: number, duration: number) => void
  onEnd: () => void
}) {
  const headers = useMemo(() => {
    return {
      ...getVideoHeaders(server.url, refererUrl),
      ...(server.headers || {})
    }
  }, [server.url, server.headers, refererUrl])

  const videoSource = useMemo(() => {
    return {
      uri: server.url,
      headers,
      contentType: server.type === 'hls' ? ('hls' as const) : server.type === 'mp4' ? ('progressive' as const) : undefined
    }
  }, [server.url, headers, server.type])

  const player = useVideoPlayer(videoSource, (p) => {
    p.timeUpdateEventInterval = 1
    if (initialTime > 10) {
      p.currentTime = initialTime
    }
    p.play()
  })

  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    const duration = player.duration || 0
    onProgress(currentTime, duration)
  })

  useEventListener(player, 'playToEnd', () => {
    onEnd()
  })

  return (
    <VideoView
      player={player}
      style={{ width: '100%', height: '100%' }}
      contentFit="contain"
      nativeControls={true}
    />
  )
}

// Embedded Web Stream Player (Iframe with Popup Blocking)
function EmbedVideoPlayer({
  server,
  refererUrl,
  onProgress,
  onEnd
}: {
  server: ServerOption
  refererUrl?: string
  onProgress: (currentTime: number, duration: number) => void
  onEnd: () => void
}) {
  const headers = useMemo(() => {
    return {
      ...getVideoHeaders(server.url, refererUrl),
      ...(server.headers || {})
    }
  }, [server.url, server.headers, refererUrl])

  const onShouldStartLoadWithRequest = useCallback((request: any) => {
    const reqUrl = (request.url || '').toLowerCase()
    if (reqUrl === 'about:blank' || reqUrl.startsWith('about:')) return true
    if (
      reqUrl.startsWith('intent:') ||
      reqUrl.startsWith('market:') ||
      reqUrl.startsWith('itms-app:') ||
      reqUrl.startsWith('itms-apps:') ||
      reqUrl.startsWith('vnd.youtube:')
    ) {
      return false
    }
    return true
  }, [])

  return (
    <WebView
      source={{
        uri: server.url,
        headers
      }}
      userAgent={DEFAULT_MOBILE_USER_AGENT}
      allowsFullscreenVideo={true}
      allowsInlineMediaPlayback={true}
      mediaPlaybackRequiresUserAction={false}
      javaScriptEnabled={true}
      domStorageEnabled={true}
      setSupportMultipleWindows={false}
      javaScriptCanOpenWindowsAutomatically={false}
      injectedJavaScript={INJECTED_POPUP_BLOCKER}
      onMessage={(event) => {
        try {
          const data = JSON.parse(event.nativeEvent.data)
          if (data.type === 'timeupdate') {
            onProgress(data.currentTime, data.duration)
          } else if (data.type === 'ended') {
            onEnd()
          }
        } catch {}
      }}
      onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
      style={{ width: '100%', height: '100%', backgroundColor: '#000000' }}
    />
  )
}

export default function PlayerScreen() {
  const { animeId, episodeId, pkg, episodeUrl, episodeTitle, animeTitle } =
    useLocalSearchParams<{
      animeId: string
      episodeId: string
      pkg?: string
      episodeUrl?: string
      episodeTitle?: string
      animeTitle?: string
    }>()

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [servers, setServers] = useState<ServerOption[]>([])
  const [activeServerIdx, setActiveServerIdx] = useState(0)
  const [showControls, setShowControls] = useState(true)
  const [showServerModal, setShowServerModal] = useState(false)
  const [initialTime, setInitialTime] = useState(0)
  const [autoNextCountdown, setAutoNextCountdown] = useState<number | null>(null)

  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const progressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastProgressRef = useRef<{ isRead: boolean; lastPage: number } | null>(null)

  // 1. Fetch episodes list for previous/next navigation
  const { data: allEpisodes } = useQuery({
    queryKey: ['anime-episodes', animeId],
    queryFn: async () => {
      const res = await DataService.db.getChapters(animeId)
      return (res as any)?.value || res || []
    },
    enabled: !!animeId
  })

  const sortedEpisodes = useMemo(() => {
    if (!allEpisodes || !Array.isArray(allEpisodes)) return []
    return [...allEpisodes].sort((a: any, b: any) => Number(a.number || 0) - Number(b.number || 0))
  }, [allEpisodes])

  const currentEpIndex = sortedEpisodes.findIndex((e: any) => e.id === episodeId)
  const prevEpisode = currentEpIndex > 0 ? sortedEpisodes[currentEpIndex - 1] : null
  const nextEpisode =
    currentEpIndex >= 0 && currentEpIndex < sortedEpisodes.length - 1
      ? sortedEpisodes[currentEpIndex + 1]
      : null

  // 2. Fetch saved watching progress to resume playback
  useEffect(() => {
    if (!animeId || !episodeId) return
    DataService.db
      .getProgress(animeId)
      .then((res: any) => {
        const rows = res?.value || res || []
        const currentProgress = rows.find((r: any) => r.chapter_id === episodeId)
        if (currentProgress && currentProgress.last_page && currentProgress.last_page > 10 && !currentProgress.is_read) {
          setInitialTime(currentProgress.last_page)
        }
      })
      .catch(() => {})
  }, [animeId, episodeId])

  // 3. Flush progress synchronously
  const flushProgress = useCallback(() => {
    if (progressTimerRef.current) {
      clearTimeout(progressTimerRef.current)
      progressTimerRef.current = null
    }
    if (lastProgressRef.current && animeId && episodeId) {
      const { isRead, lastPage } = lastProgressRef.current
      DataService.db
        .updateProgress({
          mangaId: animeId,
          chapterId: episodeId,
          isRead,
          lastPage
        })
        .catch(console.error)

      DataService.db
        .updateHistoryDuration({
          mangaId: animeId,
          chapterId: episodeId,
          durationSeconds: lastPage
        })
        .catch(console.error)

      lastProgressRef.current = null
    }
  }, [animeId, episodeId])

  useEffect(() => {
    return () => {
      flushProgress()
    }
  }, [flushProgress])

  // 4. Debounced progress schedule
  const handleProgress = useCallback(
    (currentTime: number, duration: number) => {
      if (currentTime <= 0) return
      const isRead = duration > 0 ? currentTime / duration >= 0.85 : false
      lastProgressRef.current = { isRead, lastPage: Math.floor(currentTime) }

      if (progressTimerRef.current) {
        clearTimeout(progressTimerRef.current)
      }

      progressTimerRef.current = setTimeout(() => {
        flushProgress()
      }, 3000)
    },
    [flushProgress]
  )

  // 5. Fetch stream from extension
  const fetchStream = useCallback(async () => {
    if (!pkg || !episodeUrl) {
      setStatus('error')
      setErrorMsg('Missing extension package or episode URL')
      return
    }

    setStatus('loading')
    setErrorMsg('')
    try {
      const allExts = await DataService.db.getExtensions()
      const extList = (allExts as any)?.value || allExts || []
      const ext = extList.find((e: any) => e.pkg === pkg)
      if (!ext?.code) throw new Error('Extension not found')

      const result = await DataService.executeExtension({
        pkg,
        code: ext.code,
        contextArgs: { type: 'fetchPages', chapterUrl: episodeUrl }
      })

      const rawUrls: any[] =
        result?.pages || result?.urls || result?.data || (Array.isArray(result) ? result : [])
      if (!rawUrls || rawUrls.length === 0) throw new Error('No stream URLs returned from extension')

      const parsedServers: ServerOption[] = rawUrls
        .map((s: any, idx: number) => {
          if (typeof s === 'object' && s !== null) {
            return {
              name: s.name || `Server ${idx + 1}`,
              url: s.url || '',
              type: s.type || getVideoType(s),
              headers: s.headers
            }
          }
          return {
            name: `Server ${idx + 1}`,
            url: String(s),
            type: getVideoType(s)
          }
        })
        .filter((s: ServerOption) => !!s.url)

      if (parsedServers.length === 0) throw new Error('No playable video streams found')

      setServers(parsedServers)

      // Prioritize direct native streams (hls / mp4) over embed
      const directIdx = parsedServers.findIndex((s) => s.type === 'hls' || s.type === 'mp4')
      const targetIdx = directIdx !== -1 ? directIdx : 0
      setActiveServerIdx(targetIdx)
      setStatus('ready')
    } catch (e: any) {
      setStatus('error')
      setErrorMsg(e.message || 'Failed to load video stream')
    }
  }, [pkg, episodeUrl])

  useEffect(() => {
    fetchStream()
  }, [fetchStream])

  // 6. Navigation between episodes
  const navigateToEpisode = useCallback(
    (targetEp: any) => {
      flushProgress()
      setAutoNextCountdown(null)

      DataService.db
        .addHistory({
          mangaId: animeId,
          mangaTitle: animeTitle,
          chapterId: targetEp.id,
          chapterTitle: targetEp.title || `Episode ${targetEp.number}`,
          startedAt: new Date().toISOString(),
          pkg,
          type: 'anime'
        })
        .catch(() => {})

      router.replace({
        pathname: '/player/[animeId]/[episodeId]' as any,
        params: {
          animeId,
          episodeId: targetEp.id,
          pkg,
          episodeUrl: targetEp.url,
          episodeTitle: targetEp.title || `Episode ${targetEp.number}`,
          animeTitle
        }
      })
    },
    [animeId, animeTitle, pkg, flushProgress]
  )

  // 7. Auto-next episode countdown when video finishes
  const handleEpisodeEnd = useCallback(() => {
    flushProgress()
    if (nextEpisode) {
      setAutoNextCountdown(5)
    }
  }, [flushProgress, nextEpisode])

  useEffect(() => {
    if (autoNextCountdown === null) return
    if (autoNextCountdown <= 0) {
      setAutoNextCountdown(null)
      if (nextEpisode) {
        navigateToEpisode(nextEpisode)
      }
      return
    }

    const timer = setTimeout(() => {
      setAutoNextCountdown((prev) => (prev !== null ? prev - 1 : null))
    }, 1000)
    return () => clearTimeout(timer)
  }, [autoNextCountdown, nextEpisode, navigateToEpisode])

  // 8. Auto-hiding HUD controls
  const resetControlsTimer = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current)
    }
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false)
    }, 4500)
  }, [])

  const toggleControls = useCallback(() => {
    setShowControls((prev) => {
      const next = !prev
      if (next) resetControlsTimer()
      return next
    })
  }, [resetControlsTimer])

  useEffect(() => {
    resetControlsTimer()
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current)
    }
  }, [resetControlsTimer])

  const activeServer = servers[activeServerIdx] || null

  return (
    <View className="flex-1 bg-black">
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar hidden={!showControls} style="light" />

      {/* Main Video Surface */}
      <View className="flex-1 items-center justify-center">
        {status === 'loading' ? (
          <View className="items-center justify-center p-8">
            <ActivityIndicator size="large" color="#3b82f6" />
            <Typography className="text-white/60 mt-4 text-center font-medium">
              Loading video stream...
            </Typography>
          </View>
        ) : status === 'error' ? (
          <View className="items-center justify-center px-8">
            <AlertTriangle size={48} color="#ef4444" />
            <Typography className="text-white text-lg font-semibold mt-4 text-center">
              Failed to load video stream
            </Typography>
            <Typography className="text-white/60 mt-2 text-center text-sm">
              {errorMsg}
            </Typography>
            <View className="flex-row gap-3 mt-6">
              <Button
                title="Retry"
                variant="primary"
                onPress={fetchStream}
                icon={<RefreshCw size={16} color="#fff" />}
              />
              <Button
                title="Go Back"
                variant="outline"
                onPress={() => {
                  flushProgress()
                  router.back()
                }}
              />
            </View>
          </View>
        ) : activeServer ? (
          <TouchableWithoutFeedback onPress={toggleControls}>
            <View className="flex-1 w-full h-full">
              {activeServer.type === 'embed' ? (
                <EmbedVideoPlayer
                  key={activeServer.url}
                  server={activeServer}
                  refererUrl={episodeUrl}
                  onProgress={handleProgress}
                  onEnd={handleEpisodeEnd}
                />
              ) : (
                <DirectVideoPlayer
                  key={activeServer.url}
                  server={activeServer}
                  refererUrl={episodeUrl}
                  initialTime={initialTime}
                  onProgress={handleProgress}
                  onEnd={handleEpisodeEnd}
                />
              )}
            </View>
          </TouchableWithoutFeedback>
        ) : null}
      </View>

      {/* Top Floating HUD */}
      {showControls && status === 'ready' && (
        <View className="absolute top-0 left-0 right-0 z-30 bg-gradient-to-b from-black/85 via-black/45 to-transparent pt-10 pb-4 px-4">
          <View className="flex-row items-center justify-between">
            {/* Back button and Titles */}
            <View className="flex-row items-center flex-1 mr-2">
              <TouchableOpacity
                className="p-2 rounded-full bg-white/10 active:bg-white/20 mr-2"
                onPress={() => {
                  flushProgress()
                  router.back()
                }}
              >
                <ArrowLeft size={20} color="#fff" />
              </TouchableOpacity>
              <View className="flex-1">
                <Typography className="text-white text-sm font-bold" numberOfLines={1}>
                  {episodeTitle || 'Episode'}
                </Typography>
                <Typography className="text-white/60 text-xs" numberOfLines={1}>
                  {animeTitle || ''}
                </Typography>
              </View>
            </View>

            {/* Server Selector & External Fallback */}
            <View className="flex-row items-center gap-2">
              {servers.length > 1 && (
                <TouchableOpacity
                  className="flex-row items-center bg-white/15 px-3 py-1.5 rounded-full active:bg-white/25"
                  onPress={() => setShowServerModal(true)}
                >
                  <Server size={14} color="#60a5fa" />
                  <Typography className="text-white text-xs font-semibold ml-1.5">
                    {activeServer?.name || `Server ${activeServerIdx + 1}`}
                  </Typography>
                </TouchableOpacity>
              )}

              {activeServer?.url && (
                <TouchableOpacity
                  className="p-2 rounded-full bg-white/10 active:bg-white/20"
                  onPress={() => {
                    WebBrowser.openBrowserAsync(activeServer.url, {
                      toolbarColor: '#09090b',
                      controlsColor: '#ffffff'
                    }).catch(() => {})
                  }}
                  title="Open in External Browser"
                >
                  <ExternalLink size={18} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      )}

      {/* Auto-Next Episode Floating Banner */}
      {autoNextCountdown !== null && nextEpisode && (
        <View className="absolute bottom-20 left-4 right-4 z-40 bg-zinc-900/95 border border-primary/40 rounded-2xl p-4 shadow-2xl flex-row items-center justify-between">
          <View className="flex-1 mr-3">
            <Typography className="text-white text-xs font-bold uppercase tracking-wider text-primary">
              Episode Finished
            </Typography>
            <Typography className="text-white text-sm font-semibold mt-0.5" numberOfLines={1}>
              Next: Episode {nextEpisode.number} ({autoNextCountdown}s)
            </Typography>
          </View>
          <View className="flex-row items-center gap-2">
            <Button
              title="Cancel"
              variant="outline"
              size="sm"
              onPress={() => setAutoNextCountdown(null)}
            />
            <Button
              title="Play Now"
              variant="primary"
              size="sm"
              onPress={() => navigateToEpisode(nextEpisode)}
              icon={<Play size={14} color="#fff" />}
            />
          </View>
        </View>
      )}

      {/* Bottom Floating Navigation HUD */}
      {showControls && status === 'ready' && (
        <View className="absolute bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-black/90 via-black/50 to-transparent pb-6 pt-3 px-6">
          <View className="flex-row items-center justify-between">
            {/* Previous Episode */}
            <TouchableOpacity
              className={`flex-row items-center py-2 px-3 rounded-full bg-white/10 ${
                !prevEpisode ? 'opacity-30' : 'active:bg-white/20'
              }`}
              disabled={!prevEpisode}
              onPress={() => prevEpisode && navigateToEpisode(prevEpisode)}
            >
              <ChevronLeft size={18} color="#fff" />
              <Typography className="text-white text-xs font-medium ml-1">Prev</Typography>
            </TouchableOpacity>

            {/* Stream Type Pill */}
            <View className="flex-row items-center bg-black/60 border border-white/10 px-3 py-1.5 rounded-full">
              <Radio size={12} color={activeServer?.type === 'embed' ? '#f59e0b' : '#10b981'} />
              <Typography className="text-white/80 text-[11px] font-bold uppercase tracking-wider ml-1.5">
                {activeServer?.type === 'hls'
                  ? 'Direct HLS'
                  : activeServer?.type === 'mp4'
                  ? 'Direct MP4'
                  : 'Web Embed'}
              </Typography>
            </View>

            {/* Next Episode */}
            <TouchableOpacity
              className={`flex-row items-center py-2 px-3 rounded-full bg-white/10 ${
                !nextEpisode ? 'opacity-30' : 'active:bg-white/20'
              }`}
              disabled={!nextEpisode}
              onPress={() => nextEpisode && navigateToEpisode(nextEpisode)}
            >
              <Typography className="text-white text-xs font-medium mr-1">Next</Typography>
              <ChevronRight size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Server Selection Modal */}
      <Modal
        visible={showServerModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowServerModal(false)}
      >
        <View className="flex-1 bg-black/75 items-center justify-center p-6">
          <View className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-sm overflow-hidden p-4">
            <View className="flex-row items-center justify-between pb-3 border-b border-white/10 mb-2">
              <View className="flex-row items-center">
                <Server size={18} color="#60a5fa" />
                <Typography className="text-white font-bold text-base ml-2">
                  Select Video Server
                </Typography>
              </View>
              <TouchableOpacity
                className="p-1 rounded-full bg-white/10"
                onPress={() => setShowServerModal(false)}
              >
                <X size={16} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView className="max-h-64 my-2">
              {servers.map((srv, idx) => {
                const isSelected = idx === activeServerIdx
                return (
                  <TouchableOpacity
                    key={`${srv.url}-${idx}`}
                    className={`flex-row items-center justify-between p-3 rounded-xl mb-1.5 ${
                      isSelected
                        ? 'bg-primary/20 border border-primary/50'
                        : 'bg-white/5 active:bg-white/10'
                    }`}
                    onPress={() => {
                      setActiveServerIdx(idx)
                      setShowServerModal(false)
                    }}
                  >
                    <View className="flex-1 mr-2">
                      <Typography
                        className={`text-sm font-semibold ${
                          isSelected ? 'text-primary' : 'text-white'
                        }`}
                        numberOfLines={1}
                      >
                        {srv.name}
                      </Typography>
                    </View>
                    <View
                      className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                        srv.type === 'hls' || srv.type === 'mp4'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-amber-500/20 text-amber-400'
                      }`}
                    >
                      <Typography
                        className={`text-[10px] font-bold uppercase ${
                          srv.type === 'hls' || srv.type === 'mp4'
                            ? 'text-emerald-400'
                            : 'text-amber-400'
                        }`}
                      >
                        {srv.type}
                      </Typography>
                    </View>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  )
}
