import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { TitleBar } from '@renderer/widgets/title-bar'
import { 
  useLibraryStore, 
  useReaderStore, 
  useHistoryStore, 
  useProgressStore,
  useExtensionStore
} from '@renderer/shared/model'
import { Button } from '@renderer/shared/ui'
import { cn } from '@renderer/shared/lib/utils'
import { useMangaChapters, mangaKeys } from '@renderer/entities/manga/api/useMangaQueries'
import { useQueryClient } from '@tanstack/react-query'
import { DataService } from '@renderer/shared/api'
import { Chapter } from '@renderer/shared/api/sources/types'

// Extracted Components
import { ReaderToolbar } from './components/ReaderToolbar'
import { ChapterSection } from './components/ChapterSection'

// Extracted Hooks
import { useKeyboardControls } from './hooks/useKeyboardControls'
import { useAutoScroll } from './hooks/useAutoScroll'
import { useDragToScroll } from './hooks/useDragToScroll'
import { useZoom } from './hooks/useZoom'

export default function ChapterReader() {
  const { activeChapter, setActiveChapter, selectedManga } = useLibraryStore()
  const { activeExtension, installedExtensions } = useExtensionStore()
  const { addHistoryEntry } = useHistoryStore()
  const { markChapterRead, pageProgress, readingProgress } = useProgressStore()
  const queryClient = useQueryClient()
  
  const { 
    readingMode, dragToScroll, 
    autoScrollEnabled, setAutoScrollEnabled, 
    autoScrollSpeed, setAutoScrollSpeed,
    autoScrollShortcuts,
    setReadingMode,
    readerTheme
  } = useReaderStore()

  // --- State & Refs ---
  const [loadedChapters, setLoadedChapters] = useState<Chapter[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [chapterPageCounts, setChapterPageCounts] = useState<Record<string, number>>({})
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pendingScrollPage = useRef<number | null>(null)
  const lastSyncId = useRef<string | null>(null)
  const visiblePagesRef = useRef<Record<string, number>>({})

  const resolvedPkg = selectedManga?.pkg || activeExtension || ''

  const { data: chapters = [] } = useMangaChapters(
    selectedManga?.id || '', 
    resolvedPkg, 
    selectedManga?.url
  )

  const isInfiniteScroll = readingMode === 'webtoon' || readingMode === 'continuous-vertical'
  const isVertical = isInfiniteScroll || readingMode === 'paged-vertical'
  const isHorizontalContinuous = readingMode === 'continuous-ltr' || readingMode === 'continuous-rtl'

  // --- Extracted Hooks ---
  const { 
    isKbdPaused, isKbdReversing, isKbdBoosted, isKbdSlowed 
  } = useKeyboardControls(autoScrollEnabled, setAutoScrollEnabled, autoScrollShortcuts)

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

  const { zoomLevel } = useZoom(scrollRef)

  // --- Helpers ---
  const extensionName = useMemo(() => {
    const ext = installedExtensions.find(e => e.pkg === resolvedPkg)
    return ext?.name || resolvedPkg || 'Source'
  }, [resolvedPkg, installedExtensions])

  const openInBrowser = useCallback(() => {
    if (activeChapter?.url) DataService.openExternal(activeChapter.url)
  }, [activeChapter?.url])

  const savePageProgress = useCallback((chapterId: string, page: number) => {
    if (!selectedManga) return
    const isReadAlready = readingProgress[selectedManga.id]?.includes(chapterId) || false
    markChapterRead(selectedManga.id, chapterId, isReadAlready, page)
  }, [selectedManga?.id, readingProgress, markChapterRead])

  const handlePageVisible = useCallback((chapterId: string, page: number) => {
    visiblePagesRef.current[chapterId] = page

    if (activeChapter?.id === chapterId || lastSyncId.current === chapterId) {
      setCurrentPage((prev) => {
        if (prev !== page) {
          savePageProgress(chapterId, page)
          return page
        }
        return prev
      })
    }
  }, [activeChapter?.id, savePageProgress])

  const handleLoaded = useCallback((chapterId: string, count: number) => {
    setChapterPageCounts(prev => {
      if (prev[chapterId] === count) return prev
      return { ...prev, [chapterId]: count }
    })
    if (activeChapter?.id === chapterId) {
      setTotalPages(count)
      if (pendingScrollPage.current) {
        const targetPage = pendingScrollPage.current
        pendingScrollPage.current = null
        setTimeout(() => {
          if (isVertical || isHorizontalContinuous) {
            const pageEl = scrollRef.current?.querySelector(`[data-page-index="${targetPage - 1}"]`)
            if (pageEl) {
               pageEl.scrollIntoView({ behavior: 'auto', block: 'start' })
            }
          }
        }, 150)
      }
    }
  }, [activeChapter?.id, isVertical, isHorizontalContinuous])

  useEffect(() => {
    if (activeChapter && !loadedChapters.find(c => c.id === activeChapter.id)) {
      setLoadedChapters([activeChapter])
      
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
      setTotalPages(count)
    }
  }, [activeChapter?.id, chapterPageCounts])

  const findNextChapter = (current: Chapter) => {
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
    const idx = sorted.findIndex(c => c.id === current.id)
    return idx !== -1 && idx + 1 < sorted.length ? sorted[idx + 1] : null
  }

  const handleHalfway = (chapter: Chapter) => {
    if (!isInfiniteScroll) return
    const next = findNextChapter(chapter)
    if (next && !loadedChapters.find(c => c.id === next.id)) {
      setLoadedChapters(prev => [...prev, next])
    }
  }

  const handleVisible = (chapter: Chapter) => {
    if (lastSyncId.current === chapter.id) return
    lastSyncId.current = chapter.id
    if (activeChapter?.id !== chapter.id) {
      setActiveChapter(chapter)
    }

    const queuedPage = visiblePagesRef.current[chapter.id]
    if (queuedPage) {
      setCurrentPage(queuedPage)
      savePageProgress(chapter.id, queuedPage)
    }

    if (selectedManga) {
       const savedPage = pageProgress[selectedManga.id]?.[chapter.id] || 1
       const isReadAlready = readingProgress[selectedManga.id]?.includes(chapter.id) || false
       markChapterRead(selectedManga.id, chapter.id, isReadAlready, savedPage)
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
         queryClient.invalidateQueries({ queryKey: mangaKeys.history() })
       })
    }
  }

  const pagedNext = () => {
    if (!activeChapter) return
    setCurrentPage(prev => {
      const next = Math.min(totalPages, prev + 1)
      if (next !== prev) savePageProgress(activeChapter.id, next)
      return next
    })
  }

  const pagedPrev = () => {
    if (!activeChapter) return
    setCurrentPage(prev => {
      const next = Math.max(1, prev - 1)
      if (next !== prev) savePageProgress(activeChapter.id, next)
      return next
    })
  }

  if (!activeChapter || !selectedManga || !resolvedPkg) return null

  const readerBg = readerTheme === 'match-app' ? "bg-background text-foreground" :
    readerTheme === 'light' ? "bg-[#f8f9fa] text-slate-900" :
    "bg-neutral-950 text-neutral-300"

  return (
    <div className={cn("fixed inset-0 z-[100] flex flex-col overflow-hidden animate-in fade-in duration-300", readerBg)}>
      <TitleBar />
      
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
        onClose={() => setActiveChapter(null)}
        onOpenInBrowser={openInBrowser}
        onToggleAutoScroll={() => setAutoScrollEnabled(!autoScrollEnabled)}
        onChangeAutoScrollSpeed={setAutoScrollSpeed}
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
          "flex-1 relative outline-none overscroll-contain no-scrollbar", 
          isVertical ? "overflow-y-auto" : "overflow-hidden", 

          isHorizontalContinuous && "overflow-x-auto overflow-y-hidden flex flex-row", 
          dragToScroll && (isDragging ? "cursor-grabbing" : "cursor-grab"), 
          dragToScroll && "select-none"
        )}
      >
        <div className={cn("flex", isHorizontalContinuous ? (readingMode === 'continuous-rtl' ? "flex-row-reverse w-max h-full" : "flex-row w-max h-full") : "flex-col w-full")}>
          {loadedChapters.map((chapter) => (
            <ChapterSection 
              key={chapter.id} 
              chapter={chapter} 
              mangaId={selectedManga.id} 
              pkg={resolvedPkg} 
              readingMode={readingMode} 
              readerTheme={readerTheme}
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
                <p className="text-xl font-bold bg-gradient-to-r from-neutral-100 to-neutral-400 bg-clip-text text-transparent">End of Stream</p>
                <p className="text-xs text-neutral-500 font-medium tracking-wide">Return or browse more chapters.</p>
              </div>
              <Button onClick={() => setActiveChapter(null)} variant="outline" className="rounded-full px-8 border-neutral-800 text-neutral-400 hover:bg-neutral-900 shadow-xl">Back to Library</Button>
            </div>
          )}
        </div>
      </div>

      {totalPages > 0 && (
        <div 
          className="fixed bottom-0 left-0 right-0 h-1 hover:h-1.5 bg-neutral-900/50 z-[110] cursor-pointer group transition-all"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const x = e.clientX - rect.left
            const isRtl = readingMode === 'paged-rtl' || readingMode === 'continuous-rtl'
            const ratio = isRtl ? (1 - (x / rect.width)) : (x / rect.width)
            const targetPage = Math.max(1, Math.min(totalPages, Math.ceil(ratio * totalPages)))
            
            if (isVertical || isHorizontalContinuous) {
              const pageEl = scrollRef.current?.querySelector(`[data-page-index="${targetPage - 1}"]`)
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
              "absolute top-0 bottom-0 bg-primary transition-all duration-300 shadow-[0_0_15px_rgba(var(--primary),0.6)]",
              (readingMode === 'paged-rtl' || readingMode === 'continuous-rtl') ? "right-0" : "left-0"
            )}
            style={{ width: `${(currentPage / totalPages) * 100}%` }} 
          >
            <div className="absolute right-0 bottom-full mb-1.5 opacity-0 group-hover:opacity-100 bg-neutral-800 border border-neutral-700 text-[10px] px-2 py-1 rounded shadow-xl pointer-events-none transition-opacity text-white font-mono whitespace-nowrap translate-x-1/2 tracking-wider font-bold">
               PAGE {currentPage} / {totalPages}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
