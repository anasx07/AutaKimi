import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { lazy, Suspense, useEffect, useRef } from 'react'
import { Sidebar } from '../components/Sidebar'
import { MobileBottomNav } from '../components/MobileBottomNav'
import { sharedTabNavigationMemory } from '../components/navigationMemory'
import { shouldAutoEnterPip, usePipPlayerStore } from '../components/pipPlayerStore'
import { TitleBar } from '@renderer/widgets/title-bar'
import { DownloadQueueProcessor } from '@renderer/widgets/download-queue'
import Toast from '@renderer/shared/ui/Toast'
import { UpdaterToast } from '@renderer/shared/ui/UpdaterToast'
import { useAppUpdater } from '../hooks/useAppUpdater'
import { StoreInitializer } from '../StoreInitializer'
import { useLibraryStore } from '@renderer/shared/model'
import { ErrorBoundary } from '@renderer/shared/ui/ErrorBoundary'
import { isMobile } from '@renderer/shared/platform'
import { cn } from '@renderer/shared/lib/utils'

const MediaDetails = lazy(() => import('@renderer/widgets/media-details/MediaDetails'))
const ChapterReader = lazy(() => import('@renderer/widgets/reader/ChapterReader'))
const AnimeViewer = lazy(() => import('@renderer/widgets/anime-viewer/AnimeViewer'))

