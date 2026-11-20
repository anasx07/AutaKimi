import { useEffect, useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  Search,
  Check,
  ExternalLink,
  Trash2,
  RefreshCw,
  Zap,
  LogIn,
  LogOut,
  Key,
  Plus,
  Minus,
  Loader2
} from 'lucide-react'
import { useTrackerStore } from '@renderer/shared/model'
import { DataService } from '@renderer/shared/api'
import { Tracker, AniListMedia } from '@common/types'
import { Button, Input, Select } from '@renderer/shared/ui'
import { cn } from '@renderer/shared/lib/utils'

interface TrackingModalProps {
  isOpen: boolean
  onClose: () => void
  manga: { id: string; title: string; [key: string]: any }
  mediaType?: 'manga' | 'anime'
}

const ANILIST_STATUSES = [
  { value: 'CURRENT', label: 'Watching / Reading' },
  { value: 'PLANNING', label: 'Plan to Watch / Read' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'PAUSED', label: 'Paused' },
  { value: 'DROPPED', label: 'Dropped' },
  { value: 'REPEATING', label: 'Rewatching / Rereading' }
]

export function TrackingModal({ isOpen, onClose, manga, mediaType = 'manga' }: TrackingModalProps) {
  const {
    currentUser,
    isLoadingUser,
    loadUser,
    loginAniList,
    setTokenAniList,
    logoutAniList,
    trackers,
    loadTrackers,
    saveTracker,
    deleteTracker,
    syncTracker
  } = useTrackerStore()

  const [activeProvider] = useState<'anilist' | 'mal'>('anilist')
  const [searchQuery, setSearchQuery] = useState(manga.title || '')
  const [searchResults, setSearchResults] = useState<AniListMedia[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showTokenInput, setShowTokenInput] = useState(false)
  const [tokenInput, setTokenInput] = useState('')
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError?: boolean } | null>(
    null
  )

  const [linkedMedia, setLinkedMedia] = useState<AniListMedia | null>(null)
  const [editStatus, setEditStatus] = useState<string>('CURRENT')
  const [editProgress, setEditProgress] = useState<number>(0)
  const [editScore, setEditScore] = useState<number>(0)

  const currentTracker = useMemo(() => {
    return trackers[manga.id]?.find((t) => t.provider === activeProvider)
  }, [trackers, manga.id, activeProvider])

  // Load user and trackers on open
  useEffect(() => {
    if (isOpen) {
      loadUser()
      loadTrackers(manga.id)
      setSearchQuery(manga.title || '')
      setStatusMessage(null)
    }
  }, [isOpen, manga.id, loadUser, loadTrackers, manga.title])

  // When a tracker is bound, fetch remote AniList media info
  useEffect(() => {
    if (!currentTracker || !isOpen) {
      setLinkedMedia(null)
      return
    }

    const remoteId = parseInt(currentTracker.remoteId)
    if (!isNaN(remoteId)) {
      DataService.tracker
        .getMediaAniList(remoteId)
        .then((media) => {
          if (media) {
            setLinkedMedia(media)
            setEditStatus(currentTracker.status || media.mediaListEntry?.status || 'CURRENT')
            setEditProgress(currentTracker.lastSyncedChapter ?? media.mediaListEntry?.progress ?? 0)
            setEditScore(currentTracker.score ?? media.mediaListEntry?.score ?? 0)
          }
        })
        .catch((err) => {
          console.error('[TrackingModal] Failed to get AniList media:', err)
        })
    }
  }, [currentTracker, isOpen])

  // Auto-search if logged in and no tracker is bound
  useEffect(() => {
    if (isOpen && currentUser && !currentTracker && !linkedMedia && manga.title) {
      handleSearch(manga.title)
    }
  }, [isOpen, currentUser, currentTracker, linkedMedia, manga.title])

  const handleSearch = async (queryText: string) => {
    if (!queryText.trim()) return
    setIsSearching(true)
    setStatusMessage(null)
    try {
      const type = mediaType === 'anime' ? 'ANIME' : 'MANGA'
      const results = await DataService.tracker.searchAniList(queryText.trim(), type)
      setSearchResults(Array.isArray(results) ? results : [])
    } catch (err: any) {
      console.error('[TrackingModal] Search failed:', err)
      setStatusMessage({ text: err.message || 'Search failed', isError: true })
    } finally {
      setIsSearching(false)
    }
  }

  const handleLogin = async () => {
    setIsLoggingIn(true)
    setStatusMessage(null)
    try {
      await loginAniList()
      setStatusMessage({ text: 'Connected to AniList successfully!' })
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Failed to authenticate with AniList', isError: true })
    } finally {
      setIsLoggingIn(false)
    }
  }

  const handleTokenSubmit = async () => {
    if (!tokenInput.trim()) return
    setIsLoggingIn(true)
    setStatusMessage(null)
    try {
      await setTokenAniList(tokenInput.trim())
      setShowTokenInput(false)
      setTokenInput('')
      setStatusMessage({ text: 'Connected to AniList successfully!' })
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Invalid token', isError: true })
    } finally {
      setIsLoggingIn(false)
    }
  }

  const handleLinkMedia = async (media: AniListMedia) => {
    setIsSaving(true)
    setStatusMessage(null)
    try {
      const initialStatus = media.mediaListEntry?.status || 'CURRENT'
      const initialProgress = media.mediaListEntry?.progress || 0
      const initialScore = media.mediaListEntry?.score || 0

      const tracker: Tracker = {
        mangaId: manga.id,
        provider: 'anilist',
        remoteId: String(media.id),
        status: initialStatus,
        lastSyncedChapter: initialProgress,
        score: initialScore,
        updatedAt: new Date().toISOString()
      }

      await saveTracker(tracker)
      setLinkedMedia(media)
      setEditStatus(initialStatus)
      setEditProgress(initialProgress)
      setEditScore(initialScore)
      setStatusMessage({ text: `Linked to "${media.title.english || media.title.romaji}"!` })
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Failed to link tracker', isError: true })
    } finally {
      setIsSaving(false)
    }
  }

  const handleUnlink = async () => {
    if (!confirm('Unlink this tracker? Your local reading progress will be kept.')) return
    setIsSaving(true)
    setStatusMessage(null)
    try {
      await deleteTracker(manga.id, 'anilist')
      setLinkedMedia(null)
      setStatusMessage({ text: 'Tracker unlinked.' })
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Failed to unlink tracker', isError: true })
    } finally {
      setIsSaving(false)
    }
  }

  const handleSyncNow = async () => {
    if (!currentTracker) return
    setIsSaving(true)
    setStatusMessage(null)
    try {
      const remoteId = parseInt(currentTracker.remoteId)
      await syncTracker(manga.id, remoteId, editStatus, editProgress, editScore)
      setStatusMessage({ text: 'Progress synced to AniList!' })
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Failed to sync with AniList', isError: true })
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-background/85 backdrop-blur-md" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-card border border-border/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200 text-foreground">
        {/* Header */}
        <div className="p-5 border-b border-border/40 flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-[#02A9FF]/10 flex items-center justify-center text-[#02A9FF] font-black text-sm">
              AL
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">Tracking & Progress Sync</h2>
              <p className="text-xs text-muted-foreground truncate max-w-xs">{manga.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
          {/* Status Toast / Alert */}
          {statusMessage && (
            <div
              className={cn(
                'p-3 rounded-xl text-xs font-medium flex items-center justify-between animate-in fade-in',
                statusMessage.isError
                  ? 'bg-destructive/10 text-destructive border border-destructive/20'
                  : 'bg-primary/10 text-primary border border-primary/20'
              )}
            >
              <span>{statusMessage.text}</span>
              <button
                onClick={() => setStatusMessage(null)}
                className="opacity-60 hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Account Status Card */}
          <div className="p-4 rounded-xl border border-border/60 bg-secondary/20 flex items-center justify-between gap-4">
            {isLoadingUser ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                Checking AniList account...
              </div>
            ) : currentUser ? (
              <div className="flex items-center gap-3 min-w-0">
                {currentUser.avatar?.medium ? (
                  <img
                    src={currentUser.avatar.medium}
                    alt={currentUser.name}
                    className="h-9 w-9 rounded-full object-cover border border-primary/30"
                  />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary text-xs">
                    {currentUser.name.substring(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-foreground truncate">
                      {currentUser.name}
                    </span>
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  </div>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                    AniList Connected
                  </span>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-xs font-bold text-foreground">AniList Not Connected</p>
                <p className="text-[11px] text-muted-foreground">
                  Connect to auto-sync read chapters & anime episodes.
                </p>
              </div>
            )}

            <div>
              {currentUser ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={logoutAniList}
                  className="h-8 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-1.5"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Disconnect
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={handleLogin}
                    disabled={isLoggingIn}
                    className="h-8 text-xs font-bold bg-[#02A9FF] hover:bg-[#02A9FF]/90 text-white gap-1.5 shadow-md shadow-[#02A9FF]/20"
                  >
                    {isLoggingIn ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <LogIn className="h-3.5 w-3.5" />
                    )}
                    Log in
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowTokenInput(!showTokenInput)}
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    title="Manual Token Entry"
                  >
                    <Key className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Manual Token Entry Accordion */}
          {showTokenInput && !currentUser && (
            <div className="p-4 rounded-xl border border-border bg-card space-y-3 animate-in fade-in">
              <div className="space-y-1">
                <label className="text-xs font-bold">Personal Access Token</label>
                <p className="text-[10px] text-muted-foreground">
                  Generate a token via AniList Developer settings with redirect to oauth/pin.
                </p>
              </div>
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder="Paste AniList Token..."
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  className="text-xs h-9"
                />
                <Button
                  size="sm"
                  onClick={handleTokenSubmit}
                  disabled={isLoggingIn || !tokenInput.trim()}
                  className="h-9 px-4 text-xs font-bold"
                >
                  Save
                </Button>
              </div>
            </div>
          )}

          {/* Main Area: Linked Media OR Search */}
          {currentUser && (
            <>
              {currentTracker && linkedMedia ? (
                /* LINKED MEDIA VIEW */
                <div className="space-y-4">
                  <div className="p-4 rounded-xl border border-border bg-secondary/10 flex gap-3.5 items-start">
                    {linkedMedia.coverImage?.medium && (
                      <img
                        src={linkedMedia.coverImage.medium}
                        alt="cover"
                        className="h-20 w-14 rounded-lg object-cover flex-shrink-0 shadow-md border border-border/40"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary uppercase">
                          {linkedMedia.type || 'MANGA'}
                        </span>
                        {linkedMedia.format && (
                          <span className="text-[10px] font-semibold text-muted-foreground">
                            {linkedMedia.format}
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-foreground truncate mt-1">
                        {linkedMedia.title.english || linkedMedia.title.romaji}
                      </h3>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span>
                          {mediaType === 'anime'
                            ? `${linkedMedia.episodes || '?'} eps`
                            : `${linkedMedia.chapters || '?'} chs`}
                        </span>
                        <a
                          href={`https://anilist.co/${mediaType === 'anime' ? 'anime' : 'manga'}/${linkedMedia.id}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => {
                            e.preventDefault()
                            DataService.openExternal(
                              `https://anilist.co/${mediaType === 'anime' ? 'anime' : 'manga'}/${linkedMedia.id}`
                            )
                          }}
                          className="text-primary hover:underline flex items-center gap-1 text-[11px]"
                        >
                          AniList Page <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Sync Form */}
                  <div className="p-4 rounded-xl border border-border/80 bg-card space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-muted-foreground">Status</label>
                        <Select
                          value={editStatus}
                          onValueChange={(val) => setEditStatus(val)}
                          options={ANILIST_STATUSES}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-muted-foreground">
                          Score (0 - 100)
                        </label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={editScore}
                          onChange={(e) => setEditScore(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                          className="h-9 text-xs"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-muted-foreground flex items-center justify-between">
                        <span>{mediaType === 'anime' ? 'Episodes Watched' : 'Chapters Read'}</span>
                        <span className="text-[10px] text-muted-foreground font-normal">
                          Max: {linkedMedia.episodes || linkedMedia.chapters || '∞'}
                        </span>
                      </label>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setEditProgress(Math.max(0, editProgress - 1))}
                          className="h-9 w-9 rounded-lg"
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <Input
                          type="number"
                          min={0}
                          value={editProgress}
                          onChange={(e) => setEditProgress(Math.max(0, parseInt(e.target.value) || 0))}
                          className="h-9 text-center text-sm font-bold flex-1"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setEditProgress(editProgress + 1)}
                          className="h-9 w-9 rounded-lg"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-between gap-3 border-t border-border/40">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleUnlink}
                        disabled={isSaving}
                        className="text-xs text-destructive hover:bg-destructive/10 gap-1.5"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Unlink
                      </Button>

                      <Button
                        size="sm"
                        onClick={handleSyncNow}
                        disabled={isSaving}
                        className="text-xs font-bold gap-1.5 px-4"
                      >
                        {isSaving ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5" />
                        )}
                        Sync to AniList
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                /* SEARCH & LINK VIEW */
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-foreground">Find on AniList</label>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault()
                        handleSearch(searchQuery)
                      }}
                      className="flex gap-2"
                    >
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search title on AniList..."
                          className="pl-8 text-xs h-9"
                        />
                      </div>
                      <Button
                        type="submit"
                        size="sm"
                        disabled={isSearching || !searchQuery.trim()}
                        className="h-9 px-3 text-xs font-bold"
                      >
                        {isSearching ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          'Search'
                        )}
                      </Button>
                    </form>
                  </div>

                  {/* Results List */}
                  <div className="space-y-2 pt-1 max-h-60 overflow-y-auto custom-scrollbar">
                    {isSearching ? (
                      <div className="flex flex-col items-center justify-center p-8 text-muted-foreground gap-2">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <span className="text-xs">Searching AniList...</span>
                      </div>
                    ) : searchResults.length > 0 ? (
                      searchResults.map((item) => (
                        <div
                          key={item.id}
                          className="p-2.5 rounded-xl border border-border/60 hover:border-primary/40 bg-card hover:bg-secondary/30 transition-all flex items-center justify-between gap-3 group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {item.coverImage?.medium && (
                              <img
                                src={item.coverImage.medium}
                                alt="cover"
                                className="h-12 w-9 rounded object-cover flex-shrink-0 border border-border/40"
                              />
                            )}
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-foreground truncate">
                                {item.title.english || item.title.romaji}
                              </p>
                              <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium">
                                <span>{item.format || item.type}</span>
                                <span>•</span>
                                <span>
                                  {mediaType === 'anime'
                                    ? `${item.episodes || '?'} eps`
                                    : `${item.chapters || '?'} chs`}
                                </span>
                              </div>
                            </div>
                          </div>

                          <Button
                            size="sm"
                            onClick={() => handleLinkMedia(item)}
                            disabled={isSaving}
                            className="h-7 text-xs font-bold px-3 shrink-0"
                          >
                            <Check className="h-3 w-3 mr-1" />
                            Link
                          </Button>
                        </div>
                      ))
                    ) : (
                      <div className="text-center p-6 text-xs text-muted-foreground italic border border-dashed border-border/60 rounded-xl">
                        No matches found. Try refining the search query.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Automatic Sync Info Footer */}
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 flex items-start gap-2.5 text-[11px] text-muted-foreground">
                <Zap className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>
                  <strong className="text-foreground">Automatic Sync Enabled:</strong> As you read chapters or finish anime episodes, your AniList progress will update automatically in the background.
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
