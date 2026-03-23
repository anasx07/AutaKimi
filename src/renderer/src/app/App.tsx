import { useEffect } from 'react'
import { BookOpen, Compass, Settings, Package, Info, Clock, Download } from 'lucide-react'
import { ExtensionsManager } from '@renderer/widgets/extensions-manager'
import BrowsePage from '@renderer/pages/browse/BrowsePage'
import { MangaDetails } from '@renderer/widgets/manga-details'
import { ChapterReader } from '@renderer/widgets/reader'
import LibraryPage from '@renderer/pages/library/LibraryPage'
import DownloadsPage from '@renderer/pages/downloads/DownloadsPage'
import SettingsPage from '@renderer/pages/settings/SettingsPage'
import ExtensionsPage from '@renderer/pages/extensions/ExtensionsPage'
import AboutPage from '@renderer/pages/about/AboutPage'
import HistoryPage from '@renderer/pages/history/HistoryPage'
import { DownloadQueueProcessor } from '@renderer/widgets/download-queue'
import { useUIStore, useLibraryStore } from '@renderer/shared/model'
import { cn } from '@renderer/shared/lib/utils'
import { ErrorBoundary } from '@renderer/shared/ui/ErrorBoundary'

import { TitleBar } from '@renderer/widgets/title-bar'
import Toast from '@renderer/shared/ui/Toast'
import { UpdaterToast } from '@renderer/shared/ui/UpdaterToast'

function App(): React.JSX.Element {
  const { activeTab, setActiveTab } = useUIStore()
  const { activeExtension, selectedManga, activeChapter, loadFromDb } = useLibraryStore()

  const { setUpdateStatus, setUpdateProgress } = useUIStore()

  useEffect(() => {
    loadFromDb()
    
    // Listen for app updates
    const unsubscribe = (window as any).api.onAppUpdate((data: any) => {
      if (data.status) setUpdateStatus(data.status)
      if (data.progress) setUpdateProgress(data.progress)
    })

    return () => unsubscribe()
  }, [])

  const sidebarItems = [
    { id: 'library', label: 'Library', icon: BookOpen },
    { id: 'downloads', label: 'Downloaded', icon: Download },
    { id: 'history', label: 'History', icon: Clock },
    { id: 'browse', label: 'Browse', icon: Compass },
    { id: 'my-extensions', label: 'Extensions', icon: Package },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'about', label: 'About', icon: Info }
  ]

  return (
    <div className="flex flex-col h-screen w-screen bg-background overflow-hidden selection:bg-primary/20">
      <DownloadQueueProcessor />
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 border-r border-border bg-card flex flex-col">
        <div className="p-6">
          <h2 className="text-xl font-bold tracking-tight bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">LManwa</h2>
        </div>
        
        <nav className="flex-1 px-3 space-y-1">
          {sidebarItems.map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.id
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={cn(
                  "flex items-center gap-3 w-full px-4 py-2.5 rounded-md text-sm font-medium transition-all group",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-sm" 
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                )}
              >
                <Icon className={cn("h-5 w-5", isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground")} />
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
            <p className="text-[10px] text-muted-foreground">v0.1.0</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 relative bg-background overflow-hidden">
        {/* Persistent Tab Views */}
        <div className={cn("absolute inset-0 overflow-y-auto", activeTab !== 'library' && "hidden")}>
          <ErrorBoundary>
            <LibraryPage />
          </ErrorBoundary>
        </div>

        <div className={cn("absolute inset-0 overflow-y-auto", activeTab !== 'downloads' && "hidden")}>
          <ErrorBoundary>
            <DownloadsPage />
          </ErrorBoundary>
        </div>

        <div className={cn("absolute inset-0 overflow-y-auto", activeTab !== 'history' && "hidden")}>
          <ErrorBoundary>
            <HistoryPage />
          </ErrorBoundary>
        </div>

        <div className={cn("absolute inset-0 overflow-y-auto", (activeTab !== 'browse' || activeExtension) && "hidden")}>
          <ErrorBoundary>
            <ExtensionsManager />
          </ErrorBoundary>
        </div>

        <div className={cn("absolute inset-0 overflow-y-auto", (activeTab !== 'browse' || !activeExtension) && "hidden")}>
          <ErrorBoundary>
            <BrowsePage />
          </ErrorBoundary>
        </div>

        <div className={cn("absolute inset-0 overflow-y-auto", activeTab !== 'my-extensions' && "hidden")}>
          <ErrorBoundary>
            <ExtensionsPage />
          </ErrorBoundary>
        </div>

        <div className={cn("absolute inset-0 overflow-y-auto", activeTab !== 'settings' && "hidden")}>
          <ErrorBoundary>
            <SettingsPage />
          </ErrorBoundary>
        </div>

        <div className={cn("absolute inset-0 overflow-y-auto", activeTab !== 'about' && "hidden")}>
          <ErrorBoundary>
            <AboutPage />
          </ErrorBoundary>
        </div>

        {/* Overlay Views (Manga Details) */}
        {selectedManga && (
          <div className="absolute inset-0 z-10 bg-background animate-in fade-in slide-in-from-right-4 duration-300">
            <ErrorBoundary>
              <MangaDetails />
            </ErrorBoundary>
          </div>
        )}
      </main>
      </div>

      {activeChapter && (
        <ErrorBoundary>
          <ChapterReader />
        </ErrorBoundary>
      )}
      <Toast />
      <UpdaterToast />
    </div>
  )
}

export default App

