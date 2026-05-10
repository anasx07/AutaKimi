import { useEffect, useState, useMemo, useRef } from 'react'
import { TitleBar } from '@renderer/widgets/title-bar'
import {
  ArrowLeft,
  Loader2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Play,
  Menu,
  Zap,
  History
} from 'lucide-react'
import {
  useLibraryStore,
  useExtensionStore,
  useProgressStore,
  useHistoryStore,
  useSettingsStore
} from '@renderer/shared/model'
import { Button } from '@renderer/shared/ui'
import { cn } from '@renderer/shared/lib/utils'
import { useMangaChapters } from '@renderer/entities/manga/api/useMangaQueries'
import { DataService } from '@renderer/shared/api'
import { ExtensionResolver } from '@renderer/shared/api/sources/resolver'
import { isMobile } from '@renderer/shared/platform'

export default function AnimeViewer() {
  const mobile = isMobile()
  const { activeChapter, setActiveChapter, selectedManga } = useLibraryStore()
  const { activeExtension } = useExtensionStore()
  const { markChapterRead } = useProgressStore()
  const { addHistoryEntry } = useHistoryStore()

  const { data: episodes = [] } = useMangaChapters(
    selectedManga?.id || '',
    activeExtension || '',
    selectedManga?.url
  )

  const [servers, setServers] = useState<string[]>([])
  const [activeServerIdx, setActiveServerIdx] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const [showDebug, setShowDebug] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [isEpisodesOpen, setIsEpisodesOpen] = useState(false)
  const [isSwitchingServer, setIsSwitchingServer] = useState(false)
  const { autoNextAnime, setAutoNextAnime, autoSwitchServer } = useSettingsStore()

  const controlsTimeoutRef = useRef<any | null>(null)

  // Cinema Mode: Auto-hide controls
  useEffect(() => {
    const handleMouseMove = () => {
      setShowControls(true)
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current)
      controlsTimeoutRef.current = setTimeout(() => {
        if (!isEpisodesOpen) setShowControls(false)
      }, 3500)
    }

    window.addEventListener('mousemove', handleMouseMove)
    handleMouseMove()

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current)
    }
  }, [isEpisodesOpen])

  // Auto-expand debug on error
  useEffect(() => {
    if (error) setShowDebug(true)
  }, [error])

  const sortedEpisodes = useMemo(() => {
    return [...episodes].sort((a, b) => (a.number || 0) - (b.number || 0))
  }, [episodes])

  const currentIndex = sortedEpisodes.findIndex((e) => e.id === activeChapter?.id)
  const nextEpisode =
    currentIndex !== -1 && currentIndex + 1 < sortedEpisodes.length
      ? sortedEpisodes[currentIndex + 1]
      : null
  const prevEpisode =
    currentIndex !== -1 && currentIndex > 0 ? sortedEpisodes[currentIndex - 1] : null

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      switch (e.key.toLowerCase()) {
        case 'n':
          if (nextEpisode) setActiveChapter(nextEpisode)
          break
        case 'p':
          if (prevEpisode) setActiveChapter(prevEpisode)
          break
        case 'm':
          setIsEpisodesOpen((prev) => !prev)
          break
        case 'escape':
          if (isEpisodesOpen) setIsEpisodesOpen(false)
          else setActiveChapter(null)
          break
        case 'r':
          window.location.reload()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [nextEpisode, prevEpisode, isEpisodesOpen, setActiveChapter])

  useEffect(() => {
    const loadServers = async () => {
      if (!activeChapter || !activeExtension) return
      setLoading(true)
      setError(null)
      try {
        console.log(`[AnimeViewer] Resolving source for: ${activeExtension}`)
        const source = await ExtensionResolver.resolve(activeExtension)
        if (!source) throw new Error('Could not resolve extension source.')

        console.log(`[AnimeViewer] Fetching servers from: ${source.name} (v${source.version})`)
        const res: any = await source.fetchPages(activeChapter.url)

        const urls = res?.urls || (Array.isArray(res) ? res : [])
        const debug = res?.debug || null
        setDebugInfo(debug)

        if (urls && urls.length > 0) {
          setServers(urls)

          // Server Preference: Try to find the last used server
          const lastServer = localStorage.getItem('autakimi-anime-preferred-server')
          let targetIdx = 0
          if (lastServer) {
            const prefIdx = urls.findIndex(
              (s: any) => (typeof s === 'object' ? s.name : s) === lastServer
            )
            if (prefIdx !== -1) targetIdx = prefIdx
          }

          setActiveServerIdx(targetIdx)

          // Added: Trigger history immediately when servers are ready
          if (selectedManga && activeChapter) {
            markChapterRead(selectedManga.id, activeChapter.id, true)
            addHistoryEntry({
              mangaId: selectedManga.id,
              mangaTitle: selectedManga.title,
              chapterId: activeChapter.id,
              chapterTitle: activeChapter.title || undefined,
              startedAt: new Date().toISOString(),
              durationSeconds: 0,
              pkg: activeExtension || undefined,
              type: 'anime'
            })
          }
        } else {
          setError('No streaming servers found for this episode.')
        }
      } catch (err: any) {
        console.error('[AnimeViewer] Failed to load servers:', err)
        setError(err?.message || 'Failed to load streaming servers.')
      } finally {
        setLoading(false)
      }
    }

    loadServers()
  }, [activeChapter?.id, activeExtension])

  // Auto-switch server logic
  useEffect(() => {
    if (error && autoSwitchServer && servers.length > 1 && activeServerIdx < servers.length - 1) {
      setIsSwitchingServer(true)
      const timer = setTimeout(() => {
        setActiveServerIdx((prev) => prev + 1)
        setIsSwitchingServer(false)
        setError(null)
      }, 3000)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [error, autoSwitchServer, servers.length, activeServerIdx])

  if (!activeChapter || !selectedManga) return null

  const s = servers[activeServerIdx]
  const activeServerUrl = typeof s === 'object' ? (s as any).url : s

  return (
    <div
      className={cn(
        'fixed inset-0 bg-black z-[100] flex flex-col overflow-hidden animate-in fade-in duration-500 text-white select-none',
        mobile && 'pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]'
      )}
    >
      <TitleBar />

      {/* Top Header Overlay */}
      <div
        className={cn(
          'absolute top-8 left-0 right-0 h-16 bg-gradient-to-b from-black/80 to-transparent backdrop-blur-sm px-6 flex items-center justify-between z-40 transition-all duration-500',
          !showControls && 'translate-y-[-110%] opacity-0 pointer-events-none'
        )}
      >
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setActiveChapter(null)}
            className="h-10 w-10 text-white/70 hover:text-white hover:bg-white/10 rounded-full"
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
        </div>

        {/* Centered Title Section */}
        <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center min-w-0 text-center">
          <h1 className="text-base font-black tracking-tighter text-white truncate max-w-[200px] sm:max-w-md uppercase italic">
            {selectedManga.title}
          </h1>
          <div className="flex items-center gap-2 text-[10px] text-white/40 font-bold uppercase tracking-widest">
            <span className="bg-primary/20 text-primary px-1.5 py-0.5 rounded text-[9px]">
              EP {activeChapter.number}
            </span>
            <span className="truncate max-w-[150px] opacity-60 italic">
              {activeChapter.title || 'Watching Now'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAutoNextAnime(!autoNextAnime)}
            className={cn(
              'h-9 px-3 text-[11px] font-bold rounded-full border transition-all',
              autoNextAnime
                ? 'bg-primary/20 border-primary/50 text-primary hover:bg-primary/30'
                : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
            )}
          >
            <Zap className={cn('h-3.5 w-3.5 mr-2', autoNextAnime && 'fill-current')} />
            Auto-Next
          </Button>

          {servers.length > 1 && (
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-white/5 backdrop-blur-md rounded-full px-4 py-1.5 border border-white/10">
                <span className="text-[10px] text-white/40 font-bold mr-3 uppercase tracking-tighter">
                  Server
                </span>
                <select
                  value={activeServerIdx}
                  onChange={(e) => {
                    const idx = parseInt(e.target.value)
                    setActiveServerIdx(idx)
                    const server = servers[idx]
                    const sName = typeof server === 'object' ? (server as any).name : server
                    if (sName) {
                      localStorage.setItem('autakimi-anime-preferred-server', sName)
                    }
                  }}
                  className="bg-transparent text-xs text-primary font-bold outline-none cursor-pointer min-w-[80px]"
                >
                  {servers.map((s: any, i) => {
                    const name = typeof s === 'object' ? s.name : `Server ${i + 1}`
                    const displayName = name.length > 15 ? name.substring(0, 15) + '...' : name
                    return (
                      <option key={i} value={i} className="bg-neutral-900 text-white">
                        {displayName}
                      </option>
                    )
                  })}
                </select>
              </div>
              <Button
                variant="ghost"
                size="icon"
                title="Mirror/Switch Server"
                onClick={() => {
                  if (activeServerIdx < servers.length - 1) setActiveServerIdx(activeServerIdx + 1)
                  else setActiveServerIdx(0)
                }}
                className="h-9 w-9 text-primary/60 hover:text-primary hover:bg-primary/10 rounded-full"
              >
                <RefreshCw className="h-4.5 w-4.5" />
              </Button>
            </div>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.location.reload()}
            className="h-9 w-9 text-white/60 hover:text-white hover:bg-white/10 rounded-full"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsEpisodesOpen(!isEpisodesOpen)}
            className={cn(
              'h-10 w-10 rounded-full transition-all',
              isEpisodesOpen
                ? 'bg-primary text-white'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            )}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative flex items-center justify-center bg-black group">
        {/* Navigation Overlays (Invisible zones for quick prev/next) */}
        {!loading && !error && (
          <>
            <div
              className={cn(
                'absolute left-0 top-0 bottom-0 w-32 z-30 cursor-pointer transition-all duration-300 bg-gradient-to-r from-black/60 to-transparent flex items-center justify-start pl-8',
                showControls ? 'opacity-100' : 'opacity-0 pointer-events-none',
                !prevEpisode && 'hidden'
              )}
              onClick={() => prevEpisode && setActiveChapter(prevEpisode)}
            >
              <ChevronLeft className="h-12 w-12 text-white/30 hover:text-white/60 transition-colors" />
            </div>

            <div
              className={cn(
                'absolute right-0 top-0 bottom-0 w-32 z-30 cursor-pointer transition-all duration-300 bg-gradient-to-l from-black/60 to-transparent flex items-center justify-end pr-8',
                showControls ? 'opacity-100' : 'opacity-0 pointer-events-none',
                !nextEpisode && 'hidden'
              )}
              onClick={() => nextEpisode && setActiveChapter(nextEpisode)}
            >
              <ChevronRight className="h-12 w-12 text-white/30 hover:text-white/60 transition-colors" />
            </div>
          </>
        )}

        {isSwitchingServer && (
          <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="relative">
              <RefreshCw className="h-16 w-16 text-primary animate-spin opacity-20" />
              <Loader2 className="absolute inset-0 h-16 w-16 text-primary animate-spin" />
            </div>
            <div className="mt-8 text-center space-y-2">
              <h2 className="text-xl font-bold tracking-tight text-white uppercase italic">
                Switching Server
              </h2>
              <p className="text-sm text-white/50 font-medium tracking-widest uppercase animate-pulse">
                Trying alternative source ({activeServerIdx + 2}/{servers.length})
              </p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center gap-4 text-neutral-500">
            <Loader2 className="h-10 w-10 animate-spin text-primary opacity-50" />
            <p className="text-sm font-medium animate-pulse italic tracking-widest uppercase">
              Initializing player...
            </p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-6 p-8 text-center max-w-2xl bg-neutral-900/50 rounded-2xl border border-white/5 backdrop-blur-xl z-20">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
              <Play className="h-8 w-8 rotate-180" />
            </div>
            <div className="space-y-2">
              <p className="text-xl font-bold text-neutral-200">
                {error.includes('No streaming servers') || error.includes('failed to respond')
                  ? 'This Video is not available on this Server at this time.'
                  : error}
              </p>
              <p className="text-sm text-white/40 max-w-md mx-auto italic">
                Please try changing to another server or resolving Cloudflare protection.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button
                onClick={() => DataService.openInternalBrowser(activeChapter.url)}
                className="bg-white text-black hover:bg-neutral-200 gap-2 font-bold"
              >
                <RefreshCw className="h-4 w-4" /> Resolve Cloudflare
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowDebug(!showDebug)}
                className="border-neutral-700 text-neutral-400 gap-2"
              >
                {showDebug ? 'Hide Debug' : 'Show Debug Info'}
              </Button>
              {servers.length > 1 && activeServerIdx < servers.length - 1 && (
                <Button
                  variant="ghost"
                  onClick={() => setActiveServerIdx((prev) => prev + 1)}
                  className="text-primary hover:bg-primary/10 gap-2 font-bold"
                >
                  <RefreshCw className="h-4 w-4" /> Try Next Server
                </Button>
              )}
            </div>

            {showDebug && (
              <div className="w-full mt-4 text-left p-4 bg-black/60 rounded-lg border border-white/10 font-mono text-[10px] space-y-2 overflow-x-auto max-h-60">
                <p className="text-primary font-bold uppercase tracking-wider border-b border-primary/20 pb-1 mb-2">
                  Technical Logs
                </p>
                {debugInfo ? (
                  <>
                    <div className="grid grid-cols-[100px_1fr] gap-x-2 gap-y-1">
                      <span className="text-neutral-500">Target URL:</span>
                      <span className="text-neutral-300 break-all">{debugInfo.url}</span>
                      <span className="text-neutral-500">HTML Bytes:</span>
                      <span
                        className={cn(
                          'font-bold',
                          debugInfo.htmlLength > 1000 ? 'text-green-500' : 'text-red-500'
                        )}
                      >
                        {debugInfo.htmlLength}{' '}
                        {debugInfo.htmlLength < 500 ? '(Likely blocked)' : ''}
                      </span>
                      <span className="text-neutral-500">CF Blocked:</span>
                      <span className={debugInfo.isBlocked ? 'text-amber-500' : 'text-green-500'}>
                        {debugInfo.isBlocked ? 'YES (Challenge Detected)' : 'NO (Clear HTML)'}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded text-[9px] text-amber-200 font-mono">
                      <p>⚠️ No structured telemetry returned from extension.</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : activeServerUrl ? (
          <iframe
            key={activeServerUrl}
            src={activeServerUrl}
            className="w-full h-full border-none shadow-2xl bg-black"
            allowFullScreen
            allow="autoplay; encrypted-media; picture-in-picture"
            referrerPolicy="no-referrer"
            title="Video Player"
            onError={() => {
              if (autoSwitchServer && servers.length > 1 && activeServerIdx < servers.length - 1) {
                setError(`Server ${activeServerIdx + 1} failed to respond.`)
              }
            }}
          />
        ) : null}
      </div>

      {/* Episodes Sidebar Overlay */}
      <div
        className={cn(
          'absolute right-0 top-0 bottom-0 w-80 bg-neutral-900/95 backdrop-blur-2xl border-l border-white/10 z-50 transition-transform duration-500 ease-in-out flex flex-col pt-8',
          !isEpisodesOpen && 'translate-x-full'
        )}
      >
        <div className="h-16 flex items-center justify-between px-6 border-b border-white/5 mt-2">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            Episodes
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsEpisodesOpen(false)}
            className="h-8 w-8 rounded-full"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
          {sortedEpisodes.map((ep) => (
            <button
              key={ep.id}
              onClick={() => {
                setActiveChapter(ep)
                setIsEpisodesOpen(false)
              }}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group',
                ep.id === activeChapter.id
                  ? 'bg-primary text-white shadow-lg shadow-primary/20 font-bold'
                  : 'hover:bg-white/5 text-neutral-400 hover:text-white'
              )}
            >
              <div
                className={cn(
                  'h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold transition-colors',
                  ep.id === activeChapter.id
                    ? 'bg-white/20'
                    : 'bg-neutral-800 group-hover:bg-neutral-700'
                )}
              >
                {ep.number}
              </div>
              <div className="flex flex-col items-start min-w-0">
                <span className="text-[11px] truncate w-full">Episode {ep.number}</span>
                {ep.title && (
                  <span className="text-[9px] opacity-60 truncate w-full">{ep.title}</span>
                )}
              </div>
              {ep.id === activeChapter.id && (
                <Play className="h-3 w-3 ml-auto fill-current animate-pulse" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Bottom Floating Navigation (HUD) */}
      <div
        className={cn(
          'absolute bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-2 p-1 bg-black/40 backdrop-blur-xl border border-white/10 rounded-full z-40 transition-all duration-500',
          !showControls && 'translate-y-[150%] opacity-0 pointer-events-none'
        )}
      >
        <Button
          variant="ghost"
          size="icon"
          disabled={!prevEpisode}
          onClick={() => prevEpisode && setActiveChapter(prevEpisode)}
          className="h-12 w-12 rounded-full text-white/50 hover:text-white hover:bg-white/10 disabled:opacity-20 transition-colors"
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>

        <div className="h-8 w-px bg-white/10 mx-1" />

        <div className="px-6 py-2 flex flex-col items-center justify-center min-w-[140px]">
          <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest leading-none mb-1">
            Playing Now
          </span>
          <span className="text-xs font-bold text-primary tracking-tight">
            EPISODE {activeChapter.number}
          </span>
        </div>

        <div className="h-8 w-px bg-white/10 mx-1" />

        <Button
          variant="ghost"
          size="icon"
          disabled={!nextEpisode}
          onClick={() => nextEpisode && setActiveChapter(nextEpisode)}
          className="h-12 w-12 rounded-full text-white/50 hover:text-white hover:bg-white/10 disabled:opacity-20 transition-colors"
        >
          <ChevronRight className="h-6 w-6" />
        </Button>
      </div>
    </div>
  )
}
