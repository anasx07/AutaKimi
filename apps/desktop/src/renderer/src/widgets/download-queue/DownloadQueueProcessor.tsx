import { useEffect } from 'react'
import { useDownloadStore } from '@renderer/shared/model'
import { ExtensionResolver } from '@renderer/shared/api/sources/resolver'
import { DataService } from '@renderer/shared/api'

export default function DownloadQueueProcessor(): null {
  const { downloadQueue, isFetchingPages, removeFromDownloadQueue, setIsFetchingPages } =
    useDownloadStore()

  // Maintenance: Reset isFetchingPages on mount if queue is empty
  useEffect((): void => {
    if (downloadQueue.length === 0) {
      setIsFetchingPages(false)
    }
  }, [downloadQueue.length, setIsFetchingPages])

  useEffect((): (() => void) => {
    let mounted = true

    const processQueue = async (): Promise<void> => {
      if (downloadQueue.length === 0 || isFetchingPages) return

      const nextItem = downloadQueue[0]
      setIsFetchingPages(true)

      console.log(`[Queue Processor] Fetching pages for queued chapter ${nextItem.chapter.id}...`)

      try {
        const runner = await ExtensionResolver.resolve(nextItem.extension)
        if (!runner) throw new Error('Extension not found')

        const pages = await runner.fetchPages(nextItem.chapter.url || nextItem.chapter.id)
        if (!pages || pages.length === 0) throw new Error('No pages found')

        const pageUrls = pages.map((p: any) => (typeof p === 'object' ? p.url : p))

        if (mounted) {
          // Send to main process
          await DataService.download.start({
            mangaId: nextItem.mangaId,
            chapterId: nextItem.chapter.id,
            pageUrls,
            type: nextItem.type,
            mangaTitle: nextItem.mangaTitle,
            extensionName: nextItem.extensionName || nextItem.extension,
            chapterTitle: nextItem.chapter.title || `Chapter ${nextItem.chapter.number}`
          })
          console.log(
            `[Queue Processor] Handed off chapter ${nextItem.chapter.id} to main process download manager.`
          )
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error(
          `[Queue Processor] Failed to process queued chapter ${nextItem.chapter.id}: ${msg}`
        )
      } finally {
        // ALWAYS clean up state even if unmounted, as the store is global
        removeFromDownloadQueue(nextItem.chapter.id)
        // Add a small 1000ms delay to prevent rate limiting
        setTimeout(() => setIsFetchingPages(false), 1000)
      }
    }

    processQueue()

    return () => {
      mounted = false
    }
  }, [downloadQueue, isFetchingPages, removeFromDownloadQueue, setIsFetchingPages])

  return null // Invisible utility component
}
