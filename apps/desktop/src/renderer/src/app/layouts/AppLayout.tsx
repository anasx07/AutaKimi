import { Outlet, useLocation } from 'react-router-dom'
import { lazy, Suspense, useEffect, useRef } from 'react'
import { Sidebar } from '../components/Sidebar'
import { MobileBottomNav } from '../components/MobileBottomNav'
import { sharedTabNavigationMemory } from '../components/navigationMemory'
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
  const { selectedManga, setSelectedManga, activeChapter, setActiveChapter } = useLibraryStore()
  const location = useLocation()
  const mobile = isMobile()
  const prevPathRef = useRef(location.pathname)
  const isWatchingInlineAnime = Boolean(
    activeChapter && selectedManga?.mediaType === 'anime' && !mobile
  )

  // Preserve open details/player per route when switching tabs (e.g. Browse -> History -> Browse)
  useEffect(() => {
    const prevPath = prevPathRef.current
    sharedTabNavigationMemory.recordPath(location.pathname)
    if (prevPath === location.pathname) return
    prevPathRef.current = location.pathname

    const { selectedManga: currentManga, activeChapter: currentChapter } =
      useLibraryStore.getState()
    if (currentManga) {
      sharedTabNavigationMemory.suspendOverlay(prevPath, {
        selectedManga: currentManga,
        activeChapter: currentChapter
      })
    } else {
      sharedTabNavigationMemory.clearOverlay(prevPath)
    }

    const restored = sharedTabNavigationMemory.consumeOverlay(location.pathname)
    if (restored) {
      setSelectedManga(restored.selectedManga)
      setActiveChapter(restored.activeChapter)
    } else {
      setSelectedManga(null)
      setActiveChapter(null)
    }
  }, [location.pathname, setSelectedManga, setActiveChapter])

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
        <Toast />
        {!mobile && <UpdaterToast />}
      </div>
    </StoreInitializer>
  )
}
