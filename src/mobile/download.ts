import { Filesystem, Directory } from '@capacitor/filesystem'
import { MobileDB } from './db'
import { MobileNetwork } from './network'

export type DownloadEventCallback = (data: any) => void
let downloadCallback: DownloadEventCallback | null = null

export const MobileDownload = {
  activeDownloads: new Map<string, boolean>(),

  onEvent(callback: DownloadEventCallback) {
    downloadCallback = callback
  },

  emit(data: any) {
    if (downloadCallback) downloadCallback(data)
  },

  async start(args: {
    mangaId: string
    chapterId: string
    pageUrls: string[]
    type: 'manga' | 'anime'
    mangaTitle?: string
    extensionName?: string
    chapterTitle?: string
  }): Promise<any> {
    const key = `${args.mangaId}:${args.chapterId}`
    if (this.activeDownloads.has(key)) return { ok: true, value: true }

    this.activeDownloads.set(key, true)

    // Initial DB entry
    await MobileDB.wrap(MobileDB.updateProgress({
      mangaId: args.mangaId,
      chapterId: args.chapterId,
      isRead: false
    }))
    
    // Explicitly track in downloads table
    await MobileDB.wrap(MobileDB.setSetting(`dl_status_${key}`, 'downloading'))

    this.emit({
      type: 'start',
      mangaId: args.mangaId,
      chapterId: args.chapterId,
      total: args.pageUrls.length
    })

    const targetDir = `Downloads/${args.type}/${args.mangaId}/${args.chapterId}`
    
    try {
      await Filesystem.mkdir({
        path: targetDir,
        directory: Directory.Data,
        recursive: true
      })

      let cachedCount = 0
      for (let i = 0; i < args.pageUrls.length; i++) {
        if (!this.activeDownloads.get(key)) break

        const url = args.pageUrls[i]
        const res = await MobileNetwork.fetchText(url) // Or native fetch for blob
        
        if (res.ok) {
          // In a real implementation, we'd fetch as blob and convert to base64
          // For this bridge, we'll simulate the file save
          const filename = `${String(i + 1).padStart(3, '0')}.jpg`
          await Filesystem.writeFile({
            path: `${targetDir}/${filename}`,
            data: res.value.data, // This should be base64 in a real app
            directory: Directory.Data
          })
          
          cachedCount++
          this.emit({
            type: 'progress',
            mangaId: args.mangaId,
            chapterId: args.chapterId,
            cached: cachedCount,
            total: args.pageUrls.length
          })
        }
      }

      if (this.activeDownloads.get(key)) {
        this.emit({
          type: 'completed',
          mangaId: args.mangaId,
          chapterId: args.chapterId
        })
      }
    } catch (err: any) {
      this.emit({
        type: 'error',
        mangaId: args.mangaId,
        chapterId: args.chapterId,
        error: err.message || String(err)
      })
    } finally {
      this.activeDownloads.delete(key)
    }

    return { ok: true, value: true }
  },

  async cancel(args: { mangaId: string; chapterId: string }): Promise<any> {
    const key = `${args.mangaId}:${args.chapterId}`
    this.activeDownloads.set(key, false)
    this.emit({
      type: 'canceled',
      mangaId: args.mangaId,
      chapterId: args.chapterId
    })
    return { ok: true, value: true }
  },

  async getStatus(): Promise<any> {
    // Check DB for status
    return { ok: true, value: { status: 'idle' } } // Placeholder
  },

  async remove(args: { mangaId: string; chapterId: string }): Promise<any> {
    const targetDir = `Downloads/manga/${args.mangaId}/${args.chapterId}`
    try {
      await Filesystem.rmdir({
        path: targetDir,
        directory: Directory.Data,
        recursive: true
      })
    } catch {}
    return { ok: true, value: true }
  }
}
