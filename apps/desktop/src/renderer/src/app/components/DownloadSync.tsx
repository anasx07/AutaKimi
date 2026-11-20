import { useEffect } from 'react'
import { useDownloadStore, useUIStore } from '@renderer/shared/model'
import { DataService } from '@renderer/shared/api'
import { getApi } from '@renderer/shared/api/base'

export const DownloadSync = (): null => {
  const { updateActiveTask, removeActiveTask, removeFromDownloadQueue, hydrateTasks } =
    useDownloadStore()

  useEffect(() => {
    // 1. Central System State update listener
    const unsubscribeState = DataService.onSystemStateUpdate((event) => {
      if (event.type === 'full_state_update') {
        hydrateTasks(event.state.activeDownloads as any)
        
        // Sync active bypass status
        const { activeBypass } = event.state
        const { setIsCfBypassing } = useUIStore.getState()
        if (activeBypass) {
          setIsCfBypassing(true, activeBypass.domain)
        } else {
          setIsCfBypassing(false)
        }
        return
      }

      if (event.type === 'cf_bypass_update') {
        // Handle individual bypass updates if needed (e.g. for a bypass history view)
        return
      }

      const { task } = event
      const { status, cached, total, error, mangaId, chapterId } = task

      if (status !== 'downloading') {
        console.log(`[DownloadSync] Received state update: ${status} for ${mangaId}:${chapterId}`)
      }

      switch (status) {
        case 'downloading':
        case 'progress' as any:
        case 'start' as any:
          updateActiveTask({
            mangaId,
            chapterId,
            status: 'downloading',
            cached,
            total
          })
          break

        case 'completed':
          updateActiveTask({
            mangaId,
            chapterId,
            status: 'completed',
            cached: total || cached,
            total
          })
          removeFromDownloadQueue(chapterId)
          // Keep in UI for a moment
          setTimeout(() => {
            removeActiveTask(mangaId, chapterId)
          }, 5000)
          break

        case 'error':
          updateActiveTask({
            mangaId,
            chapterId,
            status: 'error',
            error,
            cached,
            total
          })
          break

        case 'canceled':
          console.log(`[DownloadSync] Task canceled: ${mangaId}:${chapterId}`)
          removeActiveTask(mangaId, chapterId)
          removeFromDownloadQueue(chapterId)
          break
      }
    })

    // 2. Direct DOWNLOAD_EVENT listener for zero-latency progress updates
    const unsubscribeDownloadEvent = getApi().onDownloadEvent?.((data: any) => {
      if (!data) return
      const { type, mangaId, chapterId, cached, total, error } = data

      if (type === 'start' || type === 'progress') {
        updateActiveTask({
          mangaId,
          chapterId,
          status: 'downloading',
          cached: cached ?? 0,
          total: total ?? 0
        })
      } else if (type === 'completed') {
        updateActiveTask({
          mangaId,
          chapterId,
          status: 'completed',
          cached: total || cached,
          total
        })
        removeFromDownloadQueue(chapterId)
        setTimeout(() => {
          removeActiveTask(mangaId, chapterId)
        }, 5000)
      } else if (type === 'error') {
        updateActiveTask({
          mangaId,
          chapterId,
          status: 'error',
          error,
          cached,
          total
        })
      } else if (type === 'canceled') {
        removeActiveTask(mangaId, chapterId)
        removeFromDownloadQueue(chapterId)
      }
    })

    return () => {
      unsubscribeState()
      unsubscribeDownloadEvent?.()
    }
  }, [updateActiveTask, removeActiveTask, removeFromDownloadQueue, hydrateTasks])

  return null
}
