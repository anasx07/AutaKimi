import { useEffect } from 'react'
import { useUIStore } from '@renderer/shared/model'
import { DataService } from '@renderer/shared/api'

interface AppUpdateData {
  status?: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error'
  progress?: object | null
  error?: string | null
}

/**
 * Custom hook to handle IPC auto-updater events.
 */
export function useAppUpdater(): void {
  const { setUpdateStatus, setUpdateProgress, setUpdateError } = useUIStore()

  useEffect(() => {
    // Listen for app updates
    const unsubscribe = DataService.onAppUpdate((data: AppUpdateData) => {
      if (data.status) {
        setUpdateStatus(data.status)
        if (data.status === 'checking') setUpdateError(null)
      }
      if (data.progress) setUpdateProgress(data.progress)
      if (data.error) setUpdateError(data.error)
    })

    return () => unsubscribe()
  }, [setUpdateStatus, setUpdateProgress, setUpdateError])
}
