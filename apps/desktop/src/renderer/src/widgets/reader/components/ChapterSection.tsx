import { useEffect, useRef, memo, useState, useCallback, type CSSProperties } from 'react'
import { Loader2, ChevronLeft, ChevronRight, RotateCcw, ShieldCheck } from 'lucide-react'
import { Button } from '@renderer/shared/ui'
import { cn } from '@renderer/shared/lib/utils'
import { useChapterPages } from '@renderer/entities/manga/api/useMangaQueries'
import { Chapter } from '@renderer/shared/api/sources/types'
import { BypassService } from '@renderer/shared/api/bypass.service'
import { useImagePreloader } from '../hooks/useImagePreloader'
import { getDoublePageSlot, PageDimensions, PageDimensionsMap } from '../lib/doublePageSpread'

interface ChapterSectionProps {
  chapter: Chapter
  mangaId: string
  pkg: string
  readingMode: string
  readerTheme: string
  cropBorders?: boolean
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
  pageDimensions?: PageDimensionsMap
  onPageDimensions?: (chapterId: string, pageNumber: number, dimensions: PageDimensions) => void
}

function ReaderImage({
  src,
  alt,
  className,
  style,
  priority = false,
  chapterUrl,
  onDimensions
}: {
  src: string
  alt: string
  className?: string
  style?: CSSProperties
  priority?: boolean
  chapterUrl?: string
  onDimensions?: (dimensions: PageDimensions) => void
}) {
  const [hasError, setHasError] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const [isBypassingCf, setIsBypassingCf] = useState(false)

  const handleRetry = (e: React.MouseEvent) => {
    e.stopPropagation()
    setHasError(false)
    setRetryKey((k) => k + 1)
  }

  const handleCloudflareRefresh = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsBypassingCf(true)
    try {
      // Prioritize refreshing Cloudflare challenge on the base chapter/source domain or image URL
      const targetUrl = chapterUrl || src
      await BypassService.cfBypass(targetUrl, false)
      setHasError(false)
      setRetryKey((k) => k + 1)
    } catch (err) {
      console.error('[ReaderImage] Failed to resolve Cloudflare challenge:', err)
    } finally {
      setIsBypassingCf(false)
    }
  }

  if (hasError) {
    const isRemote = src.startsWith('http://') || src.startsWith('https://')
    return (
      <div className="w-full min-h-[300px] flex flex-col items-center justify-center p-6 bg-secondary/10 border border-destructive/20 rounded-xl my-4 gap-3 text-center pointer-events-auto">
        <div className="flex flex-col items-center gap-1 max-w-sm">
          <p className="text-xs text-destructive/90 font-bold">Failed to load page image</p>
          <p className="text-[11px] text-muted-foreground">
            {isRemote
              ? 'The image might be temporarily blocked by Cloudflare (expired cf_clearance) or a network error.'
              : 'The local cached image file could not be read.'}
          </p>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRetry}
            disabled={isBypassingCf}
            className="flex items-center gap-1.5 text-xs text-foreground/80 hover:text-foreground border-border hover:bg-secondary/40"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Retry Page</span>
          </Button>

          {isRemote && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCloudflareRefresh}
              disabled={isBypassingCf}
              className="flex items-center gap-1.5 text-xs bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border border-amber-500/30"
            >
              {isBypassingCf ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Bypassing CF...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Cloudflare Refresh</span>
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    )
  }

  const displaySrc =
    retryKey > 0 ? `${src}${src.includes('?') ? '&' : '?'}cf_retry=${retryKey}` : src

  return (
    <img
      key={retryKey}
      src={displaySrc}
      alt={alt}
      referrerPolicy="no-referrer"
      onLoad={(e) => {
        const w = e.currentTarget.naturalWidth
        const h = e.currentTarget.naturalHeight
        if (w > 0 && h > 0) {
          onDimensions?.({ width: w, height: h })
        }
      }}
      onError={() => setHasError(true)}
      className={className}
      style={style}
      decoding="async"
      loading={priority ? 'eager' : 'lazy'}
      {...({ fetchPriority: priority ? 'high' : 'auto' } as any)}
    />
  )
}

interface VirtualizedWebtoonPageProps {
  url: string
  pageIndex: number
  chapterNumber: number | string
  chapterUrl?: string
  readingMode: string
  readerTheme: string
  cropBorders?: boolean
  isHalfway: boolean
  halfwayRef: React.RefObject<HTMLDivElement | null>
  onRef: (el: HTMLDivElement | null) => void
}

