import { useEffect, useRef } from 'react'
import { useUIStore } from '@renderer/shared/model'
import { DataService } from '@renderer/shared/api'

interface AppUpdateData {
  status?: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error'
  version?: string
  manual?: boolean
  progress?: { percent: number } | null
  error?: string | null
}

/**
 * Handles IPC auto-updater events and tracks native/HTML5 fullscreen state
 * so update notifications stay hidden during fullscreen video playback.
 */
export function useAppUpdater(): void {
  const {
    setUpdateStatus,
    setUpdateVersion,
    setUpdateProgress,
    setUpdateError,
    setUpdateDismissed,
    setUpdateCheckManual,
    setIsWindowFullscreen
  } = useUIStore()

  const nativeFullscreenRef = useRef(false)

  useEffect(() => {
    const unsubscribe = DataService.onAppUpdate((data) => {
      const status = data.status as AppUpdateData['status']
      if (data.manual !== undefined) {
        setUpdateCheckManual(Boolean(data.manual))
      }
      if (data.version !== undefined) {
        setUpdateVersion(data.version || null)
      }
      if (status) {
        setUpdateStatus(status)
        if (status === 'checking') {
          setUpdateError(null)
        }
        if (status === 'downloaded') {
          setUpdateDismissed(false)
        }
      }
      if (data.progress) {
        setUpdateProgress(data.progress)
      }
      if (data.error !== undefined) {
        setUpdateError(data.error || null)
      }
    })

    return () => unsubscribe()
  }, [
    setUpdateStatus,
    setUpdateVersion,
    setUpdateProgress,
    setUpdateError,
    setUpdateDismissed,
    setUpdateCheckManual
  ])

  useEffect(() => {
    const syncFullscreen = (): void => {
      const hasHtmlFullscreen = Boolean(
        document.fullscreenElement ||
          (document as Document & { webkitFullscreenElement?: Element | null })
            .webkitFullscreenElement
      )
      setIsWindowFullscreen(Boolean(nativeFullscreenRef.current || hasHtmlFullscreen))
    }

    document.addEventListener('fullscreenchange', syncFullscreen)
    document.addEventListener('webkitfullscreenchange', syncFullscreen)

    let unsubscribeNative: (() => void) | undefined
    if (typeof window !== 'undefined' && window.api?.window) {
      DataService.window
        .isFullScreen()
        .then((isNative) => {
          nativeFullscreenRef.current = Boolean(isNative)
          syncFullscreen()
        })
        .catch(() => {})

      unsubscribeNative = DataService.window.onFullScreenChange((isNative) => {
        nativeFullscreenRef.current = Boolean(isNative)
        syncFullscreen()
      })
    }

    syncFullscreen()

    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreen)
      document.removeEventListener('webkitfullscreenchange', syncFullscreen)
      unsubscribeNative?.()
    }
  }, [setIsWindowFullscreen])
}
