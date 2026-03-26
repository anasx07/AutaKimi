import { useEffect, useState, useRef, useMemo, memo } from 'react'
import { TitleBar } from '@renderer/widgets/title-bar'
import { ArrowLeft, Loader2, ChevronLeft, ChevronRight, Hand, ExternalLink, Play, Pause } from 'lucide-react'
import { 
  useLibraryStore, 
  useReaderStore, 
  useHistoryStore, 
  useProgressStore,
  useExtensionStore
} from '@renderer/shared/model'
import { Button } from '@renderer/shared/ui'
import { cn } from '@renderer/shared/lib/utils'
import { useChapterPages, useMangaChapters } from '@renderer/entities/manga/api/useMangaQueries'
import { Chapter } from '@renderer/shared/api/sources/types'

// --- Sub-component: ChapterSection ---
const ChapterSection = memo(({ 
  chapter, 
  mangaId, 
  pkg, 
  readingMode, 
  onHalfway, 
  onVisible,
  onLoaded,
  currentPage,
  onNextPage,
  onPrevPage,
  isDragging,
  dragMoved
}: { 
  chapter: Chapter, 
  mangaId: string, 
  pkg: string, 
  readingMode: string,
  onHalfway: (c: Chapter) => void,
  onVisible: (c: Chapter) => void,
  onLoaded: (count: number) => void,
  currentPage: number,
  onNextPage: () => void,
  onPrevPage: () => void,
  isDragging: boolean,
  dragMoved: boolean
}) => {
  const { data: pages = [], isLoading } = useChapterPages(mangaId, pkg, chapter)
  const halfwayRef = useRef<HTMLDivElement>(null)
  const sectionRef = useRef<HTMLDivElement>(null)
  const halfwayTriggered = useRef(false)

  const isVertical = readingMode === 'continuous-vertical' || readingMode === 'webtoon'
  const isPaged = readingMode.startsWith('paged-')
  const isHorizontal = readingMode.startsWith('continuous-') && !isVertical

  useEffect(() => {
    if (pages.length > 0) onLoaded(pages.length)
  }, [pages.length])

  useEffect(() => {
    if (pages.length === 0 || !isVertical) return

    const halfwayObserver = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !halfwayTriggered.current) {
         halfwayTriggered.current = true
         onHalfway(chapter)
      }
    }, { threshold: 0.1, rootMargin: '0px 0px 400% 0px' })

    const visibilityObserver = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) onVisible(chapter)
    }, { threshold: 0.1, rootMargin: '-20% 0px -20% 0px' })

    if (halfwayRef.current) halfwayObserver.observe(halfwayRef.current)
    if (sectionRef.current) visibilityObserver.observe(sectionRef.current)

    return () => {
      halfwayObserver.disconnect()
      visibilityObserver.disconnect()
    }
  }, [pages.length, chapter.id, isVertical])

  if (isLoading) {
    return (
      <div className="w-full flex-1 flex flex-col items-center justify-center py-40 gap-4 min-h-screen bg-neutral-950">
         <Loader2 className="h-10 w-10 animate-spin text-primary opacity-50" />
         <p className="text-sm text-neutral-500 font-medium tracking-widest uppercase italic">Synthesizing Ch. {chapter.number}...</p>
      </div>
    )
  }

  const handleModeClick = (e: React.MouseEvent) => {
    if (isDragging || dragMoved) return
    if (isPaged) {
       const x = e.clientX
       const width = window.innerWidth
       const isRtl = readingMode === 'paged-rtl'
       if (x < width / 3) isRtl ? onNextPage() : onPrevPage()
       else if (x > (width * 2) / 3) isRtl ? onPrevPage() : onNextPage()
    }
  }

  return (
    <div ref={sectionRef} className="w-full flex flex-col items-center" data-chapter-id={chapter.id}>
      {isPaged && (
        <div 
          className={cn(
            "flex-1 w-full h-[calc(100vh-3.5rem)] flex items-center justify-center relative touch-pan-y overflow-hidden",
            isDragging ? "cursor-grabbing" : "cursor-grab"
          )}
          onClick={handleModeClick}
        >
          <img key={pages[currentPage - 1]} src={pages[currentPage - 1]} alt={`Page ${currentPage}`} className="max-h-full max-w-full object-contain select-none pointer-events-none animate-in fade-in zoom-in-95 duration-300 shadow-2xl" />
          <div className="absolute bottom-10 flex gap-4 z-20" onClick={e => e.stopPropagation()}>
             <Button variant="outline" size="icon" onClick={readingMode === 'paged-rtl' ? onNextPage : onPrevPage} className="rounded-full bg-black/60 border-neutral-800 shadow-lg"><ChevronLeft className="h-5 w-5 text-white" /></Button>
             <div className="bg-black/60 backdrop-blur-md px-6 py-2 rounded-full border border-white/10 text-sm font-bold font-mono tracking-tighter shadow-2xl text-neutral-100 min-w-[100px] text-center">{currentPage} / {pages.length}</div>
             <Button variant="outline" size="icon" onClick={readingMode === 'paged-rtl' ? onPrevPage : onNextPage} className="rounded-full bg-black/60 border-neutral-800 shadow-lg"><ChevronRight className="h-5 w-5 text-white" /></Button>
          </div>
        </div>
      )}

      {isHorizontal && (
        <div className={cn("h-[calc(100vh-3.5rem)] flex gap-6 p-8 min-w-full overflow-x-auto no-scrollbar", readingMode === 'continuous-rtl' && "flex-row-reverse")}>
           {pages.map((url, i) => (
              <div key={`${url}-${i}`} className="h-full shrink-0 flex items-center justify-center bg-neutral-900/20 rounded-2xl overflow-hidden border border-white/5 shadow-2xl backdrop-blur-sm pointer-events-none">
                 <img src={url} alt={`Page ${i + 1}`} className="h-full w-auto object-contain select-none" loading="lazy" />
              </div>
           ))}
        </div>
      )}

      {isVertical && (
        <div className={cn("w-full flex flex-col items-center mx-auto", readingMode === 'webtoon' ? "max-w-none gap-0" : "max-w-4xl gap-4 py-8")}>
           {pages.map((url, i) => (
             <div key={`${url}-${i}`} className={cn("w-full flex flex-col relative group bg-neutral-950 items-center justify-center min-h-[400px]", readingMode !== 'webtoon' && "rounded-lg overflow-hidden border border-white/5 shadow-2xl mb-4 last:mb-0")}>
               <img src={url} alt={`Page ${i + 1}`} className={cn("w-full h-auto block select-none pointer-events-none", readingMode === 'webtoon' ? "max-w-none" : "max-w-full")} loading="lazy" />
               {i === Math.floor(pages.length / 2) && <div ref={halfwayRef} className="absolute inset-x-0 bottom-0 h-1 pointer-events-none opacity-0" />}
               <div className="absolute bottom-4 left-4 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 backdrop-blur-sm text-[10px] font-mono px-2 py-0.5 rounded border border-white/10 text-neutral-400 z-10 pointer-events-none shadow-lg">CH {chapter.number} • PAGE {i + 1}</div>
             </div>
           ))}
        </div>
      )}
    </div>
  )
})

