import { Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { Sidebar } from '../components/Sidebar'
import { MobileBottomNav } from '../components/MobileBottomNav'
import { TitleBar } from '@renderer/widgets/title-bar'
import { DownloadQueueProcessor } from '@renderer/widgets/download-queue'
import Toast from '@renderer/shared/ui/Toast'
import { UpdaterToast } from '@renderer/shared/ui/UpdaterToast'
import { useAppUpdater } from '../hooks/useAppUpdater'
import { StoreInitializer } from '../StoreInitializer'
import { useLibraryStore } from '@renderer/shared/model'
import { ErrorBoundary } from '@renderer/shared/ui/ErrorBoundary'
import { MangaDetails } from '@renderer/widgets/manga-details'
import { AnimeDetails } from '@renderer/widgets/anime-details'
import { ChapterReader } from '@renderer/widgets/reader'
import { AnimeViewer } from '@renderer/widgets/anime-viewer'
import { isMobile } from '@renderer/shared/platform'
import { cn } from '@renderer/shared/lib/utils'
import { StatusBar, Style } from '@capacitor/status-bar'

export function AppLayout(): React.JSX.Element {
  useAppUpdater()
  const { selectedManga, setSelectedManga, activeChapter, setActiveChapter } = useLibraryStore()
  const location = useLocation()
  const mobile = isMobile()

  // Initialize status bar on mobile
  useEffect(() => {
    if (mobile) {
      StatusBar.setBackgroundColor({ color: '#09090b' }).catch(() => {})
      StatusBar.setStyle({ style: Style.Dark }).catch(() => {})
    }
  }, [mobile])

  // Dismiss details and reader on route change
  useEffect(() => {
    setSelectedManga(null)
    setActiveChapter(null)
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
          {!mobile && <Sidebar />}
          <main className={cn(
            'flex-1 relative bg-background overflow-hidden',
            mobile && 'pb-[64px]' // Fixed height of MobileBottomNav
          )}>
            <div className="flex flex-col h-full overflow-hidden">
              <ErrorBoundary label="Page Content">
                <Outlet />
              </ErrorBoundary>
            </div>

            {/* Global Overlays - Still managed via store but isolated in Layout */}
            {selectedManga && (
              <div className="absolute inset-0 z-30 bg-background animate-in fade-in slide-in-from-right-4 duration-300">
                <ErrorBoundary label="Media Details">
                  {selectedManga.mediaType === 'anime' ? <AnimeDetails /> : <MangaDetails />}
                </ErrorBoundary>
              </div>
            )}
          </main>
          {mobile && <MobileBottomNav />}
        </div>

        {activeChapter && (
          <ErrorBoundary label="Viewer">
            {selectedManga?.mediaType === 'anime' ? <AnimeViewer /> : <ChapterReader />}
          </ErrorBoundary>
        )}
        <Toast />
        {!mobile && <UpdaterToast />}
      </div>
    </StoreInitializer>
  )
}