function VirtualizedWebtoonPage({
  url,
  pageIndex,
  chapterNumber,
  chapterUrl,
  readingMode,
  readerTheme,
  cropBorders = false,
  isHalfway,
  halfwayRef,
  onRef
}: VirtualizedWebtoonPageProps) {
  const [isInViewport, setIsInViewport] = useState(pageIndex < 4)
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInViewport(entry.isIntersecting)
        if (entry.boundingClientRect.height > 100) {
          setMeasuredHeight(entry.boundingClientRect.height)
        }
      },
      {
        rootMargin: '2500px 0px 1500px 0px',
        threshold: 0
      }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={(el) => {
        containerRef.current = el
        onRef(el)
      }}
      data-page-index={pageIndex}
      className={cn(
        'w-full flex flex-col relative group items-center justify-center',
        cropBorders && 'overflow-hidden',
        readingMode !== 'webtoon' && 'rounded-lg overflow-hidden shadow-2xl mb-4 last:mb-0',
        readingMode !== 'webtoon' &&
          (readerTheme === 'light' ? 'border border-black/10' : 'border border-white/5')
      )}
      style={{
        minHeight: measuredHeight ? `${measuredHeight}px` : '400px'
      }}
    >
      {isInViewport ? (
        <ReaderImage
          src={url}
          alt={`Page ${pageIndex + 1}`}
          chapterUrl={chapterUrl}
          priority={pageIndex < 4}
          className={cn(
            'w-full h-auto block max-w-full select-none pointer-events-none transition-transform duration-200',
            cropBorders && 'scale-[1.06] origin-center'
          )}
        />
      ) : (
        <div
          className="w-full flex items-center justify-center bg-secondary/5 text-muted-foreground/30 text-xs font-mono select-none"
          style={{ height: measuredHeight ? `${measuredHeight}px` : '400px' }}
        >
          Page {pageIndex + 1}
        </div>
      )}

      {isHalfway && (
        <div
          ref={halfwayRef as any}
          className="absolute inset-x-0 bottom-0 h-1 pointer-events-none opacity-0"
        />
      )}

      <div className="absolute bottom-4 left-4 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 backdrop-blur-sm text-[10px] font-mono px-2 py-0.5 rounded border border-white/10 text-neutral-400 z-10 pointer-events-none shadow-lg">
        CH {chapterNumber} • PAGE {pageIndex + 1}
      </div>
    </div>
  )
}

