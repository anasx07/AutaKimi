import { useEffect, useState, useMemo, lazy, Suspense } from 'react'
import { BookOpen, Compass, Settings, Package, Info, Clock, Download, ChartBarIncreasing } from 'lucide-react'
import { ExtensionsManager } from '@renderer/widgets/extensions-manager'
import { MangaDetails } from '@renderer/widgets/manga-details'
import { AnimeDetails } from '@renderer/widgets/anime-details'
import { ChapterReader } from '@renderer/widgets/reader'
import { DownloadQueueProcessor } from '@renderer/widgets/download-queue'
import { useUIStore, useLibraryStore, useExtensionStore } from '@renderer/shared/model'
import { cn } from '@renderer/shared/lib/utils'
import { ErrorBoundary } from '@renderer/shared/ui/ErrorBoundary'

import { AnimeViewer } from '@renderer/widgets/anime-viewer'

import { TitleBar } from '@renderer/widgets/title-bar'
import Toast from '@renderer/shared/ui/Toast'
import { UpdaterToast } from '@renderer/shared/ui/UpdaterToast'
import { DataService } from '@renderer/shared/api'

// Lazy load page components
const LibraryPage = lazy(() => import('@renderer/pages/library/LibraryPage'))
const DownloadsPage = lazy(() => import('@renderer/pages/downloads/DownloadsPage'))
const HistoryPage = lazy(() => import('@renderer/pages/history/HistoryPage'))
const BrowsePage = lazy(() => import('@renderer/pages/browse/BrowsePage'))
const ExtensionsPage = lazy(() => import('@renderer/pages/extensions/ExtensionsPage'))
const SettingsPage = lazy(() => import('@renderer/pages/settings/SettingsPage'))
const AboutPage = lazy(() => import('@renderer/pages/about/AboutPage'))
const AnimePage = lazy(() => import('@renderer/pages/anime/AnimePage'))

/**
 * TabPanel: Only mounts children once visited, then keeps them alive but hidden.
 */
function TabPanel({
  id,
  activeTab,
  visited,
  label,
  children
}: {
  id: string
  activeTab: string
  visited: Set<string>
  label?: string
  children: React.ReactNode
}) {
  const isVisited = visited.has(id)
  const isActive = activeTab === id

  if (!isVisited) return null

  return (
    <div className={cn('absolute inset-0 overflow-y-auto', !isActive && 'hidden')}>
      <ErrorBoundary label={label}>
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
            </div>
          }
        >
          {children}
        </Suspense>
      </ErrorBoundary>
    </div>
  )
}