export default function ChapterReader() {
  const { activeChapter, setActiveChapter, selectedManga } = useLibraryStore()
  const { activeExtension, installedExtensions } = useExtensionStore()
  const { addHistoryEntry } = useHistoryStore()
  const { markChapterRead } = useProgressStore()
  const { 
    readingMode, dragToScroll, 
    autoScrollEnabled, setAutoScrollEnabled, 
    autoScrollSpeed, setAutoScrollSpeed,
    autoScrollShortcuts
  } = useReaderStore()

  const [loadedChapters, setLoadedChapters] = useState<Chapter[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0, scrollL: 0, scrollT: 0 })
  const dragMoved = useRef(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const lastSyncId = useRef<string | null>(null)
  const autoScrollRef = useRef<number | null>(null)
  const preciseScrollTop = useRef(0)

  // --- Keyboard & Temp State ---
  const [isKbdPaused, setIsKbdPaused] = useState(false)
  const [isKbdReversing, setIsKbdReversing] = useState(false)
  const [isKbdBoosted, setIsKbdBoosted] = useState(false)
  const [isKbdSlowed, setIsKbdSlowed] = useState(false)

  const { data: chapters = [] } = useMangaChapters(selectedManga?.id || '', activeExtension || '', selectedManga?.url)

  const isInfiniteScroll = readingMode === 'webtoon' || readingMode === 'continuous-vertical'
  const isVertical = isInfiniteScroll || readingMode === 'paged-vertical'
  const isHorizontalContinuous = readingMode === 'continuous-ltr' || readingMode === 'continuous-rtl'

  const extensionName = useMemo(() => {
    const ext = installedExtensions.find(e => e.pkg === activeExtension)
    return ext?.name || activeExtension || 'Source'
  }, [activeExtension, installedExtensions])

  const openInBrowser = () => {
    if (activeChapter?.url && (window as any).api?.openExternal) (window as any).api.openExternal(activeChapter.url)
  }

  // --- Sync Precise Scroll on Manual Movement ---
  useEffect(() => {
    const handleScroll = () => {
      if (scrollRef.current) preciseScrollTop.current = scrollRef.current.scrollTop
    }
    const ref = scrollRef.current
    ref?.addEventListener('scroll', handleScroll, { passive: true })
    return () => ref?.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (activeChapter && !loadedChapters.find(c => c.id === activeChapter.id)) {
      setLoadedChapters([activeChapter])
      setCurrentPage(1)
      if (scrollRef.current) scrollRef.current.scrollTop = 0
    }
  }, [activeChapter?.id])

  // --- Keyboard Controls Handler ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName || '')) return

      if (e.repeat && (e.code === autoScrollShortcuts.pause || e.code === autoScrollShortcuts.toggle)) return
      
      if (e.code === autoScrollShortcuts.pause) {
         e.preventDefault()
         setIsKbdPaused(true)
      }
      if (e.code === autoScrollShortcuts.reverse) setIsKbdReversing(true)
      if (e.code === autoScrollShortcuts.boost) setIsKbdBoosted(true)
      if (e.code === autoScrollShortcuts.slow) setIsKbdSlowed(true)
      if (e.code === autoScrollShortcuts.toggle) setAutoScrollEnabled(!autoScrollEnabled)
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === autoScrollShortcuts.pause) setIsKbdPaused(false)
      if (e.code === autoScrollShortcuts.reverse) setIsKbdReversing(false)
      if (e.code === autoScrollShortcuts.boost) setIsKbdBoosted(false)
      if (e.code === autoScrollShortcuts.slow) setIsKbdSlowed(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [autoScrollEnabled, autoScrollShortcuts])

  // --- Auto Scroll Logic ---
  useEffect(() => {
    if (!autoScrollEnabled || !scrollRef.current || !isInfiniteScroll) {
       if (autoScrollRef.current) cancelAnimationFrame(autoScrollRef.current)
       return
    }

    const scroll = () => {
       if (scrollRef.current && !isDragging && !isKbdPaused) {
          let finalStep = autoScrollSpeed * 0.25
          if (isKbdBoosted) finalStep *= 6
          if (isKbdSlowed) finalStep *= 0.3
          if (isKbdReversing) finalStep *= -2
          
          preciseScrollTop.current += finalStep
          scrollRef.current.scrollTop = preciseScrollTop.current
       }
       autoScrollRef.current = requestAnimationFrame(scroll)
    }

    autoScrollRef.current = requestAnimationFrame(scroll)
    return () => {
       if (autoScrollRef.current) cancelAnimationFrame(autoScrollRef.current)
    }
  }, [autoScrollEnabled, autoScrollSpeed, isInfiniteScroll, isDragging, isKbdPaused, isKbdReversing, isKbdBoosted, isKbdSlowed])

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
    if (next && !loadedChapters.find(c => c.id === next.id)) setLoadedChapters(prev => [...prev, next])
  }

  const handleVisible = (chapter: Chapter) => {
    if (lastSyncId.current === chapter.id) return
    lastSyncId.current = chapter.id
    if (activeChapter?.id !== chapter.id) setActiveChapter(chapter)
    if (selectedManga) {
       markChapterRead(selectedManga.id, chapter.id, false)
       addHistoryEntry({ mangaId: selectedManga.id, mangaTitle: selectedManga.title, chapterId: chapter.id, chapterTitle: chapter.title || undefined, startedAt: new Date().toISOString(), durationSeconds: 0, pkg: activeExtension || undefined, type: 'manga' })
    }
  }

  const pagedNext = () => setCurrentPage(prev => Math.min(totalPages, prev + 1))
  const pagedPrev = () => setCurrentPage(prev => Math.max(1, prev - 1))

  const onMouseDown = (e: React.MouseEvent) => {
    if (!dragToScroll || e.button !== 0) return
    setIsDragging(true)
    dragMoved.current = false
    dragStart.current = { x: e.pageX - (scrollRef.current?.offsetLeft || 0), y: e.pageY - (scrollRef.current?.offsetTop || 0), scrollL: scrollRef.current?.scrollLeft || 0, scrollT: scrollRef.current?.scrollTop || 0 }
  }

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return
    e.preventDefault()
    const x = e.pageX - (scrollRef.current.offsetLeft || 0)
    const y = e.pageY - (scrollRef.current.offsetTop || 0)
    const walkX = (x - dragStart.current.x) * 1.5
    const walkY = (y - dragStart.current.y) * 1.5
    if (Math.abs(walkX) > 5 || Math.abs(walkY) > 5) dragMoved.current = true
    if (isHorizontalContinuous) scrollRef.current.scrollLeft = dragStart.current.scrollL - walkX
    else scrollRef.current.scrollTop = dragStart.current.scrollT - walkY
  }

  if (!activeChapter || !selectedManga || !activeExtension) return null

  return (
    <div className="fixed inset-0 bg-neutral-950 z-[100] flex flex-col overflow-hidden animate-in fade-in duration-300">
      <TitleBar />
      <div className="h-14 bg-neutral-900/90 backdrop-blur-xl border-b border-neutral-800/50 px-4 flex items-center justify-between flex-shrink-0 z-20">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setActiveChapter(null)} className="h-9 w-9 text-neutral-400"><ArrowLeft className="h-5 w-5" /></Button>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-neutral-100 truncate max-w-[200px] sm:max-w-md">Chapter {activeChapter.number} {activeChapter.title ? `• ${activeChapter.title}` : ''}</span>
            <button onClick={openInBrowser} className="text-[10px] text-neutral-500 font-mono tracking-wider uppercase flex items-center gap-2 hover:text-primary transition-colors group truncate max-w-[200px] sm:max-w-md" title={activeChapter.url}>{extensionName} • {activeChapter.url} <ExternalLink className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" /></button>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {isInfiniteScroll && (
            <div className="flex items-center gap-0.5 px-2 mr-2 border-r border-neutral-800 animate-in slide-in-from-right-4 group relative">
               <Button variant="ghost" size="icon" onClick={() => setAutoScrollEnabled(!autoScrollEnabled)} className={cn("h-8 w-8 transition-colors", autoScrollEnabled ? "text-primary bg-primary/10" : "text-neutral-500")}>{(autoScrollEnabled && !isKbdPaused) ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</Button>
               {autoScrollEnabled && (
                  <select value={autoScrollSpeed} onChange={e => setAutoScrollSpeed(parseInt(e.target.value))} className="bg-transparent text-[10px] font-bold text-primary outline-none py-1 px-1 cursor-pointer hover:bg-white/5 rounded transition-all appearance-none text-center min-w-[30px]">{[1,2,3,4,5,6,7,8,9,10].map(s => <option key={s} value={s} className="bg-neutral-900">x{s}</option>)}</select>
               )}
               {isKbdPaused && <span className="absolute -top-6 right-0 bg-primary/20 text-primary text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest animate-pulse border border-primary/30 backdrop-blur-sm shadow-2xl">Paused</span>}
            </div>
          )}
          {dragToScroll && <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-800/50 text-primary/80 border border-white/5 text-[10px] uppercase font-black"><Hand className="h-3.5 w-3.5" /> Drag On</div>}
        </div>
      </div>
      <div ref={scrollRef} tabIndex={0} onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={() => setIsDragging(false)} onMouseLeave={() => setIsDragging(false)} className={cn("flex-1 bg-neutral-950 relative outline-none overscroll-contain no-scrollbar", isVertical ? "overflow-y-auto" : "overflow-hidden", isHorizontalContinuous && "overflow-x-auto overflow-y-hidden flex flex-row", dragToScroll && (isDragging ? "cursor-grabbing" : "cursor-grab"), dragToScroll && "select-none")}>
        <div className="flex flex-col w-full">
          {loadedChapters.map((chapter) => (
            <ChapterSection key={chapter.id} chapter={chapter} mangaId={selectedManga.id} pkg={activeExtension} readingMode={readingMode} onHalfway={handleHalfway} onVisible={handleVisible} onLoaded={(count) => setTotalPages(count)} currentPage={currentPage} onNextPage={pagedNext} onPrevPage={pagedPrev} isDragging={isDragging} dragMoved={dragMoved.current} />
          ))}
          {isInfiniteScroll && <div className="w-full max-w-lg py-40 px-6 flex flex-col items-center text-center gap-6 mx-auto"><div className="h-px w-full bg-gradient-to-r from-transparent via-neutral-800 to-transparent opacity-20" /><div className="space-y-1"><p className="text-xl font-bold bg-gradient-to-r from-neutral-100 to-neutral-400 bg-clip-text text-transparent">End of Stream</p><p className="text-xs text-neutral-500 font-medium tracking-wide">Return or browse more chapters.</p></div><Button onClick={() => setActiveChapter(null)} variant="outline" className="rounded-full px-8 border-neutral-800 text-neutral-400 hover:bg-neutral-900 shadow-xl">Back to Library</Button></div>}
        </div>
      </div>
      {!isInfiniteScroll && <div className="fixed bottom-0 left-0 right-0 h-1 bg-neutral-900/50 z-[110]"><div className="h-full bg-primary transition-all duration-300 shadow-[0_0_15px_rgba(var(--primary),0.6)]" style={{ width: `${(currentPage / totalPages) * 100}%` }} /></div>}
    </div>
  )
}
