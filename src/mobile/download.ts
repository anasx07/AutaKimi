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
    await MobileDB.wrap(
      MobileDB.updateProgress({
        mangaId: args.mangaId,
        chapterId: args.chapterId,
        isRead: false
      })
    )

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
      // Capacitor Filesystem removed. Mobile version uses React Native / Expo instead.
      console.warn('[MobileDownload] Capacitor Filesystem removed. Download is no-op in web/fallback mode.', targetDir)
      
      let cachedCount = 0
      for (let i = 0; i < args.pageUrls.length; i++) {
        if (!this.activeDownloads.get(key)) break

        const url = args.pageUrls[i]
        const res = await MobileNetwork.fetchText(url)

        if (res.ok) {
          // Success simulated
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
    console.warn('[MobileDownload] Capacitor Filesystem removed. Remove is no-op.', targetDir)
    return { ok: true, value: true }
  },

  async getMangaDownloads(_mangaId: string): Promise<any> {
    return { ok: true, value: [] }
  },

  async getAllMangaDownloads(_type?: string): Promise<any> {
    return { ok: true, value: [] }
  },

  async clearAll(_type?: string): Promise<any> {
    return { ok: true, value: true }
  }
}