function App(): React.JSX.Element {
  const { activeTab, setActiveTab } = useUIStore()
  const { selectedManga, setSelectedManga, activeChapter, loadFromDb } = useLibraryStore()
  const { activeExtension } = useExtensionStore()
  const { setUpdateStatus, setUpdateProgress, setUpdateError } = useUIStore()

  // Track visited tabs to implement lazy-mount + keep-alive
  const [visited, setVisited] = useState<Set<string>>(new Set([activeTab]))

  useEffect(() => {
    loadFromDb()

    // Listen for app updates
    const unsubscribe = DataService.onAppUpdate((data: any) => {
      if (data.status) {
        setUpdateStatus(data.status)
        if (data.status === 'checking') setUpdateError(null)
      }
      if (data.progress) setUpdateProgress(data.progress)
      if (data.error) setUpdateError(data.error)
    })

    return () => unsubscribe()
  }, [])

  // Update visited set when tab changes
  useEffect(() => {
    if (!visited.has(activeTab)) {
      setVisited((prev) => new Set([...prev, activeTab]))
    }
  }, [activeTab])

  const sidebarItems = useMemo(
    () => [
      { id: 'library', label: 'Library', icon: BookOpen },
      { id: 'downloads', label: 'Downloaded', icon: Download },
      { id: 'history', label: 'History', icon: Clock },
      { id: 'browse', label: 'Manga Browser', icon: Compass },
      { id: 'my-extensions', label: 'Manga Extensions', icon: Package },
      { id: 'anime', label: 'Anime (BETA)', icon: ChartBarIncreasing }, //soon
      { id: 'settings', label: 'Settings', icon: Settings },
      { id: 'about', label: 'About', icon: Info }
    ],
    []
  )

  return (
    <div className="flex flex-col h-screen w-screen bg-background overflow-hidden selection:bg-primary/20">
      <DownloadQueueProcessor />
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 border-r border-border bg-card flex flex-col">
          <div className="p-6">
            <h2 className="text-xl font-bold tracking-tight bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
              AutaKimi
            </h2>
          </div>

          <nav className="flex-1 px-3 space-y-1">
            {sidebarItems.map((item) => {
              const Icon = item.icon
              const isActive = activeTab === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id as any)
                    setSelectedManga(null)
                  }}
                  className={cn(
                    'flex items-center gap-3 w-full px-4 py-2.5 rounded-md text-sm font-medium transition-all group',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                  )}
                >
                  <Icon
                    className={cn(
                      'h-5 w-5',
                      isActive
                        ? 'text-primary-foreground'
                        : 'text-muted-foreground group-hover:text-foreground'
                    )}
                  />
                  {item.label}
                </button>
              )
            })}
          </nav>

          <div className="p-4 border-t border-border mt-auto flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
              LM
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-foreground">Local User</p>
              <p className="text-[10px] text-muted-foreground">v{DataService.version}</p>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 relative bg-background overflow-hidden">
          {/* Tab Views */}
          <TabPanel id="library" activeTab={activeTab} visited={visited} label="Library">
            <LibraryPage />
          </TabPanel>

          <TabPanel id="downloads" activeTab={activeTab} visited={visited} label="Downloads">
            <DownloadsPage />
          </TabPanel>

          <TabPanel id="history" activeTab={activeTab} visited={visited} label="History">
            <HistoryPage />
          </TabPanel>

          {/* Browse Tab: Shows installed sources and their contents */}
          <TabPanel id="browse" activeTab={activeTab} visited={visited} label="Browse">
            <div className={cn('absolute inset-0', activeExtension && 'hidden')}>
              <ExtensionsPage />
            </div>
            <div className={cn('absolute inset-0', !activeExtension && 'hidden')}>
              <BrowsePage />
            </div>
          </TabPanel>

          {/* Extensions Tab: Now shows discovery and marketplace */}
          <TabPanel id="my-extensions" activeTab={activeTab} visited={visited} label="Extensions">
            <ExtensionsManager />
          </TabPanel>

          <TabPanel id="settings" activeTab={activeTab} visited={visited} label="Settings">
            <SettingsPage />
          </TabPanel>

          <TabPanel id="about" activeTab={activeTab} visited={visited} label="About">
            <AboutPage />
          </TabPanel>

          {/* Anime (Beta) Tab */}
          <TabPanel id="anime" activeTab={activeTab} visited={visited} label="Anime">
            <AnimePage />
          </TabPanel>

          {/* Overlay Views (Manga Details) */}
          {selectedManga && (
            <div className="absolute inset-0 z-10 bg-background animate-in fade-in slide-in-from-right-4 duration-300">
              <ErrorBoundary label="Manga Details">
                {selectedManga.mediaType === 'anime' ? (
                  <AnimeDetails />
                ) : (
                  <MangaDetails />
                )}
              </ErrorBoundary>
            </div>
          )}
        </main>
      </div>

      {activeChapter && (
        <ErrorBoundary label="Viewer">
          {selectedManga?.mediaType === 'anime' ? (
            <AnimeViewer />
          ) : (
            <ChapterReader />
          )}
        </ErrorBoundary>
      )}
      <Toast />
      <UpdaterToast />
    </div>
  )
}

export default App

