import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import {
  View, FlatList, TouchableOpacity, ActivityIndicator,
  Dimensions, TouchableWithoutFeedback, PanResponder, Animated
} from 'react-native'

import { useLocalSearchParams, router, Stack } from 'expo-router'
import { Image as ExpoImage } from 'expo-image'
import * as FileSystem from 'expo-file-system/legacy'
import { useQuery } from '@tanstack/react-query'
import { Typography, Button } from '@mobile/native/ui';
import { DataService } from '@renderer/shared/api'
import { ArrowLeft, AlertTriangle, Loader2, ChevronLeft, ChevronRight, RefreshCw, ShieldCheck } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { getImageHeaders } from '../../../src/mobile/cf-cookies'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

// --- ReaderImage Component ---
const ReaderImage = ({ url, index, refererUrl }: { url: string; index: number; refererUrl?: string }) => {
  const [imgHeight, setImgHeight] = useState<number>(SCREEN_WIDTH * 1.4)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const [isBypassingCf, setIsBypassingCf] = useState(false)

  // Zoom & Pan state for pinch-to-zoom
  const scale = useRef(new Animated.Value(1)).current
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current
  const scaleRef = useRef(1)
  const panXRef = useRef(0)
  const panYRef = useRef(0)
  const lastPanX = useRef(0)
  const lastPanY = useRef(0)
  const initialDistanceRef = useRef(0)
  const initialScaleRef = useRef(1)
  const lastTapRef = useRef(0)

  const headers = useMemo(() => {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return undefined
    }
    void retryKey
    return getImageHeaders(url, refererUrl)
  }, [url, refererUrl, retryKey])

  const handleRetry = () => {
    setError(false)
    setLoading(true)
    setRetryKey((k) => k + 1)
  }

  const handleCloudflareRefresh = async () => {
    setIsBypassingCf(true)
    try {
      const targetUrl = refererUrl || url
      await DataService.cfBypass(targetUrl)
      setError(false)
      setLoading(true)
      setRetryKey((k) => k + 1)
    } catch (err) {
      console.error('[ReaderImage] Failed to resolve Cloudflare challenge:', err)
    } finally {
      setIsBypassingCf(false)
    }
  }

  const resetZoom = useCallback(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        friction: 7
      }),
      Animated.spring(pan, {
        toValue: { x: 0, y: 0 },
        useNativeDriver: true,
        friction: 7
      })
    ]).start(() => {
      scaleRef.current = 1
      panXRef.current = 0
      panYRef.current = 0
      lastPanX.current = 0
      lastPanY.current = 0
    })
  }, [pan, scale])

  const zoomTo = useCallback(
    (targetScale: number) => {
      Animated.parallel([
        Animated.spring(scale, {
          toValue: targetScale,
          useNativeDriver: true,
          friction: 7
        }),
        Animated.spring(pan, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: true,
          friction: 7
        })
      ]).start(() => {
        scaleRef.current = targetScale
        panXRef.current = 0
        panYRef.current = 0
        lastPanX.current = 0
        lastPanY.current = 0
      })
    },
    [pan, scale]
  )

  const getDistance = (touches: readonly any[]) => {
    const [t1, t2] = touches
    return Math.hypot(t1.pageX - t2.pageX, t1.pageY - t2.pageY)
  }

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (evt) => {
          // If already zoomed in, capture touch to allow panning or double-tap reset
          if (scaleRef.current > 1.05) return true
          return evt.nativeEvent.touches.length === 2
        },
        onMoveShouldSetPanResponder: (evt) => {
          // Pinch with 2 fingers or pan when zoomed
          if (evt.nativeEvent.touches.length === 2) return true
          if (scaleRef.current > 1.05) return true
          return false
        },
        onPanResponderGrant: (evt) => {
          if (evt.nativeEvent.touches.length === 2) {
            initialDistanceRef.current = getDistance(evt.nativeEvent.touches)
            initialScaleRef.current = scaleRef.current
          } else {
            lastPanX.current = panXRef.current
            lastPanY.current = panYRef.current

            // Double tap to reset or zoom in
            const now = Date.now()
            if (now - lastTapRef.current < 300) {
              if (scaleRef.current > 1.2) {
                resetZoom()
              } else {
                zoomTo(2.5)
              }
              lastTapRef.current = 0
            } else {
              lastTapRef.current = now
            }
          }
        },
        onPanResponderMove: (evt, gestureState) => {
          if (evt.nativeEvent.touches.length === 2) {
            const dist = getDistance(evt.nativeEvent.touches)
            if (initialDistanceRef.current > 0) {
              const factor = dist / initialDistanceRef.current
              const newScale = Math.max(1, Math.min(4, initialScaleRef.current * factor))
              scale.setValue(newScale)
              scaleRef.current = newScale
            }
          } else if (evt.nativeEvent.touches.length === 1 && scaleRef.current > 1.05) {
            const maxPanX = (SCREEN_WIDTH * (scaleRef.current - 1)) / 2
            const maxPanY = (imgHeight * (scaleRef.current - 1)) / 2
            const nextX = Math.max(
              -maxPanX,
              Math.min(maxPanX, lastPanX.current + gestureState.dx)
            )
            const nextY = Math.max(
              -maxPanY,
              Math.min(maxPanY, lastPanY.current + gestureState.dy)
            )
            pan.setValue({ x: nextX, y: nextY })
            panXRef.current = nextX
            panYRef.current = nextY
          }
        },
        onPanResponderRelease: () => {
          if (scaleRef.current < 1.05) {
            resetZoom()
          } else {
            lastPanX.current = panXRef.current
            lastPanY.current = panYRef.current
          }
        },
        onPanResponderTerminate: () => {
          if (scaleRef.current < 1.05) {
            resetZoom()
          }
        }
      }),
    [imgHeight, pan, resetZoom, scale, zoomTo]
  )

  if (error) {
    const isRemote = url.startsWith('http://') || url.startsWith('https://')
    return (
      <View
        style={{ width: SCREEN_WIDTH, minHeight: SCREEN_WIDTH * 1.1 }}
        className="bg-zinc-900/90 border border-red-500/20 rounded-2xl my-3 p-6 items-center justify-center mx-auto"
      >
        <View className="w-12 h-12 rounded-full bg-red-500/10 items-center justify-center mb-3">
          <AlertTriangle size={24} color="#ef4444" />
        </View>

        <Typography className="text-white text-sm font-bold text-center">
          Page {index + 1} Failed to Load
        </Typography>

        <Typography className="text-zinc-400 text-xs text-center mt-1 px-4 mb-5">
          {isRemote
            ? 'The image might be temporarily blocked by Cloudflare (expired session) or a network error.'
            : 'The local cached image file could not be read.'}
        </Typography>

        <View className="flex-row items-center justify-center gap-3">
          <TouchableOpacity
            onPress={handleRetry}
            disabled={isBypassingCf}
            activeOpacity={0.7}
            className="flex-row items-center gap-2 bg-zinc-800 px-4 py-2.5 rounded-full border border-zinc-700 active:bg-zinc-700"
          >
            <RefreshCw size={14} color="#f4f4f5" />
            <Typography className="text-zinc-100 text-xs font-semibold">
              Retry Page
            </Typography>
          </TouchableOpacity>

          {isRemote && (
            <TouchableOpacity
              onPress={handleCloudflareRefresh}
              disabled={isBypassingCf}
              activeOpacity={0.7}
              className="flex-row items-center gap-2 bg-amber-500/10 px-4 py-2.5 rounded-full border border-amber-500/30 active:bg-amber-500/20"
            >
              {isBypassingCf ? (
                <>
                  <ActivityIndicator size="small" color="#f59e0b" />
                  <Typography className="text-amber-400 text-xs font-semibold">
                    Bypassing...
                  </Typography>
                </>
              ) : (
                <>
                  <ShieldCheck size={14} color="#f59e0b" />
                  <Typography className="text-amber-400 text-xs font-semibold">
                    Cloudflare Refresh
                  </Typography>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    )
  }

  const displayUrl =
    retryKey > 0
      ? url.includes('?')
        ? `${url}&cf_retry=${retryKey}`
        : `${url}?cf_retry=${retryKey}`
      : url

  return (
    <View
      style={{ width: SCREEN_WIDTH, minHeight: imgHeight }}
      className="bg-black justify-center items-center overflow-hidden"
      {...panResponder.panHandlers}
    >
      {loading && (
        <View className="absolute inset-0 items-center justify-center z-10">
          <ActivityIndicator size="small" color="#e11d48" />
        </View>
      )}
      <Animated.View
        style={{
          transform: [
            { scale },
            { translateX: pan.x },
            { translateY: pan.y }
          ]
        }}
      >
        <ExpoImage
          key={`${url}-${retryKey}`}
          source={{
            uri: displayUrl,
            ...(headers ? { headers } : {})
          }}
          style={{ width: SCREEN_WIDTH, height: imgHeight }}
          contentFit="contain"
          cachePolicy="memory-disk"
          priority={index < 5 ? 'high' : 'normal'}
          onLoad={(e) => {
            const { width, height } = e.source
            if (width > 0 && height > 0) {
              setImgHeight(Math.round(SCREEN_WIDTH * (height / width)))
            }
            setLoading(false)
          }}
          onError={() => {
            setError(true)
            setLoading(false)
          }}
        />
      </Animated.View>
    </View>
  )
}


// --- Main Reader Screen ---
export default function ReaderScreen() {
  const { mangaId, chapterId, pkg, chapterUrl, chapterTitle, mangaTitle } =
    useLocalSearchParams<{
      mangaId: string
      chapterId: string
      pkg?: string
      chapterUrl?: string
      chapterTitle?: string
      mangaTitle?: string
    }>()

  const insets = useSafeAreaInsets()
  const [showUI, setShowUI] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [sliderWidth, setSliderWidth] = useState(0)
  const [scrubbingPage, setScrubbingPage] = useState<number | null>(null)
  const listRef = useRef<FlatList>(null)
  const startLocationXRef = useRef(0)

  const effectiveReferer =
    chapterUrl ||
    (chapterId && (chapterId.startsWith('http://') || chapterId.startsWith('https://')) ? chapterId : undefined) ||
    (mangaId && (mangaId.startsWith('http://') || mangaId.startsWith('https://')) ? mangaId : undefined)
  const scrubbingPageRef = useRef<number | null>(null)
  scrubbingPageRef.current = scrubbingPage

  // 1. Fetch Pages
  const { data: pages, isLoading, error } = useQuery({
    queryKey: ['chapter-pages', mangaId, chapterId],
    queryFn: async (): Promise<string[]> => {
      // 1. Check offline downloaded files
      try {
        const safeManga = encodeURIComponent(mangaId || '').replace(/%/g, '_').replace(/[:/\\?*|"><]/g, '_')
        const safeChapter = encodeURIComponent(chapterId || '').replace(/%/g, '_').replace(/[:/\\?*|"><]/g, '_')
        const targetDirSub = `manga/${safeManga}/${safeChapter}`
        const targetDirUri = `${FileSystem.documentDirectory}Downloads/${targetDirSub}/`
        const dirInfo = await FileSystem.getInfoAsync(targetDirUri)
        
        if (dirInfo.exists) {
          const files = await FileSystem.readDirectoryAsync(targetDirUri)
          const imageFiles = files.filter(f => f.endsWith('.jpg')).sort()
          if (imageFiles.length > 0) {
            console.log(`[Reader] Loaded ${imageFiles.length} pages offline from ${targetDirUri}`)
            return imageFiles.map(f => `${targetDirUri}${f}`)
          }
        }
      } catch (err) {
        console.log('[Reader] Offline check failed or directory empty:', err)
      }

      // 2. Fallback to network extension
      if (!pkg || !chapterUrl) throw new Error('Missing extension info')

      const allExts = await DataService.db.getExtensions()
      const ext = allExts.find((e: any) => e.pkg === pkg)

      const result = await DataService.executeExtension({
        pkg: pkg,
        code: ext?.code || '',
        contextArgs: { type: 'fetchPages', chapterUrl }
      })

      const urls: string[] = result?.pages || result?.data || []
      if (urls.length === 0) throw new Error('No pages returned')
      return urls
    },
    enabled: !!pkg && !!chapterUrl,
    staleTime: 1000 * 60 * 60,
    retry: 2,
  })

  // 2. Fetch Chapters for Navigation
  const { data: allChapters } = useQuery({
    queryKey: ['manga-chapters', mangaId],
    queryFn: () => DataService.db.getChapters(mangaId),
    enabled: !!mangaId,
  })

  // Find next/prev chapters
  const sortedChapters = allChapters 
    ? [...allChapters].sort((a, b) => Number(a.number || 0) - Number(b.number || 0)) // Ascending order
    : []
  
  const currentChapterIndex = sortedChapters.findIndex(c => c.id === chapterId)
  const nextChapter = currentChapterIndex >= 0 && currentChapterIndex < sortedChapters.length - 1 ? sortedChapters[currentChapterIndex + 1] : null

  const pagesRef = useRef(pages)
  pagesRef.current = pages

  const progressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastProgressRef = useRef<{ isRead: boolean; lastPage: number } | null>(null)

  const flushProgress = useCallback(() => {
    if (progressTimerRef.current) {
      clearTimeout(progressTimerRef.current)
      progressTimerRef.current = null
    }
    if (lastProgressRef.current) {
      DataService.db.updateProgress({
        mangaId,
        chapterId,
        isRead: lastProgressRef.current.isRead,
        lastPage: lastProgressRef.current.lastPage
      }).catch(console.error)
      lastProgressRef.current = null
    }
  }, [mangaId, chapterId])

  useEffect(() => {
    return () => {
      flushProgress()
    }
  }, [flushProgress])

  const scheduleProgressUpdate = useCallback((pageNum: number, totalPages: number) => {
    const isRead = pageNum >= totalPages
    lastProgressRef.current = { isRead, lastPage: pageNum }

    if (progressTimerRef.current) {
      clearTimeout(progressTimerRef.current)
    }

    progressTimerRef.current = setTimeout(() => {
      if (lastProgressRef.current) {
        DataService.db.updateProgress({
          mangaId,
          chapterId,
          isRead: lastProgressRef.current.isRead,
          lastPage: lastProgressRef.current.lastPage
        }).catch(console.error)
        lastProgressRef.current = null
      }
      progressTimerRef.current = null
    }, 500)
  }, [mangaId, chapterId])

  const scheduleProgressRef = useRef(scheduleProgressUpdate)
  scheduleProgressRef.current = scheduleProgressUpdate

  // 3. Viewability tracking for progress
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
    minimumViewTime: 100,
  }).current

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: any[] }) => {
    if (viewableItems.length > 0) {
      const firstVisible = viewableItems[0]
      const pageNum = (firstVisible.index || 0) + 1
      setCurrentPage(pageNum)

      // Save progress to DB with debounce
      const totalPages = pagesRef.current?.length || 0
      if (totalPages > 0) {
        scheduleProgressRef.current(pageNum, totalPages)
      }
    }
  }).current

  const toggleUI = () => setShowUI(prev => !prev)

  // Navigation & Page Seeking
  const seekToPage = useCallback(
    (page: number, animated = false) => {
      if (!pages || pages.length === 0) return
      const targetIndex = Math.max(0, Math.min(pages.length - 1, page - 1))
      setCurrentPage(targetIndex + 1)
      try {
        listRef.current?.scrollToIndex({
          index: targetIndex,
          animated,
          viewPosition: 0,
        })
      } catch {
        listRef.current?.scrollToOffset({
          offset: targetIndex * (SCREEN_WIDTH * 1.4),
          animated,
        })
      }
    },
    [pages]
  )

  const handlePrevPage = () => {
    if (!pages || pages.length === 0) return
    if (currentPage > 1) {
      seekToPage(currentPage - 1, true)
    }
  }

  const handleNextPage = () => {
    if (!pages || pages.length === 0) return
    if (currentPage < pages.length) {
      seekToPage(currentPage + 1, true)
    }
  }

  // 3-Zone Tap Navigation: Left 25% (Prev), Center 50% (Toggle HUD), Right 25% (Next)
  const handleTap = (e: any) => {
    const x = e.nativeEvent.pageX ?? e.nativeEvent.locationX
    if (x < SCREEN_WIDTH * 0.25) {
      handlePrevPage()
    } else if (x > SCREEN_WIDTH * 0.75) {
      handleNextPage()
    } else {
      toggleUI()
    }
  }

  // Interactive Scrubber PanResponder
  const calculatePageFromX = useCallback(
    (x: number) => {
      if (!pages || pages.length <= 1 || sliderWidth <= 0) return 1
      const clampedX = Math.max(0, Math.min(x, sliderWidth))
      const ratio = clampedX / sliderWidth
      const targetPage = Math.min(pages.length, Math.max(1, Math.round(ratio * (pages.length - 1)) + 1))
      return targetPage
    },
    [pages, sliderWidth]
  )

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        startLocationXRef.current = evt.nativeEvent.locationX
        const target = calculatePageFromX(evt.nativeEvent.locationX)
        setScrubbingPage(target)
      },
      onPanResponderMove: (_evt, gestureState) => {
        const currentX = startLocationXRef.current + gestureState.dx
        const target = calculatePageFromX(currentX)
        setScrubbingPage(target)
      },
      onPanResponderRelease: (_evt, gestureState) => {
        const currentX = startLocationXRef.current + gestureState.dx
        const target = calculatePageFromX(currentX)
        setScrubbingPage(null)
        seekToPage(target, false)
      },
      onPanResponderTerminate: () => {
        if (scrubbingPageRef.current !== null) {
          seekToPage(scrubbingPageRef.current, false)
          setScrubbingPage(null)
        }
      },
    })
  ).current

  const handleNextChapter = () => {
    if (!nextChapter) return
    flushProgress()
    router.replace({
      pathname: '/reader/[mangaId]/[chapterId]' as any,
      params: {
        mangaId,
        chapterId: nextChapter.id,
        pkg: pkg || '',
        chapterUrl: nextChapter.url,
        chapterTitle: nextChapter.title || `Ch. ${nextChapter.number}`,
        mangaTitle: mangaTitle || ''
      }
    })
  }

  const activePage = scrubbingPage ?? currentPage
  const progressPercent = pages && pages.length > 0
    ? Math.min(100, Math.max(0, (activePage / pages.length) * 100))
    : 0

  return (
    <View className="flex-1 bg-black">
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header HUD */}
      {showUI && (
        <View
          style={{ paddingTop: Math.max(insets.top, 12) }}
          className="absolute top-0 left-0 right-0 z-20 bg-black/85 pb-3 border-b border-zinc-800"
        >
          <View className="flex-row items-center px-4 py-2">
            <TouchableOpacity
              className="p-2 -ml-2 rounded-full active:bg-zinc-800"
              onPress={() => router.back()}
            >
              <ArrowLeft size={24} color="#fff" />
            </TouchableOpacity>
            <View className="flex-1 ml-3">
              <Typography className="text-white text-base font-semibold" numberOfLines={1}>
                {chapterTitle || 'Chapter'}
              </Typography>
              <Typography className="text-white/70 text-xs" numberOfLines={1}>
                {mangaTitle || ''}
              </Typography>
            </View>
          </View>
        </View>
      )}

      {/* Content */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#e11d48" />
          <Typography className="text-white/60 mt-4">
            Loading pages...
          </Typography>
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-8">
          <AlertTriangle size={48} color="#ef4444" />
          <Typography className="text-white text-lg font-semibold mt-4 text-center">
            Failed to load pages
          </Typography>
          <Typography className="text-white/60 mt-2 text-center">
            {(error as Error)?.message || 'An error occurred'}
          </Typography>
          <Button
             title="Go Back"
             className="mt-6"
             onPress={() => router.back()}
          />
        </View>
      ) : (
        <TouchableWithoutFeedback onPress={handleTap}>
          <View className="flex-1">
            <FlatList
              ref={listRef}
              data={pages}
              keyExtractor={(_item, index) => `${index}`}
              renderItem={({ item, index }) => (
                <ReaderImage url={item} index={index} refererUrl={effectiveReferer} />
              )}
              showsVerticalScrollIndicator={false}
              windowSize={5}
              initialNumToRender={3}
              maxToRenderPerBatch={3}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
              onScrollToIndexFailed={(info) => {
                listRef.current?.scrollToOffset({
                  offset: info.averageItemLength * info.index,
                  animated: false,
                })
              }}
              ListFooterComponent={() => (
                 <View className="py-16 px-6 items-center">
                   <Typography className="text-white/40 text-sm mb-6">
                     End of chapter
                   </Typography>
                   {nextChapter ? (
                     <Button 
                       title={`Next: ${nextChapter.title || 'Ch. ' + nextChapter.number}`}
                       variant="primary"
                       onPress={handleNextChapter}
                       className="w-full"
                     />
                   ) : (
                     <Typography className="text-white/60">
                       No more chapters
                     </Typography>
                   )}
                 </View>
              )}
            />
          </View>
        </TouchableWithoutFeedback>
      )}

      {/* Footer HUD with Interactive Scrub Slider */}
      {showUI && pages && !isLoading && !error && (
        <View
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}
          className="absolute bottom-0 left-0 right-0 z-20 bg-black/90 pt-3 px-4 border-t border-zinc-800"
        >
          {/* Page & Progress Info */}
          <View className="flex-row items-center justify-between mb-1.5 px-1">
            <Typography className="text-white text-xs font-semibold">
              Page {activePage} / {pages.length}
            </Typography>
            <Typography className="text-zinc-400 text-xs font-medium">
              {Math.round(progressPercent)}%
            </Typography>
          </View>

          {/* Interactive Scrub Slider Controls */}
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => seekToPage(Math.max(1, currentPage - 1), true)}
              disabled={currentPage <= 1}
              className="p-1.5 rounded-lg active:bg-zinc-800"
            >
              <ChevronLeft size={20} color={currentPage <= 1 ? '#52525b' : '#ffffff'} />
            </TouchableOpacity>

            <View
              className="flex-1 h-8 justify-center mx-2"
              onLayout={(e) => setSliderWidth(e.nativeEvent.layout.width)}
              {...panResponder.panHandlers}
            >
              {/* Background Track */}
              <View className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <View
                  style={{ width: `${progressPercent}%` }}
                  className="h-full bg-primary rounded-full"
                />
              </View>

              {/* Slider Thumb Handle */}
              <View
                style={{ left: `${progressPercent}%` }}
                className="absolute w-4 h-4 -ml-2 rounded-full bg-white shadow-md top-2 border border-zinc-300"
              />
            </View>

            <TouchableOpacity
              onPress={() => seekToPage(Math.min(pages.length, currentPage + 1), true)}
              disabled={currentPage >= pages.length}
              className="p-1.5 rounded-lg active:bg-zinc-800"
            >
              <ChevronRight size={20} color={currentPage >= pages.length ? '#52525b' : '#ffffff'} />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  )
}
