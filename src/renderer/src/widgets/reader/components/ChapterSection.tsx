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
  readerTheme: string
  onHalfway: (c: Chapter) => void
  onVisible: (c: Chapter) => void
  onLoaded: (id: string, count: number) => void
  onPageVisible: (id: string, page: number) => void
  currentPage: number
  onNextPage: () => void
  onPrevPage: () => void
  isDragging: boolean
  dragMoved: boolean
  scrollRoot: HTMLDivElement | null
  zoomLevel: number
}

export const ChapterSection = memo(
  ({
    chapter,
    mangaId,
    pkg,
    readingMode,
    readerTheme,
    onHalfway,
    onVisible,
    onLoaded,
    onPageVisible,
    currentPage,
    onNextPage,
    onPrevPage,
    isDragging,
    dragMoved,
    scrollRoot,
    zoomLevel
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
      if (pages.length > 0) {
        onLoaded(chapter.id, pages.length)
        // Trigger visit immediately when pages are ready
        onVisible(chapter)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pages.length, chapter.id])

    // --- Halfway & section visibility observers ---
    useEffect(() => {
      if (pages.length === 0) return

      if (!isVertical) {
        // In paged/horizontal modes, there's only one chapter visible at a time
        onVisible(chapter)
        return
      }

      const halfwayObserver = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && !halfwayTriggered.current) {
            halfwayTriggered.current = true
            onHalfway(chapter)
          }
        },
        { threshold: 0.1, rootMargin: '0px 0px 400% 0px' }
      )

      const visibilityObserver = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) onVisible(chapter)
        },
        { threshold: 0.1, rootMargin: '-20% 0px -20% 0px' }
      )

      if (halfwayRef.current) halfwayObserver.observe(halfwayRef.current)
      if (sectionRef.current) visibilityObserver.observe(sectionRef.current)

      return () => {
        halfwayObserver.disconnect()
        visibilityObserver.disconnect()
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pages.length, chapter.id, isVertical])

    // --- Per-image page tracking observer (vertical/webtoon modes) ---
    useEffect(() => {
      if (pages.length === 0 || !isVertical || !scrollRoot) return

      const observer = new IntersectionObserver(
        (entries) => {
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
            onPageVisible(chapter.id, idx + 1)
          }
        },
        {
          root: scrollRoot,
          threshold: 0,
          rootMargin: '-10% 0px -70% 0px'
        }
      )

      pageRefs.current.forEach((el) => {
        if (el) observer.observe(el)
      })

      return () => observer.disconnect()
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pages.length, isVertical, scrollRoot])

    if (isLoading) {
      return (
        <div className="w-full flex-1 flex flex-col items-center justify-center py-40 gap-4 min-h-screen">
          <Loader2 className="h-10 w-10 animate-spin text-primary opacity-50" />
          <p className="text-sm font-medium tracking-widest uppercase italic opacity-50">
            Synthesizing Ch. {chapter.number}...
          </p>
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
      <div
        ref={sectionRef}
        className={cn(
          'flex',
          isHorizontal
            ? cn(
                'h-[calc(100vh-3.5rem)] py-6 px-3 gap-6',
                readingMode === 'continuous-rtl' ? 'flex-row-reverse' : 'flex-row'
              )
            : 'w-full flex-col items-center'
        )}
        data-chapter-id={chapter.id}
      >
        {isPaged && (
          <div
            className={cn(
              'flex-1 w-full h-[calc(100vh-3.5rem)] flex items-center justify-center relative touch-pan-y',
              zoomLevel > 1 ? 'overflow-auto' : 'overflow-hidden',
              isDragging ? 'cursor-grabbing' : 'cursor-grab'
            )}
            onClick={handleModeClick}
          >
            <div className="flex items-center justify-center min-w-full min-h-full m-auto">
              <img
                key={pages[currentPage - 1]}
                src={pages[currentPage - 1]}
                alt={`Page ${currentPage}`}
                className="object-contain select-none pointer-events-none animate-in fade-in zoom-in-95 duration-300 shadow-2xl"
                style={{
                  width: zoomLevel > 1 ? `${zoomLevel * 100}%` : 'auto',
                  height: zoomLevel > 1 ? `${zoomLevel * 100}%` : 'auto',
                  maxWidth: zoomLevel === 1 ? '100%' : 'none',
                  maxHeight: zoomLevel === 1 ? '100%' : 'none'
                }}
              />
            </div>

            <div className="hidden">
              {pages.slice(currentPage, currentPage + 3).map((url) => (
                <img key={`preload-${url}`} src={url} decoding="async" />
              ))}
            </div>

            <div
              className="absolute bottom-10 flex gap-4 z-20"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                variant="outline"
                size="icon"
                onClick={readingMode === 'paged-rtl' ? onNextPage : onPrevPage}
                className="rounded-full bg-black/60 border-neutral-800 shadow-lg"
              >
                <ChevronLeft className="h-5 w-5 text-white" />
              </Button>
              <div className="bg-black/60 backdrop-blur-md px-6 py-2 rounded-full border border-white/10 text-sm font-bold font-mono tracking-tighter shadow-2xl text-neutral-100 min-w-[100px] text-center">
                {currentPage} / {pages.length}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={readingMode === 'paged-rtl' ? onPrevPage : onNextPage}
                className="rounded-full bg-black/60 border-neutral-800 shadow-lg"
              >
                <ChevronRight className="h-5 w-5 text-white" />
              </Button>
            </div>
          </div>
        )}

        {isHorizontal && (
          <>
            {pages.map((url, i) => (
              <div
                key={`${url}-${i}`}
                className="shrink-0 flex items-center justify-center bg-neutral-900/20 rounded-2xl overflow-hidden border border-white/5 shadow-2xl backdrop-blur-sm pointer-events-none"
                style={{ height: `calc((100vh - 3.5rem) * ${zoomLevel})` }}
              >
                <img
                  src={url}
                  alt={`Page ${i + 1}`}
                  className="h-full w-auto object-contain select-none"
                  loading="lazy"
                />
              </div>
            ))}
          </>
        )}

        {isVertical && (
          <div
            className={cn(
              'w-full flex flex-col items-center mx-auto',
              readingMode === 'webtoon' ? 'gap-0' : 'gap-1 py-1'
            )}
            style={{ maxWidth: `${zoomLevel * 56}rem` }}
          >
            {pages.map((url, i) => (
              <div
                key={`${url}-${i}`}
                ref={(el) => {
                  pageRefs.current[i] = el
                }}
                data-page-index={i}
                className={cn(
                  'w-full flex flex-col relative group items-center justify-center min-h-[400px]',
                  readingMode !== 'webtoon' &&
                    'rounded-lg overflow-hidden shadow-2xl mb-4 last:mb-0',
                  readingMode !== 'webtoon' &&
                    (readerTheme === 'light' ? 'border border-black/10' : 'border border-white/5')
                )}
              >
                <img
                  src={url}
                  alt={`Page ${i + 1}`}
                  className="w-full h-auto block max-w-full select-none pointer-events-none"
                  loading="lazy"
                />
                {i === Math.floor(pages.length / 2) && (
                  <div
                    ref={halfwayRef}
                    className="absolute inset-x-0 bottom-0 h-1 pointer-events-none opacity-0"
                  />
                )}
                <div className="absolute bottom-4 left-4 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 backdrop-blur-sm text-[10px] font-mono px-2 py-0.5 rounded border border-white/10 text-neutral-400 z-10 pointer-events-none shadow-lg">
                  CH {chapter.number} • PAGE {i + 1}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }
)