export const ChapterSection = memo(
  ({
    chapter,
    mangaId,
    pkg,
    readingMode,
    readerTheme,
    cropBorders = false,
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
    zoomLevel,
    pageDimensions,
    onPageDimensions
  }: ChapterSectionProps) => {
    const { data: pages = [], isLoading } = useChapterPages(mangaId, pkg, chapter)
    const isDouble = readingMode === 'paged-double-ltr' || readingMode === 'paged-double-rtl'
    const handlePreloaderDimensions = useCallback(
      (pageNumber: number, dimensions: PageDimensions) => {
        onPageDimensions?.(chapter.id, pageNumber, dimensions)
      },
      [chapter.id, onPageDimensions]
    )
    useImagePreloader(pages, currentPage, isDouble ? handlePreloaderDimensions : undefined)
    const halfwayRef = useRef<HTMLDivElement>(null)
    const sectionRef = useRef<HTMLDivElement>(null)
    const halfwayTriggered = useRef(false)
    const pageRefs = useRef<(HTMLDivElement | null)[]>([])

    const onVisibleRef = useRef(onVisible)
    onVisibleRef.current = onVisible

    const onHalfwayRef = useRef(onHalfway)
    onHalfwayRef.current = onHalfway

    const onPageVisibleRef = useRef(onPageVisible)
    onPageVisibleRef.current = onPageVisible

    const isVertical = readingMode === 'continuous-vertical' || readingMode === 'webtoon'
    const isPaged = readingMode.startsWith('paged-')
    const isHorizontal = readingMode.startsWith('continuous-') && !isVertical

    useEffect(() => {
      if (pages.length > 0) {
        onLoaded(chapter.id, pages.length)
      }
    }, [pages.length, chapter.id, onLoaded])

    // --- Halfway & section visibility observers ---
    useEffect(() => {
      if (pages.length === 0) return

      if (isPaged) {
        // In paged mode, there's only one chapter visible at a time
        onVisibleRef.current(chapter)
        return
      }

      const halfwayObserver = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && !halfwayTriggered.current) {
            halfwayTriggered.current = true
            onHalfwayRef.current(chapter)
          }
        },
        { root: scrollRoot, threshold: 0, rootMargin: '0px 0px 400% 0px' }
      )

      const visibilityObserver = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            onVisibleRef.current(chapter)
          }
        },
        { root: scrollRoot, threshold: 0, rootMargin: '-10% 0px -70% 0px' }
      )

      if (halfwayRef.current) halfwayObserver.observe(halfwayRef.current)
      if (sectionRef.current) visibilityObserver.observe(sectionRef.current)

      return () => {
        halfwayObserver.disconnect()
        visibilityObserver.disconnect()
      }
    }, [pages.length, chapter, isPaged, scrollRoot])

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
            onPageVisibleRef.current(chapter.id, idx + 1)
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
    }, [pages.length, isVertical, scrollRoot, chapter.id])

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

    const isDoubleRtl = readingMode === 'paged-double-rtl'
    const isPagedRtl = readingMode === 'paged-rtl' || isDoubleRtl
    const doubleSlot = isDouble
      ? getDoublePageSlot(pages.length, currentPage, pageDimensions)
      : null
    const pagedPageNumbers =
      isDouble && doubleSlot
        ? doubleSlot.pages.length === 2 && isDoubleRtl
          ? [doubleSlot.pages[1], doubleSlot.pages[0]]
          : doubleSlot.pages
        : [currentPage]
    const isPairedView = pagedPageNumbers.length === 2

    const handleModeClick = (e: React.MouseEvent) => {
      if (isDragging || dragMoved) return
      if (isPaged) {
        const x = e.clientX
        const width = window.innerWidth
        if (x < width / 3) isPagedRtl ? onNextPage() : onPrevPage()
        else if (x > (width * 2) / 3) isPagedRtl ? onPrevPage() : onNextPage()
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
            <div
              className="flex items-center justify-center min-w-full min-h-full m-auto gap-2"
              style={
                zoomLevel !== 1
                  ? { transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }
                  : undefined
              }
            >
              {pagedPageNumbers.map((pageNum) => {
                const pageUrl = pages[pageNum - 1]
                if (!pageUrl) return null
                const dims = pageDimensions?.[pageNum]
                const isWideSolo = !isPairedView && Boolean(doubleSlot?.isWideSpread)
                const wideSpreadStyle =
                  isWideSolo && dims && dims.height > 0
                    ? {
                        width: `min(96vw, calc((100vh - 4rem) * ${(dims.width / dims.height).toFixed(4)}))`,
                        height: 'auto'
                      }
                    : undefined

                return (
                  <ReaderImage
                    key={pageUrl}
                    src={pageUrl}
                    alt={`Page ${pageNum}`}
                    chapterUrl={chapter.url}
                    style={wideSpreadStyle}
                    onDimensions={
                      isDouble && onPageDimensions
                        ? (measured) => onPageDimensions(chapter.id, pageNum, measured)
                        : undefined
                    }
                    className={cn(
                      'max-h-[calc(100vh-4rem)] object-contain select-none pointer-events-none animate-in fade-in zoom-in-95 duration-300 shadow-2xl',
                      isPairedView ? 'max-w-[48vw]' : 'max-w-[96vw]'
                    )}
                  />
                )
              })}
            </div>

            <div
              className="absolute bottom-10 flex gap-4 z-20"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                variant="outline"
                size="icon"
                onClick={isPagedRtl ? onNextPage : onPrevPage}
                className="rounded-full bg-black/60 border-neutral-800 shadow-lg"
              >
                <ChevronLeft className="h-5 w-5 text-white" />
              </Button>
              <div className="bg-black/60 backdrop-blur-md px-6 py-2 rounded-full border border-white/10 text-sm font-bold font-mono tracking-tighter shadow-2xl text-neutral-100 min-w-[100px] text-center">
                {isDouble && doubleSlot && doubleSlot.pages.length === 2
                  ? `${doubleSlot.pages[0]}-${doubleSlot.pages[1]} / ${pages.length}`
                  : isDouble && doubleSlot && doubleSlot.pages.length === 1
                    ? `${doubleSlot.pages[0]} / ${pages.length}`
                    : `${currentPage} / ${pages.length}`}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={isPagedRtl ? onPrevPage : onNextPage}
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
                data-page-index={i}
                className="shrink-0 flex items-center justify-center bg-neutral-900/20 rounded-2xl overflow-hidden border border-white/5 shadow-2xl backdrop-blur-sm pointer-events-none"
                style={{ height: `calc((100vh - 3.5rem) * ${zoomLevel})` }}
              >
                <ReaderImage
                  src={url}
                  alt={`Page ${i + 1}`}
                  chapterUrl={chapter.url}
                  className="h-full w-auto object-contain select-none"
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
              <VirtualizedWebtoonPage
                key={`${url}-${i}`}
                url={url}
                pageIndex={i}
                chapterNumber={chapter.number}
                chapterUrl={chapter.url}
                readingMode={readingMode}
                readerTheme={readerTheme}
                cropBorders={cropBorders}
                isHalfway={i === Math.floor(pages.length / 2)}
                halfwayRef={halfwayRef}
                onRef={(el) => {
                  pageRefs.current[i] = el
                }}
              />
            ))}
          </div>
        )}
      </div>
    )
  }
)
