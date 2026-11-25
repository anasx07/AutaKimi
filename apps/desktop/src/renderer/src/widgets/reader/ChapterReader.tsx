import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import {
  useLibraryStore,
  useReaderStore,
  useHistoryStore,
  useProgressStore,
  useExtensionStore,
  useSettingsStore,
  useDownloadStore
} from '@renderer/shared/model'
import { Button } from '@renderer/shared/ui'
import { cn } from '@renderer/shared/lib/utils'
import { isMobile } from '@renderer/shared/platform'
import {
  useMediaItems,
  mediaKeys,
  usePrefetchNextChapter
} from '@renderer/entities/media/api/useMediaQueries'
import { useQueryClient } from '@tanstack/react-query'
import { DataService } from '@renderer/shared/api'
import { Chapter } from '@renderer/shared/api/sources/types'

// Extracted Components
import { ReaderToolbar } from './components/ReaderToolbar'
import { ChapterSection } from './components/ChapterSection'
import { ShareProgressModal } from './components/ShareProgressModal'

// Extracted Hooks
import { useKeyboardControls } from './hooks/useKeyboardControls'
import { useAutoScroll } from './hooks/useAutoScroll'
import { useDragToScroll } from './hooks/useDragToScroll'
import { useZoom } from './hooks/useZoom'
import { computeEyeCareOverlay, EYE_CARE_PRESETS } from '@common/utils/eyeCare'
import { computeSmartDownloadPlan } from '@common/utils/smartDownloads'
import { EyeCareTintPreset } from '@common/types'
import {
  getDoublePageSlot,
  getNextDoublePage,
  getPrevDoublePage,
  PageDimensions
} from './lib/doublePageSpread'

