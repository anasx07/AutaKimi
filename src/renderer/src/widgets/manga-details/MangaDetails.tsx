import { DataService } from '@renderer/shared/api'
import { useEffect, useState, useRef } from 'react'
import { 
  ArrowLeft, BookOpen, Clock, Heart, Play, RefreshCw, CheckCircle, 
  Eye, EyeOff, Loader2, Share2, Download, MoreVertical, ShieldAlert, Globe, 
  Search, Filter, ChevronDown, ChevronUp, ExternalLink, ShieldCheck
} from 'lucide-react'
import { useUIStore, useLibraryStore, useDownloadStore } from '@renderer/shared/model'
import { cn } from '@renderer/shared/lib/utils'
import { Button, Badge, Card, Input, Tooltip, DownloadBadge } from '@renderer/shared/ui'

import { useMangaDetails, useMangaChapters, useToggleLibrary, useLibraryItems } from '@renderer/entities/manga/api/useMangaQueries'
import { normalizeManga } from '@common/utils/mangaNormalizer'
import { Chapter } from '@renderer/shared/api/sources/types'
import { ExtensionResolver } from '@renderer/shared/api/sources/resolver'
import { getNativeSource } from '@renderer/shared/api/sources'

export default function MangaDetails() {
  const { setActiveTab } = useUIStore()
  const {
    selectedManga, setSelectedManga,
    setActiveChapter, activeExtension, installedExtensions,
    readingProgress, pageProgress, loadProgress, markChapterRead,
    defaultChapterSort
  } = useLibraryStore()
  const { downloadQueue, addToDownloadQueue } = useDownloadStore()
  const { detailQuery, chaptersQuery } = (() => {
    // We use a small wrapper to handle the query logic
    const d = useMangaDetails(selectedManga?.id || '', activeExtension)
    const c = useMangaChapters(selectedManga?.id || '', activeExtension)
    return { detailQuery: d, chaptersQuery: c }
  })()

  const { data: chapters = [] } = chaptersQuery
  const loading = detailQuery.isLoading || chaptersQuery.isLoading
  const error = (detailQuery.error as Error)?.message || (chaptersQuery.error as Error)?.message || null
  
  const toggleLibraryMutation = useToggleLibrary()
  const { data: libraryItems = [] } = useLibraryItems()

  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(defaultChapterSort)
  const [descExpanded, setDescExpanded] = useState(false)
  const [chapterSearch, setChapterSearch] = useState('')
  const [showChapterSearch, setShowChapterSearch] = useState(false)
  const [downloadStatuses, setDownloadStatuses] = useState<Record<string, any>>({})
  const [showDownloadMenu, setShowDownloadMenu] = useState(false)
  const downloadMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(event.target as Node)) {
        setShowDownloadMenu(false)
      }
    }
    if (showDownloadMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showDownloadMenu])

  const readChapterIds = selectedManga ? (readingProgress[selectedManga.id] || []) : []
  const isInLibrary = libraryItems.some(m => m.id === selectedManga?.id)

  const extension = installedExtensions.find(e => e.pkg === activeExtension)
  const pkgParts = activeExtension ? activeExtension.split('.') : []
  const extLang = extension?.lang || (pkgParts.length >= 5 ? pkgParts[3] : (pkgParts.length >= 4 ? pkgParts[3] : 'all'))

  const manga = normalizeManga(selectedManga, extLang);

  useEffect(() => {
    if (selectedManga) loadProgress(selectedManga.id)
  }, [selectedManga?.id])

  // Sync enriched details back to store if they've changed
  useEffect(() => {
    if (detailQuery.data && selectedManga) {
      const fresh = detailQuery.data
      const hasChanged = 
        fresh.description !== selectedManga.description ||
        fresh.status !== selectedManga.status ||
        fresh.author !== selectedManga.author ||
        fresh.artist !== selectedManga.artist

      if (hasChanged) {
        setSelectedManga({
          ...selectedManga,
          ...fresh
        })
      }
    }
  }, [detailQuery.data, selectedManga?.id])

  useEffect(() => {
    setSortOrder(defaultChapterSort)
  }, [defaultChapterSort])

  useEffect(() => {
    let interval: any;
    if (selectedManga) {
      const poll = async () => {
        const downloads = await DataService.download.getMangaDownloads(selectedManga.id)
        if (downloads) {
          const statusMap = downloads.reduce((acc: any, d: any) => {
            acc[d.chapterId] = d
            return acc
          }, {})
          setDownloadStatuses(statusMap)
        }
      }
      poll()
      interval = setInterval(poll, 3000)
    }
    return () => clearInterval(interval)
  }, [selectedManga?.id])

  const handleDownload = async (chapter: Chapter) => {
    if (!selectedManga || !activeExtension) return
    try {
      setDownloadStatuses(prev => ({ 
        ...prev, 
        [chapter.id]: { status: 'downloading', cachedPages: 0, totalPages: 0 } 
      }))
      
      const runner = await ExtensionResolver.resolve(activeExtension)
      if (!runner) throw new Error('Extension not found')
      
      const pages = await runner.fetchPages(chapter.url)
      if (!pages || pages.length === 0) throw new Error('No pages found')

      await DataService.download.start({
        mangaId: selectedManga.id,
        chapterId: chapter.id,
        pageUrls: pages
      })
    } catch (err: any) {
      setDownloadStatuses(prev => ({ 
        ...prev, 
        [chapter.id]: { status: 'error', error: err.message } 
      }))
    }
  }

  const handleBulkDownload = (type: 'all' | 'unread' | 'next-5' | 'next-10') => {
    setShowDownloadMenu(false)
    if (!selectedManga || !activeExtension) return

    const ascChapters = [...chapters].sort((a,b) => (a.number || 0) - (b.number || 0))
    const unreadChapters = ascChapters.filter(c => !readChapterIds.includes(c.id))

    let targetChapters: Chapter[] = []
    if (type === 'all') targetChapters = ascChapters
    else if (type === 'unread') targetChapters = unreadChapters
    else if (type === 'next-5') targetChapters = unreadChapters.slice(0, 5)
    else if (type === 'next-10') targetChapters = unreadChapters.slice(0, 10)

    const toDownload = targetChapters.filter(c => {
      const isDownloaded = downloadStatuses[c.id]?.status === 'completed'
      const isQueued = downloadQueue.some(q => q.chapter.id === c.id)
      const isDownloading = downloadStatuses[c.id]?.status === 'downloading'
      return !isDownloaded && !isQueued && !isDownloading
    })

    if (toDownload.length === 0) return

    const queueItems = toDownload.map(c => ({
      mangaId: selectedManga.id,
      extension: activeExtension,
      chapter: c
    }))

    addToDownloadQueue(queueItems)
  }

  if (!selectedManga) return null

  const title = manga.title
  const coverUrl = manga.coverUrl

  const sortedChapters = [...chapters].sort((a, b) => {
    const numA = a.number || 0
    const numB = b.number || 0
    return sortOrder === 'desc' ? numB - numA : numA - numB
  })

  const nextToRead = (() => {
    if (chapters.length === 0) return null
    
    // 1. Prioritize chapter with active progress (> 1 and not fully read)
    const progMap = selectedManga ? pageProgress[selectedManga.id] : null
    if (progMap) {
      // Find a chapter that has progress but isn't marked as read yet
      const chapterWithProgress = Object.entries(progMap)
        .filter(([id, page]) => page > 1 && !readChapterIds.includes(id))
        .sort((a, b) => b[1] - a[1])[0] // Highest page first as heuristic

      if (chapterWithProgress) {
        const found = chapters.find(c => c.id === chapterWithProgress[0])
        if (found) return found
      }
    }

    // 2. Otherwise find the first unread chapter (lowest number)
    const ascChapters = [...chapters].sort((a,b) => 
      (a.number || 0) - (b.number || 0)
    )
    const firstUnread = ascChapters.find(c => !readChapterIds.includes(c.id))
    if (firstUnread) return firstUnread

    // 3. Fallback to the first chapter if everything is read
    return ascChapters[0] || null
  })()

  const filteredChapters = sortedChapters.filter(c => 
    c.number?.toString().toLowerCase().includes(chapterSearch.toLowerCase()) ||
    c.title.toLowerCase().includes(chapterSearch.toLowerCase())
  )

  const chapterPrefix = extLang === 'ar' ? 'الفصل' : 'Chapter'

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-y-auto">
      {/* Top Header Bar */}
      <div className="sticky top-0 z-50 flex items-center justify-between p-4 bg-background/60 backdrop-blur-md border-b border-border/50">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => setSelectedManga(null)}
          className="h-8 w-8"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-amber-500 hover:text-amber-600 hover:bg-amber-500/10" 
            title="Solve Cloudflare"
            onClick={() => manga.url && DataService.openInternalBrowser(manga.url)}
          >
            <ShieldAlert className="h-4.5 w-4.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => manga.url && DataService.openExternal(manga.url)}>
            <Share2 className="h-4.5 w-4.5" />
          </Button>
          <div className="relative" ref={downloadMenuRef}>
            <Button 
              variant="ghost" 
              size="icon" 
              className={cn("h-8 w-8", showDownloadMenu && "bg-secondary/40")}
              onClick={() => setShowDownloadMenu(!showDownloadMenu)}
            >
              <Download className="h-4.5 w-4.5" />
            </Button>
            {showDownloadMenu && (
              <div className="absolute top-10 right-0 z-50 w-48 bg-card border border-border shadow-md rounded-md overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="p-1 space-y-0.5">
                    <button 
                      onClick={() => handleBulkDownload('unread')}
                      className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-secondary/50 rounded-sm transition-colors font-medium"
                    >
                      Download Unread
                    </button>
                    <button 
                      onClick={() => handleBulkDownload('next-5')}
                      className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-secondary/50 rounded-sm transition-colors font-medium"
                    >
                      Download Next 5
                    </button>
                    <button 
                      onClick={() => handleBulkDownload('next-10')}
                      className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-secondary/50 rounded-sm transition-colors font-medium"
                    >
                      Download Next 10
                    </button>
                    <div className="h-px w-full bg-border/50 my-1"></div>
                    <button 
                      onClick={() => handleBulkDownload('all')}
                      className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-secondary/50 rounded-sm transition-colors font-medium"
                    >
                      Download All
                    </button>
                  </div>
              </div>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreVertical className="h-4.5 w-4.5" />
          </Button>
        </div>
      </div>

      {/* Hero Section */}
      <div className="relative w-full overflow-hidden flex-shrink-0 pt-4 px-6 pb-6 border-b border-border/10">
        {coverUrl && (
          <div className="absolute inset-0 z-0">
             <img src={coverUrl} alt="" className="w-full h-full object-cover blur-3xl opacity-20 scale-125" />
             <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent"></div>
          </div>
        )}
        
        <div className="relative z-10 flex gap-6 max-w-7xl mx-auto w-full">
          <Card className="w-32 h-44 sm:w-40 sm:h-56 flex-shrink-0 border-white/10 shadow-2xl overflow-hidden rounded-lg">
            {coverUrl ? (
              <img src={coverUrl} alt={title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-secondary/50">
                <BookOpen className="h-12 w-12 text-muted-foreground/40" />
              </div>
            )}
          </Card>

          <div className="flex-1 flex flex-col justify-end pb-1 space-y-1.5 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground line-clamp-2 leading-tight">
              {title}
            </h1>
            
            <div className="space-y-1">
              {manga.author && (
                <p className="text-sm font-medium text-muted-foreground truncate">
                  {manga.author}
                </p>
              )}
              
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm">
                <div className="flex items-center gap-1 text-green-500 font-semibold">
                  <CheckCircle className="h-3.5 w-3.5 fill-current" />
                  <span className="capitalize">{manga.status}</span>
                </div>
                <span className="text-muted-foreground/40">•</span>
                <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                  <Tooltip content={`Browse ${extension?.name || activeExtension?.split('.').pop()}`} position="top">
                    <button 
                      onClick={() => {
                        setActiveTab('browse')
                        setSelectedManga(null)
                      }}
                      className="hover:text-primary hover:underline underline-offset-2 transition-colors duration-150"
                    >
                      {extension?.name || activeExtension?.split('.').pop()} ({extLang.toUpperCase()})
                    </button>
                  </Tooltip>
                  {activeExtension && getNativeSource(activeExtension) && (
                    ['ma.lmanwa.extension.ar.mangaswat', 'ma.lmanwa.extension.ar.teamx'].includes(activeExtension) ? (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4.5 bg-emerald-500/10 text-emerald-500 border-emerald-500/20 gap-1 font-bold">
                        <ShieldCheck className="h-3 w-3" />
                        SUPPORTED
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4.5 bg-amber-500/10 text-amber-500 border-amber-500/20 gap-1 font-bold">
                        <ShieldAlert className="h-3 w-3" />
                        NOT YET SUPPORTED
                      </Badge>
                    )
                  )}
                </span>
              </div>
              
              {manga.url && (
                <button 
                  onClick={() => DataService.openExternal(manga.url!)}
                  className="text-xs text-muted-foreground/60 hover:text-primary transition-colors truncate max-w-full flex items-center gap-1 mt-1 underline underline-offset-2"
                >
                  <ExternalLink className="h-3 w-3 flex-shrink-0" />
                  {manga.url}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Action Tab Bar */}
      <div className="flex items-center justify-around py-3 px-6 max-w-7xl mx-auto w-full border-b border-border/50">
        <button 
          onClick={() => toggleLibraryMutation.mutate(selectedManga)}
          disabled={toggleLibraryMutation.isPending}
          className={cn(
            "flex flex-col items-center gap-1 group flex-1 transition-colors",
            isInLibrary ? "text-primary" : "text-muted-foreground hover:text-foreground",
            toggleLibraryMutation.isPending && "opacity-50"
          )}
        >
          <Heart className={cn("h-5 w-5", isInLibrary && "fill-current")} />
          <span className="text-[11px] font-semibold">{isInLibrary ? 'In library' : 'Add to library'}</span>
        </button>
        
        <div className="h-8 w-px bg-border/50 mx-2"></div>
        
        <button className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground group flex-1 disabled:opacity-50">
          <RefreshCw className="h-5 w-5" />
          <span className="text-[11px] font-semibold">Tracking</span>
        </button>
        
        <div className="h-8 w-px bg-border/50 mx-2"></div>

        <button 
          onClick={() => manga.url && DataService.openExternal(manga.url)}
          className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground group flex-1"
        >
          <Globe className="h-5 w-5" />
          <span className="text-[11px] font-semibold">Web View</span>
        </button>
      </div>

      <div className="p-6 max-w-7xl mx-auto w-full flex-1 space-y-6">
        {/* Synopsis & Genres */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Synopsis</h2>
            <Button 
               variant="ghost" 
               size="sm" 
               className="h-8 text-xs gap-1 text-muted-foreground"
               onClick={() => setDescExpanded(!descExpanded)}
            >
              {descExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {descExpanded ? 'Show less' : 'Show more'}
            </Button>
          </div>
          
          <div className="relative">
            <p className={cn(
              "text-sm text-foreground/90 leading-relaxed whitespace-pre-line transition-all duration-300",
              !descExpanded && "line-clamp-3"
            )}>
              {manga.description}
            </p>
            {!descExpanded && manga.description.length > 200 && (
              <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent pointer-events-none"></div>
            )}
          </div>

          {manga.genres && manga.genres.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {manga.genres.map((genre) => (
                <Badge 
                  key={genre} 
                  variant="secondary" 
                  className="px-3 py-1 rounded-full text-xs font-medium border-border/40 hover:bg-secondary/80 transition-colors"
                >
                  {genre}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Continue Reading Banner */}
        {!loading && !error && chapters.length > 0 && nextToRead && (
          <Button 
            className="w-full h-14 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 flex items-center justify-center gap-3 rounded-xl transition-all active:scale-[0.99] group overflow-hidden relative"
            onClick={() => setActiveChapter(nextToRead)}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/5 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
            <Play className="h-5 w-5 fill-current" />
            <div className="flex flex-col items-start leading-tight">
              <span className="text-[10px] uppercase tracking-wider font-bold opacity-70">
                {(() => {
                  const page = selectedManga && pageProgress[selectedManga.id]?.[nextToRead.id]
                  const isRead = readChapterIds.includes(nextToRead.id)
                  if (page && page > 1 && !isRead) return 'Resume'
                  if (isRead) return 'Re-read'
                  return 'Start Reading'
                })()}
              </span>
              <span className="text-sm font-semibold truncate max-w-[280px] sm:max-w-md">
                Chapter {nextToRead.number} {nextToRead.title ? `- ${nextToRead.title}` : ''}
              </span>
            </div>
          </Button>
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{chapters.length} Chapters</h2>
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="icon" 
                className={cn("h-8 w-8", showChapterSearch && "text-primary bg-primary/10")}
                onClick={() => setShowChapterSearch(!showChapterSearch)}
              >
                <Search className="h-4 w-4" />
              </Button>
              <Tooltip content="You can change default sort by from Settings" position="top">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-xs h-8 gap-1 text-muted-foreground hover:text-foreground"
                  onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                >
                  {sortOrder === 'desc' ? <Clock className="h-3.5 w-3.5 rotate-180" /> : <Clock className="h-3.5 w-3.5" />}
                </Button>
              </Tooltip>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground opacity-50 cursor-not-allowed">
                <Filter className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.location.reload()}>
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {showChapterSearch && (
            <div className="relative animate-in slide-in-from-top-2 duration-200">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search chapter..." 
                className="pl-9 h-9"
                value={chapterSearch}
                onChange={(e) => setChapterSearch(e.target.value)}
                autoFocus
              />
            </div>
          )}

          {loading && (
            <div className="flex justify-center py-12 text-muted-foreground gap-2 items-center">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading chapters...</span>
            </div>
          )}

          {error && (
            <Badge variant="destructive" className="w-full justify-start p-4 text-sm font-normal">
              {error}
            </Badge>
          )}

          {!loading && !error && chapters.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">No chapters found for this translation.</div>
          )}

          <div className="divide-y divide-border border border-border/50 rounded-xl bg-card/30 overflow-hidden max-h-[600px] overflow-y-auto">
            {filteredChapters.map((chapter) => {
              const isRead = readChapterIds.includes(chapter.id)
              const isQueued = downloadQueue.some(q => q.chapter.id === chapter.id)
              const dateObj = new Date(chapter.date || new Date())
              const formattedDate = !isNaN(dateObj.getTime()) 
                ? dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : 'N/A'

              return (
                <div 
                  key={chapter.id}
                  className={cn(
                    "flex items-center justify-between w-full px-4 py-3.5 hover:bg-secondary/30 transition-colors group",
                    isRead && "opacity-60"
                  )}
                >
                  <button
                    onClick={() => setActiveChapter(chapter)}
                    className="flex-1 flex flex-col items-start text-left min-w-0 pr-4"
                  >
                    <div className="flex items-center gap-2 max-w-full">
                       <span className={cn(
                        "font-semibold text-[13px] sm:text-sm transition-colors truncate",
                        isRead ? "text-muted-foreground" : "text-foreground group-hover:text-primary"
                      )}>
                        {chapterPrefix} {chapter.number}
                      </span>
                      {isRead && <CheckCircle className="h-3 w-3 text-green-500 fill-green-500/10" />}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate w-full mt-0.5">
                      {formattedDate} {chapter.title ? `• ${chapter.title}` : ''} {(() => {
                        const page = selectedManga && pageProgress[selectedManga.id]?.[chapter.id];
                        return page && page > 0 ? `• Page ${page}` : '';
                      })()}
                    </p>
                  </button>
                  
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (selectedManga) markChapterRead(selectedManga.id, chapter.id, !isRead)
                      }}
                      className="h-9 w-9 text-muted-foreground hover:text-foreground"
                      title={isRead ? "Mark as unread" : "Mark as read"}
                    >
                      {isRead ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className={cn(
                        "h-9 w-9 text-muted-foreground hover:text-foreground",
                        downloadStatuses[chapter.id]?.status === 'downloading' && "text-blue-400"
                      )}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (!isQueued && downloadStatuses[chapter.id]?.status !== 'downloading' && downloadStatuses[chapter.id]?.status !== 'completed') {
                          handleDownload(chapter)
                        }
                      }}
                    >
                      {isQueued ? (
                        <DownloadBadge status="pending" progress={{ cached: 0, total: 1 }} />
                      ) : downloadStatuses[chapter.id] ? (
                        <DownloadBadge 
                          status={downloadStatuses[chapter.id].status} 
                          progress={{ 
                            cached: downloadStatuses[chapter.id].cachedPages, 
                            total: downloadStatuses[chapter.id].totalPages 
                          }} 
                        />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              )
            })}
            {!loading && filteredChapters.length === 0 && (
              <div className="text-center py-12 text-muted-foreground text-sm italic">
                {chapterSearch ? `No chapters matching "${chapterSearch}"` : 'No chapters available.'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
