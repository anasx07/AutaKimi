import * as FileSystem from 'expo-file-system/legacy'
import { MobileDB } from './db.native'
import { MobileNetwork } from './network.native'
import { IpcResult, DownloadEntry } from '@common/types'

export type DownloadEventCallback = (data: any) => void
const downloadCallbacks = new Set<DownloadEventCallback>()

const DOWNLOADS_DIR = `${FileSystem.documentDirectory}Downloads/`

function metaKey(mangaId: string, chapterId: string) {
  return `dl_meta_${mangaId}:${chapterId}`
}

function statusKey(mangaId: string, chapterId: string) {
  return `dl_status_${mangaId}:${chapterId}`
}

export type QueueItem = {
  mangaId: string
  chapterId: string
  pageUrls: string[]
  type: 'manga' | 'anime'
  mangaTitle?: string
  extensionName?: string
  chapterTitle?: string
}

export const MobileDownload = {
  activeDownloads: new Map<string, boolean>(),
  queue: [] as QueueItem[],
  isProcessing: false,

  onEvent(callback: DownloadEventCallback) {
    downloadCallbacks.add(callback)
    return () => downloadCallbacks.delete(callback)
  },

  emit(data: any) {
    downloadCallbacks.forEach(cb => cb(data))
  },

  async ensureDir(path: string) {
    const dirUri = `${DOWNLOADS_DIR}${path}`
    const dirInfo = await FileSystem.getInfoAsync(dirUri)
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dirUri, { intermediates: true })
    }
  },

  async start(args: QueueItem): Promise<IpcResult<boolean>> {
    const key = `${args.mangaId}:${args.chapterId}`
    if (this.activeDownloads.has(key) || this.queue.some(q => `${q.mangaId}:${q.chapterId}` === key)) {
      return { ok: true, value: true }
    }

    this.queue.push(args)
    await MobileDB.setSetting(statusKey(args.mangaId, args.chapterId), 'queued')
    this.emit({
      type: 'queued',
      mangaId: args.mangaId,
      chapterId: args.chapterId,
      total: args.pageUrls.length,
      cached: 0
    })

    // Kick off processing asynchronously
    this.processQueue().catch(e => console.error('[MobileDownload Native] processQueue error:', e))

    return { ok: true, value: true }
  },

  async processQueue() {
    if (this.isProcessing) return
    this.isProcessing = true

    while (this.queue.length > 0) {
      const args = this.queue.shift()!
      const key = `${args.mangaId}:${args.chapterId}`
      
      this.activeDownloads.set(key, true)

      await MobileDB.updateProgress({
        mangaId: args.mangaId,
        chapterId: args.chapterId,
        isRead: false
      })

      await MobileDB.setSetting(statusKey(args.mangaId, args.chapterId), 'downloading')

      this.emit({
        type: 'start',
        mangaId: args.mangaId,
        chapterId: args.chapterId,
        total: args.pageUrls.length,
        cached: 0
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
          await MobileDB.setSetting(statusKey(args.mangaId, args.chapterId), 'completed')
          await MobileDB.setSetting(
            metaKey(args.mangaId, args.chapterId),
            JSON.stringify({
              pageUrls: args.pageUrls,
              mangaTitle: args.mangaTitle,
              chapterTitle: args.chapterTitle,
              type: args.type,
              downloadedAt: new Date().toISOString(),
              totalPages: args.pageUrls.length
            })
          )
          this.emit({
            type: 'completed',
            mangaId: args.mangaId,
            chapterId: args.chapterId
          })
        }
      } catch (err: any) {
        console.error('[MobileDownload Native] Download failed:', err)
        await MobileDB.setSetting(statusKey(args.mangaId, args.chapterId), 'error')
        this.emit({
          type: 'error',
          mangaId: args.mangaId,
          chapterId: args.chapterId,
          error: err.message || String(err)
        })
      } finally {
        this.activeDownloads.delete(key)
      }
    }

    this.isProcessing = false
  },

  async cancel(args: { mangaId: string; chapterId: string }): Promise<IpcResult<boolean>> {
    const key = `${args.mangaId}:${args.chapterId}`
    this.activeDownloads.set(key, false)
    this.emit({
      type: 'canceled',
      mangaId: args.mangaId,
      chapterId: args.chapterId
    })
    return { ok: true, value: true }
  },

  async remove(args: { mangaId: string; chapterId: string }): Promise<IpcResult<boolean>> {
    const key = `${args.mangaId}:${args.chapterId}`

    // 1. Cancel active download loop
    if (this.activeDownloads.has(key)) {
      this.activeDownloads.set(key, false)
    }

    // 2. Filter out of queue if it hasn't started yet
    this.queue = this.queue.filter(q => `${q.mangaId}:${q.chapterId}` !== key)

    // 3. Determine mediaType to delete the correct folder
    const statusInfo = await this.getStatus(args)
    const mediaType = statusInfo.ok && statusInfo.value?.mediaType ? statusInfo.value.mediaType : 'manga'
    const targetDirSub = `${mediaType}/${args.mangaId}/${args.chapterId}`
    const targetDirUri = `${DOWNLOADS_DIR}${targetDirSub}`

    try {
      await FileSystem.deleteAsync(targetDirUri, { idempotent: true })
    } catch (e) {
      console.error('[MobileDownload Native] Remove directory failed:', e)
    }

    // 4. Clear state settings
    await MobileDB.setSetting(statusKey(args.mangaId, args.chapterId), '')
    await MobileDB.setSetting(metaKey(args.mangaId, args.chapterId), '')

    return { ok: true, value: true }
  },

  async getStatus(args: { mangaId: string; chapterId: string }): Promise<IpcResult<DownloadEntry | undefined>> {
    const key = `${args.mangaId}:${args.chapterId}`
    const statusRes = await MobileDB.getSetting(statusKey(args.mangaId, args.chapterId))
    const status = statusRes.ok ? statusRes.value : null
    const metaRes = await MobileDB.getSetting(metaKey(args.mangaId, args.chapterId))
    const metaRaw = metaRes.ok ? metaRes.value : null
    const meta = metaRaw ? JSON.parse(metaRaw) : null
    const isActive = this.activeDownloads.has(key)
    return {
      ok: true,
      value: {
        mangaId: args.mangaId,
        chapterId: args.chapterId,
        status: isActive ? 'downloading' : (status || null) as any,
        totalPages: meta?.totalPages || null,
        cachedPages: meta?.totalPages || null,
        pageUrls: meta?.pageUrls ? JSON.stringify(meta.pageUrls) : null,
        error: null,
        updatedAt: meta?.downloadedAt || null,
        mediaType: meta?.type || 'manga'
      }
    }
  },

  async getMangaDownloads(mangaId: string): Promise<IpcResult<DownloadEntry[]>> {
    const allSettingsRes = await MobileDB.getSettings()
    const allSettings = allSettingsRes.ok ? allSettingsRes.value : {}
    const prefix = `dl_status_${mangaId}:`
    const metaPrefix = `dl_meta_${mangaId}:`
    const entries: any[] = []
    for (const [settingKey, status] of Object.entries(allSettings)) {
      if (!settingKey.startsWith(prefix) || !status) continue
      const chapterId = settingKey.slice(prefix.length)
      const metaRaw = allSettings[`dl_meta_${mangaId}:${chapterId}`]
      const meta = metaRaw ? JSON.parse(metaRaw) : null
      entries.push({
        mangaId,
        chapterId,
        status: status as any,
        totalPages: meta?.totalPages || null,
        cachedPages: meta?.totalPages || null,
        pageUrls: meta?.pageUrls ? JSON.stringify(meta.pageUrls) : null,
        error: null,
        updatedAt: meta?.downloadedAt || null,
        mediaType: meta?.type || 'manga'
      })
    }
    return { ok: true, value: entries }
  },

  async getAllMangaDownloads(type?: string): Promise<IpcResult<DownloadEntry[]>> {
    const allSettingsRes = await MobileDB.getSettings()
    const allSettings = allSettingsRes.ok ? allSettingsRes.value : {}
    const entries: any[] = []
    const seen = new Set<string>()
    for (const [settingKey, status] of Object.entries(allSettings)) {
      if (!settingKey.startsWith('dl_status_') || !status || !settingKey.includes(':')) continue
      const rest = settingKey.slice('dl_status_'.length)
      const colonIdx = rest.indexOf(':')
      if (colonIdx === -1) continue
      const mangaId = rest.slice(0, colonIdx)
      const chapterId = rest.slice(colonIdx + 1)
      const uniqueKey = `${mangaId}:${chapterId}`
      if (seen.has(uniqueKey)) continue
      seen.add(uniqueKey)
      const metaRaw = allSettings[`dl_meta_${mangaId}:${chapterId}`]
      const meta = metaRaw ? JSON.parse(metaRaw) : null
      entries.push({
        mangaId,
        chapterId,
        status: status as any,
        totalPages: meta?.totalPages || null,
        cachedPages: meta?.totalPages || null,
        pageUrls: meta?.pageUrls ? JSON.stringify(meta.pageUrls) : null,
        error: null,
        updatedAt: meta?.downloadedAt || null,
        mediaType: meta?.type || 'manga'
      })
    }
    return { ok: true, value: entries }
  },

  async clearAll(type?: string): Promise<IpcResult<boolean>> {
    const entries = await this.getAllMangaDownloads(type)
    const list = entries.ok ? entries.value : []
    for (const entry of list) {
      await this.remove({ mangaId: entry.mangaId, chapterId: entry.chapterId })
    }
    return { ok: true, value: true }
  }
}