export default function ChapterReader() {
  const mobile = isMobile()
  const { activeChapter, setActiveChapter, selectedManga } = useLibraryStore()
  const { activeExtension, installedExtensions } = useExtensionStore()
  const { addHistoryEntry, updateHistoryDuration } = useHistoryStore()
  const { markChapterRead, pageProgress, readingProgress } = useProgressStore()
  const queryClient = useQueryClient()

  const {
    readingMode,
    autoMarkRead,
    dragToScroll,
    autoScrollEnabled,
    setAutoScrollEnabled,
    autoScrollSpeed,
    setAutoScrollSpeed,
    autoScrollShortcuts,
    setReadingMode,
    readerTheme,
    cropBorders,
    setCropBorders,
    eyeCareEnabled,
    eyeCareTint,
    eyeCareWarmth,
    eyeCareDimming,
    setEyeCareEnabled,
    setEyeCareWarmth,
    setEyeCareDimming,
    applyEyeCarePreset
  } = useReaderStore()

  const smartDownloadsEnabled = useSettingsStore((s) => s.smartDownloadsEnabled)
  const discordRpcEnabled = useSettingsStore((s) => s.discordRpcEnabled)

  // --- State & Refs ---
  const [loadedChapters, setLoadedChapters] = useState<Chapter[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [chapterPageCounts, setChapterPageCounts] = useState<Record<string, number>>({})
  const [pageDimensionsByChapter, setPageDimensionsByChapter] = useState<
    Record<string, Record<number, PageDimensions>>
  >({})
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null)
  const [showShareModal, setShowShareModal] = useState(false)
  const [scrubberHover, setScrubberHover] = useState<{ x: number; page: number } | null>(null)
  const [isZenMode, setIsZenMode] = useState(false)
  const [zenToast, setZenToast] = useState<string | null>(null)
  const [isTopHovered, setIsTopHovered] = useState(false)
  const topHoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pendingScrollPage = useRef<number | null>(null)
  const lastSyncId = useRef<string | null>(null)
  const visiblePagesRef = useRef<Record<string, number>>({})
  const progressDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeSessionRef = useRef<{ mangaId: string; chapterId: string; startTime: number } | null>(
    null
  )
  const sessionCompletedChaptersRef = useRef<Set<string>>(new Set())
  const smartQueuedChaptersRef = useRef<Set<string>>(new Set())
  const smartSyncCleanupRef = useRef<(() => void) | null>(null)

  const toggleZenMode = useCallback(() => {
    setIsZenMode((prev) => {
      const next = !prev
      if (next) {
        setZenToast('Zen Mode Active • Press H or Double-Click to exit')
        setTimeout(() => setZenToast(null), 3000)
      } else {
        setZenToast(null)
      }
      return next
    })
  }, [])

  useEffect(() => {
    if (!isZenMode) {
      setIsTopHovered(false)
      return
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (e.clientY <= 30) {
        setIsTopHovered(true)
        if (topHoverTimeoutRef.current) {
          clearTimeout(topHoverTimeoutRef.current)
          topHoverTimeoutRef.current = null
        }
      } else if (e.clientY > 65) {
        if (!topHoverTimeoutRef.current) {
          topHoverTimeoutRef.current = setTimeout(() => {
            setIsTopHovered(false)
            topHoverTimeoutRef.current = null
          }, 600)
        }
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      if (topHoverTimeoutRef.current) {
        clearTimeout(topHoverTimeoutRef.current)
      }
    }
  }, [isZenMode])

  // Track reading duration on unmount
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

  // Escape key to close reader
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showShareModal) {
          setShowShareModal(false)
          return
        }
        setActiveChapter(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (progressDebounceRef.current) clearTimeout(progressDebounceRef.current)
    }
  }, [setActiveChapter, showShareModal])

  const resolvedPkg = selectedManga?.pkg || activeExtension || ''

  const { data: chapters = [] } = useMediaItems(
    'manga',
    selectedManga?.id || '',
    resolvedPkg,
    selectedManga?.url
  )

  usePrefetchNextChapter(selectedManga?.id || '', resolvedPkg, chapters, activeChapter)

  const sortedChapters = useMemo(() => {
    return [...chapters].sort((a, b) => {
      const getNum = (c: any) => {
        if (typeof c.number === 'number') return c.number
        const str = String(c.number || '').replace(/[^0-9.]/g, '')
        const parsed = parseFloat(str)
        return isNaN(parsed) ? 0 : parsed
      }
      return getNum(a) - getNum(b)
    })
  }, [chapters])

  const currentChapterIdx = sortedChapters.findIndex((c) => c.id === activeChapter?.id)
  const prevChapter = currentChapterIdx > 0 ? sortedChapters[currentChapterIdx - 1] : null
  const nextChapter =
    currentChapterIdx !== -1 && currentChapterIdx + 1 < sortedChapters.length
      ? sortedChapters[currentChapterIdx + 1]
      : null

  const goToChapter = useCallback(
    (chapter: Chapter) => {
      if (!chapter || chapter.id === activeChapter?.id) return
      setLoadedChapters([chapter])
      lastSyncId.current = chapter.id
      setActiveChapter(chapter)
      const savedPage = (selectedManga && pageProgress[selectedManga.id]?.[chapter.id]) || 1
      setCurrentPage(savedPage)
      if (savedPage > 1) {
        pendingScrollPage.current = savedPage
      } else {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = 0
          scrollRef.current.scrollLeft = 0
        }
      }
    },
    [activeChapter?.id, selectedManga, pageProgress, setActiveChapter]
  )

  const isInfiniteScroll = readingMode === 'webtoon' || readingMode === 'continuous-vertical'
  const isVertical = isInfiniteScroll || readingMode === 'paged-vertical'
  const isHorizontalContinuous =
    readingMode === 'continuous-ltr' || readingMode === 'continuous-rtl'

  const isDoublePage = readingMode === 'paged-double-ltr' || readingMode === 'paged-double-rtl'
  const activePageDimensions = activeChapter ? pageDimensionsByChapter[activeChapter.id] : undefined

  const savePageProgress = useCallback(
    (chapterId: string, page: number, chapterNumber?: number | string) => {
      if (!selectedManga) return
      if (progressDebounceRef.current) {
        clearTimeout(progressDebounceRef.current)
      }
      progressDebounceRef.current = setTimeout(() => {
        const targetChapter =
          loadedChapters.find((c) => c.id === chapterId) ||
          chapters.find((c) => c.id === chapterId) ||
          (activeChapter?.id === chapterId ? activeChapter : null)
        const rawNum = chapterNumber !== undefined ? chapterNumber : targetChapter?.number
        const chNum = rawNum !== undefined ? Number(rawNum) : Number(activeChapter?.number)

        const chapterTotal =
          chapterPageCounts[chapterId] || (chapterId === activeChapter?.id ? totalPages : 0)
        const slotReachedEnd =
          isDoublePage && chapterTotal > 0
            ? getDoublePageSlot(
                chapterTotal,
                page,
                pageDimensionsByChapter[chapterId]
              ).pages.includes(chapterTotal)
            : false
        const reachedEnd = chapterTotal > 0 && (page >= chapterTotal || slotReachedEnd)
        if (reachedEnd) {
          sessionCompletedChaptersRef.current.add(chapterId)
        }

        const isReadAlready = readingProgress[selectedManga.id]?.includes(chapterId) || false
        const isRead = isReadAlready || (autoMarkRead && reachedEnd)
        markChapterRead(
          selectedManga.id,
          chapterId,
          isRead,
          page,
          !isNaN(chNum) ? chNum : undefined
        )
      }, 400)
    },
    [
      selectedManga,
      readingProgress,
      markChapterRead,
      loadedChapters,
      chapters,
      activeChapter,
      chapterPageCounts,
      totalPages,
      isDoublePage,
      pageDimensionsByChapter,
      autoMarkRead
    ]
  )

  const handlePageDimensions = useCallback(
    (chapterId: string, pageNumber: number, dimensions: PageDimensions) => {
      if (dimensions.width <= 0 || dimensions.height <= 0) return
      setPageDimensionsByChapter((prev) => {
        const existingChapter = prev[chapterId]
        const existingPage = existingChapter?.[pageNumber]
        if (
          existingPage &&
          existingPage.width === dimensions.width &&
          existingPage.height === dimensions.height
        ) {
          return prev
        }
        return {
          ...prev,
          [chapterId]: {
            ...existingChapter,
            [pageNumber]: dimensions
          }
        }
      })
    },
    []
  )

  const pagedNext = useCallback(() => {
    if (!activeChapter) return
    setCurrentPage((prev) => {
      const next = isDoublePage
        ? getNextDoublePage(totalPages, prev, activePageDimensions)
        : Math.min(totalPages, prev + 1)
      if (next !== prev) savePageProgress(activeChapter.id, next, activeChapter.number)
      return next
    })
  }, [activeChapter, isDoublePage, totalPages, activePageDimensions, savePageProgress])

  const pagedPrev = useCallback(() => {
    if (!activeChapter) return
    setCurrentPage((prev) => {
      const next = isDoublePage
        ? getPrevDoublePage(totalPages, prev, activePageDimensions)
        : Math.max(1, prev - 1)
      if (next !== prev) savePageProgress(activeChapter.id, next, activeChapter.number)
      return next
    })
  }, [activeChapter, isDoublePage, totalPages, activePageDimensions, savePageProgress])

  // --- Extracted Hooks ---
  const { isKbdPaused, isKbdReversing, isKbdBoosted, isKbdSlowed } = useKeyboardControls(
    autoScrollEnabled,
    setAutoScrollEnabled,
    autoScrollShortcuts,
    {
      readingMode,
      onNextPage: pagedNext,
      onPrevPage: pagedPrev,
      onToggleZenMode: toggleZenMode,
      onNextChapter: () => nextChapter && goToChapter(nextChapter),
      onPrevChapter: () => prevChapter && goToChapter(prevChapter)
    }
  )

  const { isDragging, dragMoved, ...dragHandlers } = useDragToScroll(
    scrollRef,
    dragToScroll,
    isHorizontalContinuous
  )

  useAutoScroll(
    scrollRef,
    autoScrollEnabled,
    autoScrollSpeed,
    isInfiniteScroll,
    isDragging,
    isKbdPaused,
    isKbdReversing,
    isKbdBoosted,
    isKbdSlowed,
    isHorizontalContinuous,
    readingMode === 'continuous-rtl'
  )

  const { zoomLevel, resetZoom } = useZoom(scrollRef)

  // --- Helpers ---
  const extensionName = useMemo(() => {
    const ext = installedExtensions.find((e) => e.pkg === resolvedPkg)
    return ext?.name || resolvedPkg || 'Source'
  }, [resolvedPkg, installedExtensions])

  const syncSmartDownloads = useCallback(
    async (currentChapterId: string | null) => {
      if (!smartDownloadsEnabled || !selectedManga || !resolvedPkg || sortedChapters.length === 0) {
        return
      }

      try {
        const downloads = await DataService.download.getMangaDownloads(selectedManga.id)
        const downloadEntries = Array.isArray(downloads) ? downloads : []

        const downloadedSet = new Set<string>(smartQueuedChaptersRef.current)
        const deletableSet = new Set<string>()
        for (const entry of downloadEntries) {
          if (
            entry.status === 'completed' ||
            entry.status === 'downloading' ||
            entry.status === 'queued'
          ) {
            downloadedSet.add(entry.chapterId)
            deletableSet.add(entry.chapterId)
          }
        }

        const dlStore = useDownloadStore.getState()
        for (const queued of dlStore.downloadQueue) {
          if (queued.mangaId === selectedManga.id) {
            downloadedSet.add(queued.chapter.id)
          }
        }
        for (const task of Object.values(dlStore.activeTasks)) {
          if (
            task.mangaId === selectedManga.id &&
            (task.status === 'downloading' || task.status === 'completed')
          ) {
            downloadedSet.add(task.chapterId)
            deletableSet.add(task.chapterId)
          }
        }

        const completedSet = new Set<string>([
          ...(readingProgress[selectedManga.id] || []),
          ...sessionCompletedChaptersRef.current
        ])

        const plan = computeSmartDownloadPlan({
          enabled: true,
          chapters: sortedChapters,
          currentChapterId,
          completedChapterIds: completedSet,
          downloadedChapterIds: downloadedSet,
          deletableDownloadChapterIds: deletableSet
        })

        for (const chId of plan.chapterIdsToDelete) {
          smartQueuedChaptersRef.current.delete(chId)
          dlStore.removeFromDownloadQueue(chId)
          dlStore.removeActiveTask(selectedManga.id, chId)
          await DataService.download
            .remove({ mangaId: selectedManga.id, chapterId: chId })
            .catch(() => {})
        }

        if (plan.chaptersToDownload.length > 0 && currentChapterId) {
          const itemsToQueue = plan.chaptersToDownload.map((ch) => {
            smartQueuedChaptersRef.current.add(ch.id)
            return {
              mangaId: selectedManga.id,
              mangaTitle: selectedManga.title,
              chapter: ch,
              extension: resolvedPkg,
              extensionName,
              type: 'manga' as const
            }
          })
          dlStore.addToDownloadQueue(itemsToQueue)
        }
      } catch (err) {
        console.error('[SmartDownloads] Failed to sync downloads:', err)
      }
    },
    [
      smartDownloadsEnabled,
      selectedManga,
      resolvedPkg,
      sortedChapters,
      readingProgress,
      extensionName
    ]
  )

  useEffect(() => {
    sessionCompletedChaptersRef.current = new Set()
    smartQueuedChaptersRef.current = new Set()
  }, [selectedManga?.id])

  useEffect(() => {
    if (!smartDownloadsEnabled || !activeChapter?.id || sortedChapters.length === 0) return
    void syncSmartDownloads(activeChapter.id)
  }, [smartDownloadsEnabled, activeChapter?.id, sortedChapters.length, syncSmartDownloads])

  smartSyncCleanupRef.current = () => {
    if (sessionCompletedChaptersRef.current.size > 0) {
      void syncSmartDownloads(null)
    }
  }

  useEffect(() => {
    return () => {
      smartSyncCleanupRef.current?.()
    }
  }, [])

  const activeChapterId = activeChapter?.id
  const activeChapterNumber = activeChapter?.number
  const activeChapterTitle = activeChapter?.title

  useEffect(() => {
    if (!discordRpcEnabled || !selectedManga || !activeChapterId) return
    const timer = setTimeout(() => {
      void DataService.discord
        .setActivity({
          kind: 'manga',
          title: selectedManga.title,
          chapterOrEpisode: activeChapterNumber,
          chapterTitle: activeChapterTitle,
          coverUrl: selectedManga.coverUrl,
          page: currentPage,
          totalPages
        })
        .catch(() => {})
    }, 400)
    return () => clearTimeout(timer)
  }, [
    discordRpcEnabled,
    selectedManga,
    activeChapterId,
    activeChapterNumber,
    activeChapterTitle,
    currentPage,
    totalPages
  ])

  useEffect(() => {
    return () => {
      void DataService.discord.clear().catch(() => {})
    }
  }, [])

  const openInBrowser = useCallback(() => {
    if (activeChapter?.url) DataService.openExternal(activeChapter.url)
  }, [activeChapter?.url])

  const eyeCareOverlay = useMemo(
    () =>
      computeEyeCareOverlay(
        {
          enabled: eyeCareEnabled,
          tint: eyeCareTint,
          warmth: eyeCareWarmth,
          dimming: eyeCareDimming
        },
        'multiply'
      ),
    [eyeCareEnabled, eyeCareTint, eyeCareWarmth, eyeCareDimming]
  )

  const handleToggleEyeCare = useCallback(() => {
    void setEyeCareEnabled(!eyeCareEnabled)
  }, [eyeCareEnabled, setEyeCareEnabled])

  const handleChangeEyeCareWarmth = useCallback(
    (warmth: number) => {
      if (!eyeCareEnabled) void setEyeCareEnabled(true)
      void setEyeCareWarmth(warmth)
    },
    [eyeCareEnabled, setEyeCareEnabled, setEyeCareWarmth]
  )

  const handleChangeEyeCareDimming = useCallback(
    (dimming: number) => {
      if (!eyeCareEnabled) void setEyeCareEnabled(true)
      void setEyeCareDimming(dimming)
    },
    [eyeCareEnabled, setEyeCareEnabled, setEyeCareDimming]
  )

  const handleApplyEyeCarePreset = useCallback(
    (preset: EyeCareTintPreset) => {
      if (!preset || !(preset in EYE_CARE_PRESETS)) return
      void applyEyeCarePreset(preset)
    },
    [applyEyeCarePreset]
  )

  const handleVisible = useCallback(
    (chapter: Chapter) => {
      if (lastSyncId.current === chapter.id) return
      lastSyncId.current = chapter.id
      if (activeChapter?.id !== chapter.id) {
        setActiveChapter(chapter)
      }

      const count = chapterPageCounts[chapter.id] || 0
      if (count > 0) {
        setTotalPages(count)
      }

      const targetPage = visiblePagesRef.current[chapter.id] || 1
      setCurrentPage(targetPage)
      savePageProgress(chapter.id, targetPage, chapter.number)

      if (selectedManga) {
        // Finalize previous chapter reading session if switching chapters
        if (
          activeSessionRef.current &&
          (activeSessionRef.current.mangaId !== selectedManga.id ||
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
          mangaId: selectedManga.id,
          chapterId: chapter.id,
          startTime: Date.now()
        }

        const savedPage = pageProgress[selectedManga.id]?.[chapter.id] || targetPage
        const isReadAlready = readingProgress[selectedManga.id]?.includes(chapter.id) || false
        markChapterRead(
          selectedManga.id,
          chapter.id,
          isReadAlready,
          savedPage,
          Number(chapter.number) || undefined
        )
        addHistoryEntry({
          mangaId: selectedManga.id,
          mangaTitle: selectedManga.title,
          mangaCover: selectedManga.coverUrl || undefined,
          mangaUrl: selectedManga.url || undefined,
          chapterId: chapter.id,
          chapterTitle: chapter.title || undefined,
          startedAt: new Date().toISOString(),
          durationSeconds: 0,
          pkg: resolvedPkg || undefined,
          type: 'manga'
        }).then(() => {
          queryClient.invalidateQueries({ queryKey: mediaKeys.history() })
        })
      }
    },
    [
      activeChapter?.id,
      setActiveChapter,
      chapterPageCounts,
      savePageProgress,
      selectedManga,
      updateHistoryDuration,
      pageProgress,
      readingProgress,
      markChapterRead,
      addHistoryEntry,
      resolvedPkg,
      queryClient
    ]
  )

  const handlePageVisible = useCallback(
    (chapterId: string, page: number) => {
      visiblePagesRef.current[chapterId] = page

      if (lastSyncId.current !== chapterId) {
        const targetChapter =
          loadedChapters.find((c) => c.id === chapterId) || chapters.find((c) => c.id === chapterId)
        if (targetChapter) {
          handleVisible(targetChapter)
        }
      }

      if (activeChapter?.id === chapterId || lastSyncId.current === chapterId) {
        setCurrentPage((prev) => {
          if (prev !== page) {
            savePageProgress(chapterId, page)
            return page
          }
          return prev
        })
      }
    },
    [activeChapter?.id, loadedChapters, chapters, handleVisible, savePageProgress]
  )

  const handleLoaded = useCallback(
    (chapterId: string, count: number) => {
      setChapterPageCounts((prev) => {
        if (prev[chapterId] === count) return prev
        return { ...prev, [chapterId]: count }
      })
      if (activeChapter?.id === chapterId || lastSyncId.current === chapterId) {
        setTotalPages(count)
        if (pendingScrollPage.current) {
          const targetPage = pendingScrollPage.current
          pendingScrollPage.current = null
          setTimeout(() => {
            if (isVertical || isHorizontalContinuous) {
              const safeId =
                typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(chapterId) : chapterId
              const pageEl = scrollRef.current?.querySelector(
                `[data-chapter-id="${safeId}"] [data-page-index="${targetPage - 1}"]`
              )
              if (pageEl) {
                pageEl.scrollIntoView({ behavior: 'auto', block: 'start' })
              }
            }
          }, 150)
        }
      }
    },
    [activeChapter?.id, isVertical, isHorizontalContinuous]
  )

  useEffect(() => {
    if (activeChapter && !loadedChapters.find((c) => c.id === activeChapter.id)) {
      setLoadedChapters([activeChapter])
      lastSyncId.current = activeChapter.id

      const savedPage = (selectedManga && pageProgress[selectedManga.id]?.[activeChapter.id]) || 1
      setCurrentPage(savedPage)

      if (savedPage > 1) {
        pendingScrollPage.current = savedPage
      } else {
        if (scrollRef.current) scrollRef.current.scrollTop = 0
      }
    }
  }, [activeChapter?.id])

  useEffect(() => {
    if (activeChapter?.id) {
      const count = chapterPageCounts[activeChapter.id] || 0
      if (count > 0) {
        setTotalPages(count)
      }
    }
  }, [activeChapter?.id, chapterPageCounts])

  const findNextChapter = useCallback(
    (current: Chapter) => {
      const idx = sortedChapters.findIndex((c) => c.id === current.id)
      return idx !== -1 && idx + 1 < sortedChapters.length ? sortedChapters[idx + 1] : null
    },
    [sortedChapters]
  )

  const handleHalfway = useCallback(
    (chapter: Chapter) => {
      if (!isInfiniteScroll) return
      const next = findNextChapter(chapter)
      if (next) {
        setLoadedChapters((prev) => {
          if (prev.find((c) => c.id === next.id)) return prev
          return [...prev, next]
        })
      }
    },
    [isInfiniteScroll, findNextChapter]
  )

  if (!activeChapter || !selectedManga || !resolvedPkg) return null

  const readerBg =
    readerTheme === 'match-app'
      ? 'bg-background text-foreground'
      : readerTheme === 'light'
        ? 'bg-[#f8f9fa] text-slate-900'
        : 'bg-neutral-950 text-neutral-300'

  return (
    <div
      className={cn(
        'fixed inset-0 z-[100] flex flex-col overflow-hidden animate-in fade-in duration-300',
        mobile && 'pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]',
        readerBg
      )}
    >
      <div
        className={cn(
          'transition-all duration-300 ease-in-out z-40',
          isZenMode
            ? cn(
                'fixed top-0 left-0 right-0 shadow-2xl',
                isTopHovered
                  ? 'translate-y-0 opacity-100 pointer-events-auto'
                  : '-translate-y-full opacity-0 pointer-events-none'
              )
            : 'relative flex-shrink-0'
        )}
      >
        <ReaderToolbar
          chapterNumber={activeChapter.number}
          chapterTitle={activeChapter.title}
          extensionName={extensionName}
          chapterUrl={activeChapter.url}
          currentPage={currentPage}
          totalPages={totalPages}
          isInfiniteScroll={isInfiniteScroll}
          autoScrollEnabled={autoScrollEnabled}
          autoScrollSpeed={autoScrollSpeed}
          isKbdPaused={isKbdPaused}
          dragToScroll={dragToScroll}
          readingMode={readingMode}
          onReadingModeChange={setReadingMode}
          readerTheme={readerTheme}
          cropBorders={cropBorders}
          zoomLevel={zoomLevel}
          isZenMode={isZenMode}
          eyeCareEnabled={eyeCareEnabled}
          eyeCareTint={eyeCareTint}
          eyeCareWarmth={eyeCareWarmth}
          eyeCareDimming={eyeCareDimming}
          onToggleEyeCare={handleToggleEyeCare}
          onApplyEyeCarePreset={handleApplyEyeCarePreset}
          onChangeEyeCareWarmth={handleChangeEyeCareWarmth}
          onChangeEyeCareDimming={handleChangeEyeCareDimming}
          chapters={sortedChapters}
          activeChapterId={activeChapter.id}
          hasPrevChapter={prevChapter !== null}
          hasNextChapter={nextChapter !== null}
          onPrevChapter={() => prevChapter && goToChapter(prevChapter)}
          onNextChapter={() => nextChapter && goToChapter(nextChapter)}
          onSelectChapter={(chapterId) => {
            const ch = sortedChapters.find((c) => c.id === chapterId)
            if (ch) goToChapter(ch)
          }}
          onToggleZenMode={toggleZenMode}
          onResetZoom={resetZoom}
          onToggleCropBorders={() => setCropBorders(!cropBorders)}
          onClose={() => setActiveChapter(null)}
          onOpenInBrowser={openInBrowser}
          onToggleAutoScroll={() => setAutoScrollEnabled(!autoScrollEnabled)}
          onChangeAutoScrollSpeed={setAutoScrollSpeed}
          onShare={() => setShowShareModal(true)}
        />
      </div>

      {zenToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[120] bg-neutral-900/95 backdrop-blur-xl border border-primary/40 px-4 py-2 rounded-full text-xs font-bold text-primary shadow-2xl animate-in fade-in slide-in-from-top-2 duration-300 pointer-events-none select-none">
          {zenToast}
        </div>
      )}

      <div className="flex-1 relative flex flex-col min-h-0 overflow-hidden">
        <div
          ref={(el) => {
            // @ts-ignore - assigned to both ref and state
            scrollRef.current = el
            setScrollEl(el)
          }}
          tabIndex={0}
          onDoubleClick={(e) => {
            const target = e.target as HTMLElement | null
            if (
              target?.closest('button') ||
              target?.closest('input') ||
              target?.closest('select') ||
              target?.closest('a')
            ) {
              return
            }
            toggleZenMode()
          }}
          {...dragHandlers}
          className={cn(
            'flex-1 relative outline-none overscroll-contain no-scrollbar',
            isVertical ? 'overflow-y-auto' : 'overflow-hidden',

            isHorizontalContinuous && 'overflow-x-auto overflow-y-hidden flex flex-row',
            dragToScroll && (isDragging ? 'cursor-grabbing' : 'cursor-grab'),
            dragToScroll && 'select-none'
          )}
        >
          <div
            className={cn(
              'flex',
              isHorizontalContinuous
                ? readingMode === 'continuous-rtl'
                  ? 'flex-row-reverse w-max h-full'
                  : 'flex-row w-max h-full'
                : 'flex-col w-full'
            )}
          >
            {loadedChapters.map((chapter) => (
              <ChapterSection
                key={chapter.id}
                chapter={chapter}
                mangaId={selectedManga.id}
                pkg={resolvedPkg}
                readingMode={readingMode}
                readerTheme={readerTheme}
                cropBorders={cropBorders}
                onHalfway={handleHalfway}
                onVisible={handleVisible}
                onLoaded={handleLoaded}
                onPageVisible={handlePageVisible}
                currentPage={currentPage}
                onNextPage={pagedNext}
                onPrevPage={pagedPrev}
                isDragging={isDragging}
                dragMoved={dragMoved.current}
                scrollRoot={scrollEl}
                zoomLevel={zoomLevel}
                pageDimensions={pageDimensionsByChapter[chapter.id]}
                onPageDimensions={handlePageDimensions}
              />
            ))}

            {isInfiniteScroll && (
              <div className="w-full max-w-lg py-40 px-6 flex flex-col items-center text-center gap-6 mx-auto">
                <div className="h-px w-full bg-gradient-to-r from-transparent via-neutral-800 to-transparent opacity-20" />
                <div className="space-y-1">
                  <p className="text-xl font-bold bg-gradient-to-r from-neutral-100 to-neutral-400 bg-clip-text text-transparent">
                    End of Stream
                  </p>
                  <p className="text-xs text-neutral-500 font-medium tracking-wide">
                    Return or browse more chapters.
                  </p>
                </div>
                <Button
                  onClick={() => setActiveChapter(null)}
                  variant="outline"
                  className="rounded-full px-8 border-neutral-800 text-neutral-400 hover:bg-neutral-900 shadow-xl"
                >
                  Back to Library
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Night Eye-Care Filter Overlay (Warm/Sepia tint + custom dimming without changing OS brightness) */}
        {eyeCareOverlay.active && (
          <>
            {eyeCareOverlay.tintBackgroundColor && (
              <div
                aria-hidden="true"
                data-testid="eye-care-tint-overlay"
                className="absolute inset-0 pointer-events-none z-30 transition-colors duration-200"
                style={{
                  backgroundColor: eyeCareOverlay.tintBackgroundColor,
                  mixBlendMode: 'multiply'
                }}
              />
            )}
            {eyeCareOverlay.dimBackgroundColor && (
              <div
                aria-hidden="true"
                data-testid="eye-care-dim-overlay"
                className="absolute inset-0 pointer-events-none z-30 transition-colors duration-200"
                style={{ backgroundColor: eyeCareOverlay.dimBackgroundColor }}
              />
            )}
          </>
        )}
      </div>

      {totalPages > 0 && (
        <div
          className="fixed bottom-0 left-0 right-0 h-2 hover:h-2.5 bg-neutral-950/60 backdrop-blur-sm z-[110] cursor-pointer group transition-all"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const x = e.clientX - rect.left
            const isRtl =
              readingMode === 'paged-rtl' ||
              readingMode === 'continuous-rtl' ||
              readingMode === 'paged-double-rtl'
            const ratio = isRtl ? 1 - x / rect.width : x / rect.width
            const hoverPage = Math.max(1, Math.min(totalPages, Math.ceil(ratio * totalPages)))
            setScrubberHover({ x, page: hoverPage })
          }}
          onMouseLeave={() => setScrubberHover(null)}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const x = e.clientX - rect.left
            const isRtl =
              readingMode === 'paged-rtl' ||
              readingMode === 'continuous-rtl' ||
              readingMode === 'paged-double-rtl'
            const ratio = isRtl ? 1 - x / rect.width : x / rect.width
            const targetPage = Math.max(1, Math.min(totalPages, Math.ceil(ratio * totalPages)))

            if (isVertical || isHorizontalContinuous) {
              const safeId = activeChapter?.id
                ? typeof CSS !== 'undefined' && CSS.escape
                  ? CSS.escape(activeChapter.id)
                  : activeChapter.id
                : ''
              const chapterSelector = safeId ? `[data-chapter-id="${safeId}"] ` : ''
              const pageEl = scrollRef.current?.querySelector(
                `${chapterSelector}[data-page-index="${targetPage - 1}"]`
              )
              if (pageEl) {
                pageEl.scrollIntoView({ behavior: 'smooth' })
              }
            } else {
              setCurrentPage(targetPage)
              if (activeChapter) {
                savePageProgress(activeChapter.id, targetPage, activeChapter.number)
              }
            }
          }}
          title="Seek Page"
        >
          <div
            className={cn(
              'absolute top-0 bottom-0 bg-primary transition-all duration-150 shadow-[0_0_15px_rgba(var(--primary),0.6)]',
              readingMode === 'paged-rtl' ||
                readingMode === 'continuous-rtl' ||
                readingMode === 'paged-double-rtl'
                ? 'right-0'
                : 'left-0'
            )}
            style={{ width: `${(currentPage / totalPages) * 100}%` }}
          />

          {/* Floating Glassmorphism Tooltip on Hover */}
          {scrubberHover && (
            <div
              className="absolute bottom-full mb-3 -translate-x-1/2 pointer-events-none transition-transform z-30 animate-in fade-in zoom-in-95 duration-150"
              style={{ left: `${scrubberHover.x}px` }}
            >
              <div className="bg-neutral-900/90 backdrop-blur-xl border border-white/15 px-3 py-1.5 rounded-xl text-xs font-mono font-bold text-white shadow-2xl shadow-black/80 flex items-center gap-1.5 whitespace-nowrap">
                <span className="text-primary font-black">PAGE</span>
                <span>{scrubberHover.page}</span>
                <span className="text-neutral-500 font-normal">/</span>
                <span className="text-neutral-400 font-normal">{totalPages}</span>
              </div>
              <div className="w-2 h-2 bg-neutral-900/90 border-r border-b border-white/15 rotate-45 mx-auto -mt-1" />
            </div>
          )}
        </div>
      )}

      <ShareProgressModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        mangaTitle={selectedManga?.title || ''}
        chapterNumber={activeChapter.number}
        chapterTitle={activeChapter.title}
        currentPage={currentPage}
        totalPages={totalPages}
        chapterUrl={activeChapter.url || ''}
        readerTheme={readerTheme}
      />
    </div>
  )
}
