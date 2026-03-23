import { useEffect } from 'react'
import { useDownloadStore } from '@renderer/shared/model'
import { ExtensionResolver } from '@renderer/shared/api/sources/resolver'
import { DataService } from '@renderer/shared/api'

export default function DownloadQueueProcessor() {
  const { downloadQueue, isFetchingPages, removeFromDownloadQueue, setIsFetchingPages } = useDownloadStore()

  useEffect(() => {
    let mounted = true;

    const processQueue = async () => {
      if (downloadQueue.length === 0 || isFetchingPages) return

      const nextItem = downloadQueue[0]
      setIsFetchingPages(true)

      console.log(`[Queue Processor] Fetching pages for queued chapter ${nextItem.chapter.id}...`)

      try {
        const runner = await ExtensionResolver.resolve(nextItem.extension)
        if (!runner) throw new Error('Extension not found')
        
        const pages = await runner.fetchPages(nextItem.chapter.url || nextItem.chapter.id)
        if (!pages || pages.length === 0) throw new Error('No pages found')

        if (mounted) {
          // Send to main process
          await DataService.download.start({
            mangaId: nextItem.mangaId,
            chapterId: nextItem.chapter.id,
            pageUrls: pages
          })
          console.log(`[Queue Processor] Handed off chapter ${nextItem.chapter.id} to main process download manager.`)
        }
      } catch (e: any) {
        console.error(`[Queue Processor] Failed to process queued chapter ${nextItem.chapter.id}:`, e)
      } finally {
        if (mounted) {
          removeFromDownloadQueue(nextItem.chapter.id)
          // Add a small 1000ms delay to prevent rate limiting before finishing this fetch job
          setTimeout(() => setIsFetchingPages(false), 1000)
        }
      }
    }

    processQueue()

    return () => { mounted = false }
  }, [downloadQueue, isFetchingPages, removeFromDownloadQueue, setIsFetchingPages])

  return null // Invisible utility component
}
