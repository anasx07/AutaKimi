import { useEffect } from 'react'
import { useDownloadStore } from '@renderer/shared/model'

export const DownloadSync = (): null => {
  const { updateActiveTask, removeActiveTask, removeFromDownloadQueue } = useDownloadStore()

  useEffect(() => {
    if (!window.api?.onDownloadEvent) return

    const unsubscribe = window.api.onDownloadEvent((event): void => {
      const { type, cached, total, error } = event
      const mangaId = String(event.mangaId)
      const chapterId = String(event.chapterId)

      if (type !== 'progress') {
        console.log(`[DownloadSync] Received event: ${type} for ${mangaId}:${chapterId}`)
      }

      switch (type) {
        case 'start':
          updateActiveTask({
            mangaId,
            chapterId,
            status: 'downloading',
            cached: 0,
            total: total || 0
          })
          break

        case 'progress':
          updateActiveTask({
            mangaId,
            chapterId,
            cached: cached || 0,
            total: total || 0
          })
          break

        case 'completed':
          updateActiveTask({
            mangaId,
            chapterId,
            status: 'completed'
          })
          // Remove from UI queue since it's now an active/completed task
          removeFromDownloadQueue(chapterId)
          // Optionally remove from active tasks after some time or keep for UI
          setTimeout(() => {
            removeActiveTask(mangaId, chapterId)
          }, 3000)
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
  }, [updateActiveTask, removeActiveTask, removeFromDownloadQueue])

  return null
}
