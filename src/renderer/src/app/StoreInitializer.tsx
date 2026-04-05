import React, { useEffect, useState } from 'react'
import { DataService } from '@renderer/shared/api'
import {
  useExtensionStore,
  useLibraryStore,
  useReaderStore,
  useSettingsStore,
  useHistoryStore,
  useUIStore
} from '@renderer/shared/model'
import { SettingsMapper } from '@renderer/shared/lib/settings.mapper'

interface StoreInitializerProps {
  children: React.ReactNode
}

export const StoreInitializer: React.FC<StoreInitializerProps> = ({ children }) => {
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      try {
        console.time('[StoreInitializer] Total Boot Time')

        // 0. Initialize backend (critical for mobile SQLite)
        await DataService.init()

        // Concurrent fetch of core persistent data
        const [installed, libraryItems, settingsMap] = await Promise.all([
          DataService.db.getExtensions(),
          DataService.db.getLibrary(),
          DataService.db.getSettings()
        ])

        // Boot sequence: Order matters for dependent systems (like Theme -> UI)
        const schema = SettingsMapper.toSchema(settingsMap as Record<string, string>)

        // 1. Settings & UI (Applied first to fix theme flickering)
        useSettingsStore.getState()._init(schema)
        useUIStore.getState()._init(schema.ui)

        // 2. Extensions (Registry and domain overrides)
        useExtensionStore.getState()._init(installed as any[], schema.extensions)

        // 3. Reader (Preferences and Layouts)
        useReaderStore.getState()._init(schema.reader)

        // 4. Library (User data)
        useLibraryStore.getState()._init(libraryItems as any[])

        // 5. History (Background load)
        useHistoryStore.getState().loadHistory()

        console.timeEnd('[StoreInitializer] Total Boot Time')
        setIsReady(true)
      } catch (err: any) {
        console.error('[StoreInitializer] Critical Failure:', err)
        setError(err.message || 'A catastrophic error occurred during initialization.')
      }
    }

    init()
  }, [])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#09090b] text-white p-6 text-center selection:bg-primary/30">
        <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-6">
          <svg
            className="w-8 h-8 text-destructive"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold mb-2">Boot Failure</h1>
        <p className="text-zinc-500 mb-4 max-w-md font-medium">
          The application failed to synchronize with the local database. This might be due to a
          filesystem lock or corrupted cache.
        </p>
        <div className="bg-destructive/10 border border-destructive/20 rounded-md p-4 mb-8 max-w-md w-full">
          <p className="text-destructive font-mono text-sm break-words">Error: {error}</p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="px-8 py-3 bg-white text-black font-bold rounded-lg hover:bg-zinc-200 transition-all active:scale-95"
        >
          Force Re-Sync
        </button>
      </div>
    )
  }

  if (!isReady) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#09090b] text-white overflow-hidden">
        <div className="relative group">
          {/* Animated Glow */}
          <div className="absolute -inset-4 bg-primary/20 rounded-full blur-2xl animate-pulse group-hover:bg-primary/30 transition-all"></div>

          {/* Rotating Loader */}
          <div className="w-20 h-20 relative">
            <div className="absolute inset-0 rounded-full border-[3px] border-zinc-800"></div>
            <div className="absolute inset-0 rounded-full border-t-[3px] border-primary animate-[spin_0.8s_linear_infinite]"></div>
          </div>
        </div>

        <div className="mt-10 space-y-2 text-center">
          <h2 className="text-xl font-bold tracking-tighter sm:text-2xl bg-gradient-to-b from-white to-zinc-500 bg-clip-text text-transparent">
            AutaKimi
          </h2>
          <div className="flex items-center gap-1.5 justify-center">
            <span className="w-1 h-1 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]"></span>
            <span className="w-1 h-1 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]"></span>
            <span className="w-1 h-1 rounded-full bg-primary animate-bounce"></span>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