export function AppLayout(): React.JSX.Element {
  useAppUpdater()
  const { selectedManga, setSelectedManga, activeChapter, setActiveChapter, isWatchStageOpen } =
    useLibraryStore()
  const pipSession = usePipPlayerStore((s) => s.pipSession)
  const enterPip = usePipPlayerStore((s) => s.enterPip)
  const clearPip = usePipPlayerStore((s) => s.clearPip)
  const updatePipChapter = usePipPlayerStore((s) => s.updatePipChapter)
  const setLivePlayback = usePipPlayerStore((s) => s.setLivePlayback)
  const location = useLocation()
  const navigate = useNavigate()
  const mobile = isMobile()
  const prevPathRef = useRef(location.pathname)
  const isWatchingInlineAnime = Boolean(
    (activeChapter || isWatchStageOpen) && selectedManga?.mediaType === 'anime' && !mobile
  )

  // Preserve open details/player per route and auto-dock active video to Bottom-Right PiP when leaving
  useEffect(() => {
    const prevPath = prevPathRef.current
    sharedTabNavigationMemory.recordPath(location.pathname)
    if (prevPath === location.pathname) return
    prevPathRef.current = location.pathname

    const { selectedManga: currentManga, activeChapter: currentChapter } =
      useLibraryStore.getState()
    const pipState = usePipPlayerStore.getState()

    // Check if leaving prevPath while an inline/overlay anime video was actively playing
    let autoPipActivated = false
    if (
      currentChapter &&
      shouldAutoEnterPip({
        livePlayback: pipState.livePlayback,
        hasExistingPip: Boolean(pipState.pipSession),
        isMobileView: mobile
      }) &&
      pipState.livePlayback
    ) {
      enterPip({
        manga: pipState.livePlayback.manga,
        chapter: pipState.livePlayback.chapter,
        pkg: pipState.livePlayback.pkg,
        returnPath: prevPath
      })
      autoPipActivated = true
    } else {
      setLivePlayback(null)
    }

    if (currentManga) {
      sharedTabNavigationMemory.suspendOverlay(prevPath, {
        selectedManga: currentManga,
        activeChapter: autoPipActivated ? null : currentChapter
      })
    } else {
      sharedTabNavigationMemory.clearOverlay(prevPath)
    }

    // Returning to the PiP session's origin route automatically expands PiP back to Inline Watch
    const activePip = usePipPlayerStore.getState().pipSession
    if (activePip && activePip.returnPath === location.pathname && !mobile) {
      clearPip()
      sharedTabNavigationMemory.clearOverlay(location.pathname)
      setSelectedManga(activePip.manga)
      setActiveChapter(activePip.chapter)
      return
    }

    const restored = sharedTabNavigationMemory.consumeOverlay(location.pathname)
    if (restored) {
      setSelectedManga(restored.selectedManga)
      setActiveChapter(restored.activeChapter)
    } else {
      setSelectedManga(null)
      setActiveChapter(null)
    }
  }, [
    location.pathname,
    mobile,
    enterPip,
    clearPip,
    setLivePlayback,
    setSelectedManga,
    setActiveChapter
  ])

  return (
    <StoreInitializer>
      <div
        className={cn(
          'flex h-screen w-full flex-col overflow-hidden bg-background selection:bg-primary/20',
          mobile ? 'pb-safe' : ''
        )}
      >
        <DownloadQueueProcessor />
        {!mobile && <TitleBar />}
        <div className="flex flex-1 overflow-hidden relative">
          {!mobile && <Sidebar autoCollapsed={isWatchingInlineAnime} />}
          <main
            className={cn(
              'flex-1 relative z-10 bg-background overflow-hidden',
              mobile && 'pb-[64px]' // Fixed height of MobileBottomNav
            )}
          >
            <div className="flex flex-col h-full overflow-hidden">
              <ErrorBoundary label="Page Content">
                <Outlet />
              </ErrorBoundary>
            </div>

            {/* Global Overlays - Lazy loaded on demand */}
            {selectedManga && (
              <div className="absolute inset-0 z-30 bg-background animate-in fade-in slide-in-from-right-4 duration-300">
                <ErrorBoundary label="Media Details">
                  <Suspense
                    fallback={
                      <div className="flex h-full w-full items-center justify-center bg-background">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
                      </div>
                    }
                  >
                    <MediaDetails
                      mediaType={selectedManga.mediaType === 'anime' ? 'anime' : 'manga'}
                    />
                  </Suspense>
                </ErrorBoundary>
              </div>
            )}
          </main>
          {mobile && <MobileBottomNav />}
        </div>

        {activeChapter && (mobile || selectedManga?.mediaType !== 'anime') && (
          <ErrorBoundary label="Viewer">
            <Suspense
              fallback={
                <div className="flex h-screen w-screen items-center justify-center bg-black">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
                </div>
              }
            >
              {selectedManga?.mediaType === 'anime' ? <AnimeViewer /> : <ChapterReader />}
            </Suspense>
          </ErrorBoundary>
        )}

        {/* In-App Floating Bottom-Right PiP Mini-Player with Full Custom Controls */}
        {!mobile && pipSession && !(selectedManga?.mediaType === 'anime' && activeChapter) && (
          <ErrorBoundary label="Mini Player">
            <Suspense fallback={null}>
              <AnimeViewer
                variant="mini"
                miniSession={pipSession}
                onUpdateMiniChapter={(chapter) => updatePipChapter(chapter)}
                onExpandMini={() => {
                  const target = usePipPlayerStore.getState().pipSession
                  if (!target) return
                  clearPip()
                  sharedTabNavigationMemory.suspendOverlay(target.returnPath, {
                    selectedManga: target.manga,
                    activeChapter: target.chapter
                  })
                  if (location.pathname !== target.returnPath) {
                    navigate(target.returnPath)
                  } else {
                    sharedTabNavigationMemory.clearOverlay(target.returnPath)
                    setSelectedManga(target.manga)
                    setActiveChapter(target.chapter)
                  }
                }}
                onCloseMini={() => {
                  const target = usePipPlayerStore.getState().pipSession
                  clearPip()
                  if (target) {
                    sharedTabNavigationMemory.updateSuspendedChapter(
                      target.returnPath,
                      target.chapter
                    )
                  }
                }}
              />
            </Suspense>
          </ErrorBoundary>
        )}
        <Toast />
        {!mobile && <UpdaterToast />}
      </div>
    </StoreInitializer>
  )
}
