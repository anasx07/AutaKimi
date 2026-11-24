import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import {
  useLibraryStore,
  useReaderStore,
  useHistoryStore,
  useProgressStore,
  useExtensionStore
} from '@renderer/shared/model'
import { Button } from '@renderer/shared/ui'
import { cn } from '@renderer/shared/lib/utils'
import { isMobile } from '@renderer/shared/platform'
import { useMediaItems, mediaKeys, usePrefetchNextChapter } from '@renderer/entities/media/api/useMediaQueries'
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

export default function ChapterReader() {
  const mobile = isMobile()
  const { activeChapter, setActiveChapter, selectedManga } = useLibraryStore()
  const { activeExtension, installedExtensions } = useExtensionStore()
  const { addHistoryEntry, updateHistoryDuration } = useHistoryStore()
  const { markChapterRead, pageProgress, readingProgress } = useProgressStore()
  const queryClient = useQueryClient()

  const {
    readingMode,
    dragToScroll,
    autoScrollEnabled,
    setAutoScrollEnabled,
    autoScrollSpeed,
    setAutoScrollSpeed,
    autoScrollShortcuts,
    setReadingMode,
    readerTheme,
    cropBorders,
    setCropBorders
  } = useReaderStore()

  // --- State & Refs ---
  const [loadedChapters, setLoadedChapters] = useState<Chapter[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [chapterPageCounts, setChapterPageCounts] = useState<Record<string, number>>({})
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null)
  const [showShareModal, setShowShareModal] = useState(false)
  const [scrubberHover, setScrubberHover] = useState<{ x: number; page: number } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pendingScrollPage = useRef<number | null>(null)
  const lastSyncId = useRef<string | null>(null)
  const visiblePagesRef = useRef<Record<string, number>>({})
  const progressDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeSessionRef = useRef<{ mangaId: string; chapterId: string; startTime: number } | null>(null)

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

  usePrefetchNextChapter(
    selectedManga?.id || '',
    resolvedPkg,
    chapters,
    activeChapter
  )

  const isInfiniteScroll = readingMode === 'webtoon' || readingMode === 'continuous-vertical'
  const isVertical = isInfiniteScroll || readingMode === 'paged-vertical'
  const isHorizontalContinuous =
    readingMode === 'continuous-ltr' || readingMode === 'continuous-rtl'

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

        const isReadAlready = readingProgress[selectedManga.id]?.includes(chapterId) || false
        markChapterRead(
          selectedManga.id,
          chapterId,
          isReadAlready,
          page,
          !isNaN(chNum) ? chNum : undefined
        )
      }, 400)
    },
    [selectedManga, readingProgress, markChapterRead, loadedChapters, chapters, activeChapter]
  )

  const isDoublePage = readingMode === 'paged-double-ltr' || readingMode === 'paged-double-rtl'

  const pagedNext = useCallback(() => {
    if (!activeChapter) return
    setCurrentPage((prev) => {
      const step = isDoublePage ? (prev === 1 ? 1 : 2) : 1
      const next = Math.min(totalPages, prev + step)
      if (next !== prev) savePageProgress(activeChapter.id, next, activeChapter.number)
      return next
    })
  }, [activeChapter, isDoublePage, totalPages, savePageProgress])

  const pagedPrev = useCallback(() => {
    if (!activeChapter) return
    setCurrentPage((prev) => {
      const step = isDoublePage ? (prev <= 2 ? 1 : 2) : 1
      const next = Math.max(1, prev - step)
      if (next !== prev) savePageProgress(activeChapter.id, next, activeChapter.number)
      return next
    })
  }, [activeChapter, isDoublePage, savePageProgress])

  // --- Extracted Hooks ---
  const { isKbdPaused, isKbdReversing, isKbdBoosted, isKbdSlowed } = useKeyboardControls(
    autoScrollEnabled,
    setAutoScrollEnabled,
    autoScrollShortcuts,
    {
      readingMode,
      onNextPage: pagedNext,
      onPrevPage: pagedPrev
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

  const openInBrowser = useCallback(() => {
    if (activeChapter?.url) DataService.openExternal(activeChapter.url)
  }, [activeChapter?.url])

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
          loadedChapters.find((c) => c.id === chapterId) ||
          chapters.find((c) => c.id === chapterId)
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

  const findNextChapter = useCallback((current: Chapter) => {
    if (chapters.length === 0) return null
    const sorted = [...chapters].sort((a, b) => {
      const getNum = (c: any) => {
        if (typeof c.number === 'number') return c.number
        const str = String(c.number || '').replace(/[^0-9.]/g, '')
        const parsed = parseFloat(str)
        return isNaN(parsed) ? 0 : parsed
      }
      return getNum(a) - getNum(b)
    })
    const idx = sorted.findIndex((c) => c.id === current.id)
    return idx !== -1 && idx + 1 < sorted.length ? sorted[idx + 1] : null
  }, [chapters])

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
        onResetZoom={resetZoom}
        onToggleCropBorders={() => setCropBorders(!cropBorders)}
        onClose={() => setActiveChapter(null)}
        onOpenInBrowser={openInBrowser}
        onToggleAutoScroll={() => setAutoScrollEnabled(!autoScrollEnabled)}
        onChangeAutoScrollSpeed={setAutoScrollSpeed}
        onShare={() => setShowShareModal(true)}
      />

      <div
        ref={(el) => {
          // @ts-ignore - assigned to both ref and state
          scrollRef.current = el
          setScrollEl(el)
        }}
        tabIndex={0}
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

      {totalPages > 0 && (
        <div
          className="fixed bottom-0 left-0 right-0 h-2 hover:h-2.5 bg-neutral-950/60 backdrop-blur-sm z-[110] cursor-pointer group transition-all"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const x = e.clientX - rect.left
            const isRtl = readingMode === 'paged-rtl' || readingMode === 'continuous-rtl' || readingMode === 'paged-double-rtl'
            const ratio = isRtl ? 1 - x / rect.width : x / rect.width
            const hoverPage = Math.max(1, Math.min(totalPages, Math.ceil(ratio * totalPages)))
            setScrubberHover({ x, page: hoverPage })
          }}
          onMouseLeave={() => setScrubberHover(null)}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const x = e.clientX - rect.left
            const isRtl = readingMode === 'paged-rtl' || readingMode === 'continuous-rtl' || readingMode === 'paged-double-rtl'
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
            }
          }}
          title="Seek Page"
        >
          <div
            className={cn(
              'absolute top-0 bottom-0 bg-primary transition-all duration-150 shadow-[0_0_15px_rgba(var(--primary),0.6)]',
              readingMode === 'paged-rtl' || readingMode === 'continuous-rtl' || readingMode === 'paged-double-rtl' ? 'right-0' : 'left-0'
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
