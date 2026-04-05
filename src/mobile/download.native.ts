import * as FileSystem from 'expo-file-system'
import { MobileDB } from './db.native'
import { MobileNetwork } from './network.native'

export type DownloadEventCallback = (data: any) => void
let downloadCallback: DownloadEventCallback | null = null

const DOWNLOADS_DIR = `${FileSystem.documentDirectory}Downloads/`

export const MobileDownload = {
  activeDownloads: new Map<string, boolean>(),

  onEvent(callback: DownloadEventCallback) {
    downloadCallback = callback
  },

  emit(data: any) {
    if (downloadCallback) downloadCallback(data)
  },

  async ensureDir(path: string) {
    const dirUri = `${DOWNLOADS_DIR}${path}`
    const dirInfo = await FileSystem.getInfoAsync(dirUri)
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dirUri, { intermediates: true })
    }
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

    await MobileDB.updateProgress({
      mangaId: args.mangaId,
      chapterId: args.chapterId,
      isRead: false
    })

    await MobileDB.setSetting(`dl_status_${key}`, 'downloading')

    this.emit({
      type: 'start',
      mangaId: args.mangaId,
      chapterId: args.chapterId,
      total: args.pageUrls.length
    })

    const targetDirSub = `${args.type}/${args.mangaId}/${args.chapterId}`
    const targetDirUri = `${DOWNLOADS_DIR}${targetDirSub}/`

    try {
      await this.ensureDir(targetDirSub)

      let cachedCount = 0
      for (let i = 0; i < args.pageUrls.length; i++) {
        if (!this.activeDownloads.get(key)) break

        const url = args.pageUrls[i]
        const filename = `${String(i + 1).padStart(3, '0')}.jpg`
        const fileUri = `${targetDirUri}${filename}`

        const downloadRes = await FileSystem.downloadAsync(url, fileUri, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        })

        if (downloadRes.status >= 200 && downloadRes.status < 300) {
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
        await MobileDB.setSetting(`dl_status_${key}`, 'completed')
      }
    } catch (err: any) {
      console.error('[MobileDownload Native] Download failed:', err)
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

  async remove(args: { mangaId: string; chapterId: string }): Promise<any> {
    const targetDirSub = `manga/${args.mangaId}/${args.chapterId}`
    const targetDirUri = `${DOWNLOADS_DIR}${targetDirSub}`
    try {
      await FileSystem.deleteAsync(targetDirUri, { idempotent: true })
    } catch {}
    return { ok: true, value: true }
  }
}
