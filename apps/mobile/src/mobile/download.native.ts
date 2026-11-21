import * as FileSystem from 'expo-file-system/legacy'
import { MobileDB } from './db.native'
import { IpcResult, DownloadEntry } from '@common/types'

export type DownloadEventCallback = (data: any) => void
const downloadCallbacks = new Set<DownloadEventCallback>()

const DOWNLOADS_DIR = `${FileSystem.documentDirectory}Downloads/`

function sanitizePathSegment(segment: string): string {
  return encodeURIComponent(segment || '').replace(/%/g, '_').replace(/[:/\\?*|"><]/g, '_')
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

export type ActiveDownloadTask = {
  mangaId: string
  chapterId: string
  active: boolean
  cached: number
  total: number
  type: 'manga' | 'anime'
}

function taskKey(mangaId: string, chapterId: string): string {
  return `${mangaId}|||${chapterId}`
}

export const MobileDownload = {
  activeDownloads: new Map<string, ActiveDownloadTask>(),
  queue: [] as QueueItem[],
  isProcessing: false,

  onEvent(callback: DownloadEventCallback) {
    downloadCallbacks.add(callback)
    return () => downloadCallbacks.delete(callback)
  },

  emit(data: any) {
    downloadCallbacks.forEach((cb) => cb(data))
  },

  async ensureDir(path: string) {
    const dirUri = `${DOWNLOADS_DIR}${path}`
    const dirInfo = await FileSystem.getInfoAsync(dirUri)
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dirUri, { intermediates: true })
    }
  },

  async start(args: QueueItem): Promise<IpcResult<boolean>> {
    const key = taskKey(args.mangaId, args.chapterId)
    if (this.activeDownloads.has(key) || this.queue.some((q) => taskKey(q.mangaId, q.chapterId) === key)) {
      return { ok: true, value: true }
    }

    this.queue.push(args)
    await MobileDB.upsertDownload({
      mangaId: args.mangaId,
      chapterId: args.chapterId,
      totalPages: args.pageUrls.length,
      cachedPages: 0,
      status: 'queued',
      pageUrls: JSON.stringify(args.pageUrls),
      type: args.type,
      mangaTitle: args.mangaTitle,
      chapterTitle: args.chapterTitle,
      updatedAt: new Date().toISOString()
    })

    this.emit({
      type: 'queued',
      mangaId: args.mangaId,
      chapterId: args.chapterId,
      total: args.pageUrls.length,
      cached: 0
    })

    // Kick off processing asynchronously
    this.processQueue().catch((e) => console.error('[MobileDownload Native] processQueue error:', e))

    return { ok: true, value: true }
  },

  async processQueue() {
    if (this.isProcessing) return
    this.isProcessing = true

    while (this.queue.length > 0) {
      const args = this.queue.shift()!
      const key = taskKey(args.mangaId, args.chapterId)

      const currentTask: ActiveDownloadTask = {
        mangaId: args.mangaId,
        chapterId: args.chapterId,
        active: true,
        cached: 0,
        total: args.pageUrls.length,
        type: args.type
      }
      this.activeDownloads.set(key, currentTask)

      await MobileDB.updateProgress({
        mangaId: args.mangaId,
        chapterId: args.chapterId,
        isRead: false
      })

      await MobileDB.updateDownloadStatus(args.mangaId, args.chapterId, 'downloading')

      this.emit({
        type: 'start',
        mangaId: args.mangaId,
        chapterId: args.chapterId,
        total: args.pageUrls.length,
        cached: 0
      })

      const safeMangaId = sanitizePathSegment(args.mangaId)
      const safeChapterId = sanitizePathSegment(args.chapterId)
      const targetDirSub = `${args.type}/${safeMangaId}/${safeChapterId}`
      const targetDirUri = `${DOWNLOADS_DIR}${targetDirSub}/`

      try {
        await this.ensureDir(targetDirSub)

        let cachedCount = 0
        for (let i = 0; i < args.pageUrls.length; i++) {
          const task = this.activeDownloads.get(key)
          if (!task || !task.active) break

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
            task.cached = cachedCount
            await MobileDB.updateDownloadProgress(args.mangaId, args.chapterId, cachedCount, args.pageUrls.length)
            this.emit({
              type: 'progress',
              mangaId: args.mangaId,
              chapterId: args.chapterId,
              cached: cachedCount,
              total: args.pageUrls.length
            })
          }
        }

        const task = this.activeDownloads.get(key)
        if (task && task.active) {
          await MobileDB.upsertDownload({
            mangaId: args.mangaId,
            chapterId: args.chapterId,
            totalPages: args.pageUrls.length,
            cachedPages: cachedCount,
            status: 'completed',
            pageUrls: JSON.stringify(args.pageUrls),
            type: args.type,
            mangaTitle: args.mangaTitle,
            chapterTitle: args.chapterTitle,
            updatedAt: new Date().toISOString()
          })
          this.emit({
            type: 'completed',
            mangaId: args.mangaId,
            chapterId: args.chapterId
          })
        }
      } catch (err: any) {
        console.error('[MobileDownload Native] Download failed:', err)
        await MobileDB.updateDownloadStatus(args.mangaId, args.chapterId, 'error', err.message || String(err))
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
    const key = taskKey(args.mangaId, args.chapterId)
    const task = this.activeDownloads.get(key)
    if (task) {
      task.active = false
    }
    this.queue = this.queue.filter((q) => taskKey(q.mangaId, q.chapterId) !== key)
    await MobileDB.updateDownloadStatus(args.mangaId, args.chapterId, 'canceled')
    this.emit({
      type: 'canceled',
      mangaId: args.mangaId,
      chapterId: args.chapterId
    })
    return { ok: true, value: true }
  },

  async remove(args: { mangaId: string; chapterId: string }): Promise<IpcResult<boolean>> {
    const key = taskKey(args.mangaId, args.chapterId)

    // 1. Cancel active download loop
    const activeTask = this.activeDownloads.get(key)
    if (activeTask) {
      activeTask.active = false
    }

    // 2. Filter out of queue if it hasn't started yet
    this.queue = this.queue.filter((q) => taskKey(q.mangaId, q.chapterId) !== key)

    // 3. Determine mediaType to delete the correct folder
    const statusInfo = await this.getStatus(args)
    const mediaType = statusInfo.ok && statusInfo.value?.mediaType ? statusInfo.value.mediaType : 'manga'
    const safeMangaId = sanitizePathSegment(args.mangaId)
    const safeChapterId = sanitizePathSegment(args.chapterId)
    const targetDirSub = `${mediaType}/${safeMangaId}/${safeChapterId}`
    const targetDirUri = `${DOWNLOADS_DIR}${targetDirSub}`

    try {
      await FileSystem.deleteAsync(targetDirUri, { idempotent: true })
    } catch (e) {
      console.error('[MobileDownload Native] Remove directory failed:', e)
    }

    // 4. Clean up parent manga directory if empty
    try {
      const mangaDirUri = `${DOWNLOADS_DIR}${mediaType}/${safeMangaId}`
      const info = await FileSystem.getInfoAsync(mangaDirUri)
      if (info.exists) {
        const remaining = await FileSystem.readDirectoryAsync(mangaDirUri)
        if (remaining.length === 0) {
          await FileSystem.deleteAsync(mangaDirUri, { idempotent: true })
        }
      }
    } catch {}

    // 5. Delete from DB
    await MobileDB.deleteDownload(args.mangaId, args.chapterId)

    // 6. Clear legacy settings keys if any existed
    await MobileDB.setSetting(`dl_status_${args.mangaId}:${args.chapterId}`, '')
    await MobileDB.setSetting(`dl_meta_${args.mangaId}:${args.chapterId}`, '')

    return { ok: true, value: true }
  },

  async getStatus(args: { mangaId: string; chapterId: string }): Promise<IpcResult<DownloadEntry | undefined>> {
    const key = taskKey(args.mangaId, args.chapterId)
    const task = this.activeDownloads.get(key)
    const dbRes = await MobileDB.getDownload(args.mangaId, args.chapterId)
    const entry = dbRes.ok && dbRes.value ? dbRes.value : undefined

    if (task && task.active) {
      return {
        ok: true,
        value: {
          mangaId: args.mangaId,
          chapterId: args.chapterId,
          status: 'downloading',
          totalPages: task.total || entry?.totalPages || null,
          cachedPages: task.cached || entry?.cachedPages || null,
          pageUrls: entry?.pageUrls || null,
          error: null,
          updatedAt: entry?.updatedAt || new Date().toISOString(),
          mediaType: task.type || entry?.mediaType || 'manga',
          mangaTitle: entry?.mangaTitle || null,
          chapterTitle: entry?.chapterTitle || null
        }
      }
    }

    return {
      ok: true,
      value: entry
    }
  },

  async getMangaDownloads(mangaId: string): Promise<IpcResult<DownloadEntry[]>> {
    const res = await MobileDB.getDownloadsByManga(mangaId)
    const entries = res.ok && res.value ? res.value : []
    for (const entry of entries) {
      const task = this.activeDownloads.get(taskKey(entry.mangaId, entry.chapterId))
      if (task && task.active) {
        entry.status = 'downloading'
        if (typeof task.cached === 'number') entry.cachedPages = task.cached
        if (typeof task.total === 'number') entry.totalPages = task.total
      }
    }
    return { ok: true, value: entries }
  },

  async getAllMangaDownloads(type?: string): Promise<IpcResult<DownloadEntry[]>> {
    const res = await MobileDB.getAllDownloads(type)
    let entries = res.ok && res.value ? res.value : []
    for (const entry of entries) {
      const task = this.activeDownloads.get(taskKey(entry.mangaId, entry.chapterId))
      if (task && task.active) {
        entry.status = 'downloading'
        if (typeof task.cached === 'number') entry.cachedPages = task.cached
        if (typeof task.total === 'number') entry.totalPages = task.total
      }
    }
    if (type && type !== 'all') {
      entries = entries.filter((e) => e.mediaType === type)
    }
    return { ok: true, value: entries }
  },

  async clearAll(type?: string): Promise<IpcResult<boolean>> {
    const entriesRes = await this.getAllMangaDownloads(type)
    const list = entriesRes.ok && entriesRes.value ? entriesRes.value : []
    for (const entry of list) {
      await this.remove({ mangaId: entry.mangaId, chapterId: entry.chapterId })
    }
    return { ok: true, value: true }
  }
}
