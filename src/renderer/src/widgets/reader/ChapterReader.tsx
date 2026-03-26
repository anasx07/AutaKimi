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

export default function ChapterReader() {
  const { activeChapter, setActiveChapter, selectedManga } = useLibraryStore()
  const { activeExtension, installedExtensions } = useExtensionStore()
  const { addHistoryEntry } = useHistoryStore()
  const { markChapterRead } = useProgressStore()
  const queryClient = useQueryClient()
  
  const { 
    readingMode, dragToScroll, 
    autoScrollEnabled, setAutoScrollEnabled, 
    autoScrollSpeed, setAutoScrollSpeed,
    autoScrollShortcuts
  } = useReaderStore()

  // --- State & Refs ---
  const [loadedChapters, setLoadedChapters] = useState<Chapter[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const lastSyncId = useRef<string | null>(null)

  const { data: chapters = [] } = useMangaChapters(
    selectedManga?.id || '', 
    activeExtension || '', 
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
    isKbdSlowed
  )

  // --- Helpers ---
  const extensionName = useMemo(() => {
    const ext = installedExtensions.find(e => e.pkg === activeExtension)
    return ext?.name || activeExtension || 'Source'
  }, [activeExtension, installedExtensions])

  const openInBrowser = useCallback(() => {
    if (activeChapter?.url) DataService.openExternal(activeChapter.url)
  }, [activeChapter?.url])

  const handlePageVisible = useCallback((page: number) => {
    setCurrentPage(page)
  }, [])

  useEffect(() => {
    if (activeChapter && !loadedChapters.find(c => c.id === activeChapter.id)) {
      setLoadedChapters([activeChapter])
      setCurrentPage(1)
      if (scrollRef.current) scrollRef.current.scrollTop = 0
    }
  }, [activeChapter?.id])

  const findNextChapter = (current: Chapter) => {
    if (chapters.length === 0) return null
    const sorted = [...chapters].sort((a, b) => {
      const getNum = (c: any) => typeof c.number === 'string' ? parseFloat(c.number) : (c.number || 0)
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
    if (activeChapter?.id !== chapter.id) setActiveChapter(chapter)
    if (selectedManga) {
       markChapterRead(selectedManga.id, chapter.id, false)
       addHistoryEntry({ 
         mangaId: selectedManga.id, 
         mangaTitle: selectedManga.title, 
         mangaCover: selectedManga.coverUrl || undefined,
         mangaUrl: selectedManga.url || undefined,
         chapterId: chapter.id, 
         chapterTitle: chapter.title || undefined, 
         startedAt: new Date().toISOString(), 
         durationSeconds: 0, 
         pkg: activeExtension || undefined, 
         type: 'manga' 
       }).then(() => {
         queryClient.invalidateQueries({ queryKey: mangaKeys.history() })
       })
    }
  }

  const pagedNext = () => setCurrentPage(prev => Math.min(totalPages, prev + 1))
  const pagedPrev = () => setCurrentPage(prev => Math.max(1, prev - 1))

  if (!activeChapter || !selectedManga || !activeExtension) return null

  return (
    <div className="fixed inset-0 bg-neutral-950 z-[100] flex flex-col overflow-hidden animate-in fade-in duration-300">
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
        onClose={() => setActiveChapter(null)}
        onOpenInBrowser={openInBrowser}
        onToggleAutoScroll={() => setAutoScrollEnabled(!autoScrollEnabled)}
        onChangeAutoScrollSpeed={setAutoScrollSpeed}
      />

      <div 
        ref={scrollRef} 
        tabIndex={0} 
        {...dragHandlers}
        className={cn(
          "flex-1 bg-neutral-950 relative outline-none overscroll-contain no-scrollbar", 
          isVertical ? "overflow-y-auto" : "overflow-hidden", 
          isHorizontalContinuous && "overflow-x-auto overflow-y-hidden flex flex-row", 
          dragToScroll && (isDragging ? "cursor-grabbing" : "cursor-grab"), 
          dragToScroll && "select-none"
        )}
      >
        <div className="flex flex-col w-full">
          {loadedChapters.map((chapter) => (
            <ChapterSection 
              key={chapter.id} 
              chapter={chapter} 
              mangaId={selectedManga.id} 
              pkg={activeExtension} 
              readingMode={readingMode} 
              onHalfway={handleHalfway} 
              onVisible={handleVisible} 
              onLoaded={(count) => setTotalPages(count)} 
              onPageVisible={handlePageVisible} 
              currentPage={currentPage} 
              onNextPage={pagedNext} 
              onPrevPage={pagedPrev} 
              isDragging={isDragging} 
              dragMoved={dragMoved.current} 
              scrollRoot={scrollRef.current} 
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
        <div className="fixed bottom-0 left-0 right-0 h-1 bg-neutral-900/50 z-[110]">
          <div 
            className="h-full bg-primary transition-all duration-300 shadow-[0_0_15px_rgba(var(--primary),0.6)]" 
            style={{ width: `${(currentPage / totalPages) * 100}%` }} 
          />
        </div>
      )}
    </div>
  )
}
