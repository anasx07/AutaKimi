import { useEffect, useRef, memo } from 'react'
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@renderer/shared/ui'
import { cn } from '@renderer/shared/lib/utils'
import { useChapterPages } from '@renderer/entities/manga/api/useMangaQueries'
import { Chapter } from '@renderer/shared/api/sources/types'

interface ChapterSectionProps {
  chapter: Chapter
  mangaId: string
  pkg: string
  readingMode: string
  onHalfway: (c: Chapter) => void
  onVisible: (c: Chapter) => void
  onLoaded: (count: number) => void
  onPageVisible: (page: number) => void
  currentPage: number
  onNextPage: () => void
  onPrevPage: () => void
  isDragging: boolean
  dragMoved: boolean
  scrollRoot: HTMLDivElement | null
}

export const ChapterSection = memo(({ 
  chapter, 
  mangaId, 
  pkg, 
  readingMode, 
  onHalfway, 
  onVisible,
  onLoaded,
  onPageVisible,
  currentPage,
  onNextPage,
  onPrevPage,
  isDragging,
  dragMoved,
  scrollRoot
}: ChapterSectionProps) => {
  const { data: pages = [], isLoading } = useChapterPages(mangaId, pkg, chapter)
  const halfwayRef = useRef<HTMLDivElement>(null)
  const sectionRef = useRef<HTMLDivElement>(null)
  const halfwayTriggered = useRef(false)
  const pageRefs = useRef<(HTMLDivElement | null)[]>([])

  const isVertical = readingMode === 'continuous-vertical' || readingMode === 'webtoon'
  const isPaged = readingMode.startsWith('paged-')
  const isHorizontal = readingMode.startsWith('continuous-') && !isVertical

  useEffect(() => {
    if (pages.length > 0) onLoaded(pages.length)
  }, [pages.length, onLoaded])

  // --- Halfway & section visibility observers ---
  useEffect(() => {
    if (pages.length === 0) return

    if (!isVertical) {
      // In paged/horizontal modes, there's only one chapter visible at a time
      onVisible(chapter)
      return
    }

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
  }, [pages.length, chapter.id, isVertical, onVisible, onHalfway])

  // --- Per-image page tracking observer (vertical/webtoon modes) ---
  useEffect(() => {
    if (pages.length === 0 || !isVertical || !scrollRoot) return

    const observer = new IntersectionObserver((entries) => {
      // Find the topmost intersecting entry
      let topEntry: IntersectionObserverEntry | null = null
      for (const entry of entries) {
        if (entry.isIntersecting) {
          if (!topEntry || entry.boundingClientRect.top < topEntry.boundingClientRect.top) {
            topEntry = entry
          }
        }
      }
      if (topEntry) {
        const idx = parseInt((topEntry.target as HTMLElement).dataset.pageIndex || '0', 10)
        onPageVisible(idx + 1)
      }
    }, { root: scrollRoot, threshold: 0.1, rootMargin: '-30% 0px -60% 0px' })

    pageRefs.current.forEach(el => { if (el) observer.observe(el) })

    return () => observer.disconnect()
  }, [pages.length, isVertical, scrollRoot, onPageVisible])

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
             <div
               key={`${url}-${i}`}
               ref={el => { pageRefs.current[i] = el }}
               data-page-index={i}
               className={cn("w-full flex flex-col relative group bg-neutral-950 items-center justify-center min-h-[400px]", readingMode !== 'webtoon' && "rounded-lg overflow-hidden border border-white/5 shadow-2xl mb-4 last:mb-0")}
             >
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
