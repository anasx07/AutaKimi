import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from './layouts/AppLayout'
import { useBrowseCacheStore } from '@renderer/shared/model'
import { DownloadSync } from './components/DownloadSync'
import { CfBypassOverlay } from './components/CfBypassOverlay'
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useUIStore } from '@renderer/shared/model/ui.store'
import { DataService } from '../shared/api/data.service'
import { setGeneratedSources } from '../shared/api/sources/SourceRegistry'

// Lazy load page components
const LibraryPage = lazy(() => import('@renderer/pages/library/LibraryPage'))
const DownloadsPage = lazy(() => import('@renderer/pages/downloads/DownloadsPage'))
const HistoryPage = lazy(() => import('@renderer/pages/history/HistoryPage'))
const BrowsePage = lazy(() => import('@renderer/pages/browse/BrowsePage'))
const ExtensionsPage = lazy(() => import('@renderer/pages/extensions/ExtensionsPage'))
const SettingsPage = lazy(() => import('@renderer/pages/settings/SettingsPage'))
const AboutPage = lazy(() => import('@renderer/pages/about/AboutPage'))
const AnimePage = lazy(() => import('@renderer/pages/anime/AnimePage'))
const MorePage = lazy(() => import('@renderer/pages/more/MorePage'))

const LoadingFallback = (): React.JSX.Element => (
  <div className="flex items-center justify-center h-full">
    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
  </div>
)

/**
 * Helper to wrap lazy components in Suspense with a consistent fallback
 */
const LazyRoute = ({ children }: { children: React.ReactNode }): React.JSX.Element => (
  <Suspense fallback={<LoadingFallback />}>{children}</Suspense>
)

function App(): React.JSX.Element {
  const { invalidateGroup } = useBrowseCacheStore()
  const { setIsCfBypassing } = useUIStore()
  const location = useLocation()

  useEffect(() => {
    // Force clear bypass state on navigation to prevent stuck overlays
    setIsCfBypassing(false)
  }, [location.pathname, setIsCfBypassing])


  useEffect(() => {
    const unsub = DataService.onCacheInvalidate((data: { group: string; key?: string }) => {
      console.log('[App] Cache Invalidation Received:', data)
      invalidateGroup(data.group, data.key)
    })
    return () => unsub()
  }, [invalidateGroup])

  const { loadCatalog } = useExtensionStore()

  useEffect(() => {
    loadCatalog()
  }, [loadCatalog])

  return (
    <>
      <DownloadSync />
      <CfBypassOverlay />
      <Routes>
        <Route element={<AppLayout />}>
          {/* Default Route */}
          <Route path="/" element={<Navigate to="/library" replace />} />

          {/* Core App Routes */}
          <Route path="/library" element={<LazyRoute><LibraryPage /></LazyRoute>} />
          <Route path="/downloads" element={<LazyRoute><DownloadsPage /></LazyRoute>} />
          <Route path="/history" element={<LazyRoute><HistoryPage /></LazyRoute>} />
          <Route path="/anime" element={<LazyRoute><AnimePage /></LazyRoute>} />
          <Route path="/settings" element={<LazyRoute><SettingsPage /></LazyRoute>} />
          <Route path="/about" element={<LazyRoute><AboutPage /></LazyRoute>} />
          <Route path="/more" element={<LazyRoute><MorePage /></LazyRoute>} />

          {/* Nested Browse / Extensions Flow */}
          <Route path="/browse">
            <Route index element={<LazyRoute><ExtensionsPage /></LazyRoute>} />
            <Route path=":pkg" element={<LazyRoute><BrowsePage /></LazyRoute>} />
          </Route>

          {/* Compat Route for /extensions */}
          <Route path="/extensions" element={<Navigate to="/browse" replace />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/library" replace />} />
        </Route>
      </Routes>
    </>
  )
}

export default App

