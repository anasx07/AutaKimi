import { useEffect } from 'react'
import { useDownloadStore } from '@renderer/shared/model'
import { DataService } from '@renderer/shared/api'

export const DownloadSync = (): null => {
  const { updateActiveTask, removeActiveTask, removeFromDownloadQueue, hydrateTasks } =
    useDownloadStore()

  useEffect(() => {
    const unsubscribe = DataService.onSystemStateUpdate((event) => {
      if (event.type === 'full_state_update') {
        hydrateTasks(event.state.activeDownloads as any)
        return
      }

      const { task } = event
      const { status, cached, total, error, mangaId, chapterId } = task

      if (status !== 'downloading') {
        console.log(`[DownloadSync] Received state update: ${status} for ${mangaId}:${chapterId}`)
      }

      switch (status) {
        case 'downloading':
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
            status: 'completed'
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
            error
          })
          break

        case 'canceled':
          console.log(`[DownloadSync] Task canceled: ${mangaId}:${chapterId}`)
          removeActiveTask(mangaId, chapterId)
          break
      }
    })

    return () => {
      unsubscribe()
    }
  }, [updateActiveTask, removeActiveTask, removeFromDownloadQueue, hydrateTasks])

  return null
}
