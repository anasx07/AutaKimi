import { useEffect, useState, useRef } from 'react'
import { TitleBar } from '@renderer/widgets/title-bar'
import { ArrowLeft, Loader2, Maximize2, Minimize2, ChevronLeft, ChevronRight, Settings } from 'lucide-react'
import { 
  useUIStore, 
  useLibraryStore, 
  useReaderStore, 
  useHistoryStore, 
  useProgressStore,
  useExtensionStore
} from '@renderer/shared/model'
import { Button } from '@renderer/shared/ui'
import { cn } from '@renderer/shared/lib/utils'
import { useChapterPages } from '@renderer/entities/manga/api/useMangaQueries'

export default function ChapterReader() {
  const { setGlobalError } = useUIStore()
  const { activeChapter, setActiveChapter, selectedManga } = useLibraryStore()
  const { activeExtension } = useExtensionStore()
  const { addHistoryEntry } = useHistoryStore()
  const { markChapterRead, loadProgress, pageProgress } = useProgressStore()
  const { readerMode, readerDirection, preloadPages } = useReaderStore()

  const { data: pages = [], isLoading: loading, error: queryError } = useChapterPages(
    selectedManga?.id || '',
    activeExtension || '',
    activeChapter
  )
  const error = (queryError as Error)?.message || null

  const [isFullscreen, setIsFullscreen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [isRestored, setIsRestored] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Track reading history
  useEffect(() => {
    const startTime = Date.now()
    const isoStart = new Date().toISOString()
    
    const mangaData = selectedManga ? {
      id: selectedManga.id,
      title: selectedManga.title,
      cover: selectedManga.coverUrl,
      url: selectedManga.url
    } : null
    const chapterData = activeChapter ? {
      id: activeChapter.id,
      title: activeChapter.title
    } : null
    const ext = activeExtension

    return () => {
      if (mangaData && chapterData) {
        const duration = Math.round((Date.now() - startTime) / 1000)
        if (duration > 3) {
          addHistoryEntry({
            mangaId: mangaData.id,
            mangaTitle: mangaData.title,
            mangaCover: mangaData.cover || undefined,
            mangaUrl: mangaData.url || undefined,
            chapterId: chapterData.id,
            chapterTitle: chapterData.title || undefined,
            startedAt: isoStart,
            durationSeconds: duration,
            pkg: ext || undefined
          })
        }
      }
    }
  }, [addHistoryEntry])

  useEffect(() => {
    if (error) setGlobalError(error)
  }, [error, setGlobalError])

  useEffect(() => {
    if (scrollRef.current && !loading) scrollRef.current.scrollTop = 0
  }, [activeChapter?.id, loading])

  // Restore progress on pages load
  useEffect(() => {
    if (!selectedManga || !activeChapter || loading || pages.length === 0) return

    const restoreProgress = async () => {
      try {
        await loadProgress(selectedManga.id)
        const lastPage = pageProgress[selectedManga.id]?.[activeChapter.id]
        
        if (lastPage && lastPage > 1) {
          setCurrentPage(lastPage)
          
          if (readerMode === 'vertical') {
            setTimeout(() => {
              if (scrollRef.current) {
                const pageContainer = scrollRef.current.children[0]
                if (pageContainer) {
                  const pagesElements = pageContainer.children
                  const targetIndex = lastPage - 1
                  if (pagesElements[targetIndex]) {
                    pagesElements[targetIndex].scrollIntoView({ behavior: 'instant', block: 'start' })
                  }
                }
              }
            }, 300)
          }
        }
      } catch (e) {
        console.error('[ChapterReader] Restore failed:', e)
      } finally {
        setIsRestored(true)
      }
    }
    restoreProgress()
  }, [pages.length, activeChapter?.id, loading])

  // Save progress on page change
  useEffect(() => {
    if (!selectedManga || !activeChapter || loading || pages.length === 0 || !isRestored) return

    const saveProgress = async () => {
      try {
        const isRead = currentPage >= pages.length
        await markChapterRead(selectedManga.id, activeChapter.id, isRead, currentPage)
      } catch (e) {
        console.error('[ChapterReader] Failed to save page progress:', e)
      }
    }

    const timer = setTimeout(saveProgress, 1000)
    return () => {
      clearTimeout(timer)
      saveProgress()
    }
  }, [currentPage, selectedManga, activeChapter, loading, pages.length, isRestored, markChapterRead])

  // Preloading Logic
  useEffect(() => {
    if (pages.length > 0) {
      const start = currentPage
      const end = Math.min(pages.length, start + preloadPages)
      for (let i = start; i < end; i++) {
        const img = new Image()
        img.src = pages[i]
      }
    }
  }, [currentPage, pages, preloadPages])

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (readerMode !== 'vertical') return
    const target = e.currentTarget
    const pageContainer = target.children[0]
    if (!pageContainer) return
    const children = pageContainer.children
    for (let i = 0; i < children.length; i++) {
      const child = children[i] as HTMLElement
      const rect = child.getBoundingClientRect()
      if (rect.top >= 0 && rect.top <= window.innerHeight / 2) {
        setCurrentPage(i + 1)
        break
      }
    }
  }

  if (!activeChapter) return null

  const chapter = activeChapter as any
  const title = chapter.attributes?.title || chapter.title || `Chapter ${chapter.attributes?.chapter || chapter.number || chapter.id}`

  return (
    <div className="fixed inset-0 bg-neutral-950 z-[100] flex flex-col overflow-hidden select-none animate-in fade-in duration-300">
      <TitleBar />
      {/* Top Bar */}
      <div className="h-14 bg-neutral-900/80 backdrop-blur-md border-b border-neutral-800 px-4 flex items-center justify-between flex-shrink-0 z-20">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setActiveChapter(null)}
            className="text-neutral-400 hover:text-white hover:bg-neutral-800"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-neutral-100 truncate max-w-[200px] sm:max-w-md">{title}</span>
            <span className="text-[10px] text-neutral-500 font-mono tracking-wider uppercase">{activeExtension || 'Official Source'}</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center bg-neutral-800/50 px-3 py-1 rounded-full border border-neutral-700/50">
             <span className="text-xs font-medium text-neutral-300">
               {currentPage} <span className="text-neutral-500 mx-1">/</span> {pages.length || '?'}
             </span>
          </div>
          
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-neutral-400 hover:text-white">
              <Settings className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="h-8 w-8 text-neutral-400 hover:text-white"
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Reader Frame */}
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto no-scrollbar flex flex-col items-center bg-neutral-950"
      >
        {loading && (
          <div className="flex-1 flex flex-col items-center justify-center text-neutral-500 gap-4">
            <div className="relative">
              <Loader2 className="h-10 w-10 animate-spin text-primary opacity-50" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-2 w-2 bg-primary rounded-full animate-ping" />
              </div>
            </div>
            <p className="text-sm font-medium tracking-wide">Synthesizing Pages...</p>
          </div>
        )}

        {error && (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-destructive/10 border border-destructive/20 p-6 rounded-2xl flex flex-col items-center text-center gap-4">
              <div className="w-12 h-12 bg-destructive/20 rounded-full flex items-center justify-center text-destructive">
                <Maximize2 className="h-6 w-6 rotate-45" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-foreground">Content Unavailable</h3>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
              <Button onClick={() => setActiveChapter(null)} variant="outline" size="sm">
                Return to Library
              </Button>
            </div>
          </div>
        )}

        {!loading && !error && readerMode === 'vertical' && (
          <div className="w-full flex flex-col items-center">
            {pages.map((url, i) => (
              <div key={`${url}-${i}`} className="w-full max-w-4xl flex flex-col relative group bg-neutral-950 items-center justify-center min-h-[100px]">
                <div className="absolute inset-0 flex items-center justify-center -z-10">
                   <Loader2 className="h-6 w-6 animate-spin text-neutral-800" />
                </div>
                <img 
                  src={url} 
                  alt={`Page ${i + 1}`} 
                  className="w-full h-auto block select-none"
                  loading="lazy"
                />
                <div className="absolute bottom-4 left-4 opacity-0 group-hover:opacity-100 transition-opacity bg-background/60 backdrop-blur-sm text-[10px] font-mono px-2 py-0.5 rounded border border-border/20 text-muted-foreground">
                  PAGE {i + 1}
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && !error && readerMode === 'paged' && pages.length > 0 && (
          <div className="flex-1 w-full flex items-center justify-center relative touch-none overflow-hidden">
             <div 
               className="absolute left-0 top-0 bottom-0 w-1/4 h-full z-10 cursor-pointer" 
               onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
             />
             <div 
               className="absolute right-0 top-0 bottom-0 w-1/4 h-full z-10 cursor-pointer"
               onClick={() => setCurrentPage(prev => Math.min(pages.length, prev + 1))}
             />

             <img 
               key={pages[currentPage - 1]}
               src={pages[currentPage - 1]} 
               alt={`Page ${currentPage}`} 
               className={cn(
                 "max-h-full max-w-full object-contain select-none animate-in fade-in zoom-in-95 duration-200"
               )}
               style={{ 
                 transform: readerDirection === 'rtl' ? 'scaleX(-1)' : 'none' 
               }}
             />

             <div className="absolute bottom-10 flex gap-4 z-20">
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="rounded-full bg-black/40 backdrop-blur-md border-neutral-700"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-neutral-700 text-sm font-medium">
                   {currentPage} / {pages.length}
                </div>
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={() => setCurrentPage(prev => Math.min(pages.length, prev + 1))}
                  disabled={currentPage === pages.length}
                  className="rounded-full bg-black/40 backdrop-blur-md border-neutral-700"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
             </div>
          </div>
        )}

        {!loading && !error && pages.length > 0 && (
          <div className="w-full max-w-lg py-32 px-6 flex flex-col items-center text-center gap-6">
            <div className="h-px w-full bg-gradient-to-r from-transparent via-neutral-800 to-transparent" />
            <div className="space-y-2">
              <p className="text-lg font-bold text-neutral-200">End of {title}</p>
              <p className="text-sm text-neutral-500">You've reached the last page.</p>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                onClick={() => setActiveChapter(null)}
                variant="outline"
                className="gap-2 border-neutral-800 hover:bg-neutral-800 text-neutral-300"
              >
                <ChevronLeft className="h-4 w-4" /> Back to Details
              </Button>
              <Button className="gap-2">
                Next Chapter <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="h-px w-full bg-gradient-to-r from-transparent via-neutral-800 to-transparent" />
          </div>
        )}
      </div>

      {/* Floating Bottom Progress */}
      {!loading && !error && pages.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 h-1 bg-neutral-900 z-[110]">
          <div 
            className="h-full bg-primary transition-all duration-300 shadow-[0_0_10px_rgba(var(--primary),0.5)]" 
            style={{ width: `${(currentPage / pages.length) * 100}%` }}
          />
        </div>
      )}
    </div>
  )
}
