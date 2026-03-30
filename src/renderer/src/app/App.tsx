import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from './layouts/AppLayout'
import { ExtensionsManager } from '@renderer/widgets/extensions-manager'
import { useExtensionStore, useBrowseCacheStore } from '@renderer/shared/model'
import { DownloadSync } from './components/DownloadSync'
import { useEffect } from 'react'
import { DataService } from '../shared/api/data.service'

// Lazy load page components
const LibraryPage = lazy(() => import('@renderer/pages/library/LibraryPage'))
const DownloadsPage = lazy(() => import('@renderer/pages/downloads/DownloadsPage'))
const HistoryPage = lazy(() => import('@renderer/pages/history/HistoryPage'))
const BrowsePage = lazy(() => import('@renderer/pages/browse/BrowsePage'))
const ExtensionsPage = lazy(() => import('@renderer/pages/extensions/ExtensionsPage'))
const SettingsPage = lazy(() => import('@renderer/pages/settings/SettingsPage'))
const AboutPage = lazy(() => import('@renderer/pages/about/AboutPage'))
const AnimePage = lazy(() => import('@renderer/pages/anime/AnimePage'))

const LoadingFallback = (): React.JSX.Element => (
  <div className="flex items-center justify-center h-full">
    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
  </div>
)

/**
 * Composite Browse Page that switches between Extension list and Source content
 */
function BrowseView(): React.JSX.Element {
  const { activeExtension } = useExtensionStore()
  return activeExtension ? <BrowsePage /> : <ExtensionsPage />
}

function App(): React.JSX.Element {
  const { invalidateGroup } = useBrowseCacheStore()

  useEffect(() => {
    const unsub = DataService.onCacheInvalidate((data: { group: string; key?: string }) => {
      console.log('[App] Cache Invalidation Received:', data)
      invalidateGroup(data.group, data.key)
    })
    return () => unsub()
  }, [invalidateGroup])

  return (
    <>
      <DownloadSync />
      <Routes>
        <Route element={<AppLayout />}>
          {/* Default Route */}
          <Route path="/" element={<Navigate to="/library" replace />} />

          {/* Tab Routes */}
          <Route
            path="/library"
            element={
              <Suspense fallback={<LoadingFallback />}>
                <LibraryPage />
              </Suspense>
            }
          />
          <Route
            path="/downloads"
            element={
              <Suspense fallback={<LoadingFallback />}>
                <DownloadsPage />
              </Suspense>
            }
          />
          <Route
            path="/history"
            element={
              <Suspense fallback={<LoadingFallback />}>
                <HistoryPage />
              </Suspense>
            }
          />
          <Route
            path="/browse"
            element={
              <Suspense fallback={<LoadingFallback />}>
                <BrowseView />
              </Suspense>
            }
          />
          <Route
            path="/my-extensions"
            element={
              <Suspense fallback={<LoadingFallback />}>
                <ExtensionsManager />
              </Suspense>
            }
          />
          <Route
            path="/anime"
            element={
              <Suspense fallback={<LoadingFallback />}>
                <AnimePage />
              </Suspense>
            }
          />
          <Route
            path="/settings"
            element={
              <Suspense fallback={<LoadingFallback />}>
                <SettingsPage />
              </Suspense>
            }
          />
          <Route
            path="/about"
            element={
              <Suspense fallback={<LoadingFallback />}>
                <AboutPage />
              </Suspense>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/library" replace />} />
        </Route>
      </Routes>
    </>
  )
}

export default App
