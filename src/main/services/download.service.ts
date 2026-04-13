import { net, WebContents, app } from 'electron'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { downloadRepo, settingsRepo } from '../db'
import { NetworkService } from '../../common/services/network'
import { CacheManager } from './cache.service'
import { NetworkConfig } from '../../common/config/network'
import { AppService } from './service.registry'
import { IpcChannel } from '../../common/types/ipc'
import { DownloadEntry, DownloadedMedia } from '../../common/types/download'
import { stateRegistry } from './state.service'
import { ActiveTaskState } from '../../common/types/state'
import { ReactiveQueue } from '../utils/reactive-queue'

export interface DownloadTask {
  mangaId: string
  chapterId: string
  pageUrls: string[]
  type: 'manga' | 'anime'
  active?: boolean
  mangaTitle?: string
  extensionName?: string
  chapterTitle?: string
}

export class DownloadManager implements AppService {
  private static instance: DownloadManager
  private activeDownloads: Map<string, { type: 'manga' | 'anime'; active: boolean }> = new Map()
  private webContents: WebContents | null = null
  private globalRequestQueue: ReactiveQueue

  constructor() {
    this.globalRequestQueue = new ReactiveQueue({ concurrency: 3 })
  }

  public static getInstance(): DownloadManager {
    if (!DownloadManager.instance) {
      DownloadManager.instance = new DownloadManager()
    }
    return DownloadManager.instance
  }

  public setWebContents(webContents: WebContents): void {
    this.webContents = webContents
  }

  private emit(data: {
    type: 'start' | 'progress' | 'completed' | 'error' | 'canceled'
    mangaId: string
    chapterId: string
    cached?: number
    total?: number
    error?: string
    mangaTitle?: string
    chapterTitle?: string
    typeLabel?: 'manga' | 'anime'
  }): void {
    // legacy emit for backward compatibility if needed, but primarily now via stateRegistry
    if (this.webContents) {
      this.webContents.send(IpcChannel.DOWNLOAD_EVENT, data)
    }

    const statusMap: Record<string, ActiveTaskState['status']> = {
      start: 'downloading',
      progress: 'downloading',
      completed: 'completed',
      error: 'error',
      canceled: 'canceled'
    }

    stateRegistry.updateDownloadTask({
      mangaId: data.mangaId,
      chapterId: data.chapterId,
      status: statusMap[data.type] || 'downloading',
      cached: data.cached ?? 0,
      total: data.total ?? 0,
      error: data.error,
      mangaTitle: data.mangaTitle,
      chapterTitle: data.chapterTitle,
      type: data.typeLabel || 'manga'
    })

    if (data.type !== 'progress') {
      console.log(
        `[DownloadManager] State updated: ${data.type} for ${data.mangaId}:${data.chapterId}`
      )
    }
  }

  async initialize(): Promise<void> {
    console.log('[DownloadManager] Initializing and recovering downloads...')
    await downloadRepo.recoverOrphanedDownloads()
    const concurrency = await this.getConcurrency()
    this.globalRequestQueue.setConcurrency(concurrency)
  }

  async shutdown(): Promise<void> {
    console.log('[DownloadManager] Shutting down, pausing active downloads...')
    for (const [key, val] of this.activeDownloads) {
      this.activeDownloads.set(key, { ...val, active: false })
    }
    this.globalRequestQueue.pause()
  }

  /** Read concurrency setting from DB, clamped to [1, 5], default 3. */
  private async getConcurrency(): Promise<number> {
    try {
      const val = await settingsRepo.get('download_concurrency')
      if (val) {
        const n = parseInt(val, 10)
        if (!isNaN(n)) return Math.max(1, Math.min(5, n))
      }
    } catch {
      /* ignore, use default */
    }
    return 3
  }

  private sanitizeFolderName(name: string): string {
    return name.replace(/[<>:"/\\|?*]/g, '_').trim()
  }

  async startDownload(task: DownloadTask): Promise<void> {
    const key = `${task.mangaId}:${task.chapterId}`
    if (this.activeDownloads.has(key)) return

    this.activeDownloads.set(key, { type: task.type, active: true })

    await downloadRepo.upsert({
      mangaId: task.mangaId,
      chapterId: task.chapterId,
      totalPages: task.pageUrls.length,
      cachedPages: 0,
      status: 'downloading',
      pageUrls: JSON.stringify(task.pageUrls)
    })

    this.emit({
      type: 'start',
      mangaId: task.mangaId,
      chapterId: task.chapterId,
      total: task.pageUrls.length,
      mangaTitle: task.mangaTitle,
      chapterTitle: task.chapterTitle,
      typeLabel: task.type
    })

    const concurrency = await this.getConcurrency()
    this.globalRequestQueue.setConcurrency(concurrency)

    // NEW STRUCTURE: Documents/AutaKimi/Downloads/{TypeLabel}/{SourceName}/{MangaName}/{ChapterTitle}
    const documentsPath = app.getPath('documents')
    const typeLabel = task.type === 'anime' ? 'Anime' : 'Manga'
    const sourceName = this.sanitizeFolderName(task.extensionName || 'Source')
    const mangaName = this.sanitizeFolderName(task.mangaTitle || 'Unknown')
    const chapterFolderName = this.sanitizeFolderName(task.chapterTitle || `Downloaded_${key}`)

    const targetDir = path.join(
      documentsPath,
      'AutaKimi',
      'Downloads',
      typeLabel,
      sourceName,
      mangaName,
      chapterFolderName
    )

    try {
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true })
      }
    } catch (e) {
      console.error(`[DownloadManager] Failed to create directory: ${targetDir}`, e)
    }

    console.log(
      `[DownloadManager] Starting download for ${key} (${task.pageUrls.length} pages, concurrency=${concurrency})`
    )
    console.log(`[DownloadManager] Target Directory: ${targetDir}`)

    try {
      // Atomic counter — safe since JS is single-threaded
      let cachedCount = 0

      // Add each page to the global request queue
      const pageTasks = task.pageUrls.map((url, pageIndex) => async () => {
        if (!this.activeDownloads.get(key)?.active) return // Cancelled

        const hash = crypto.createHash('md5').update(url).digest('hex')
        const imageCache = CacheManager.getInstance().getImageCache()
        let buffer = await imageCache.get(hash)

        if (!buffer) {
          try {
            const response = await NetworkService.fetchWithRetry(
              url,
              {
                headers: {
                  'User-Agent': NetworkConfig.DEFAULT_UA,
                  Referer: new URL(url).origin + '/'
                }
              },
              NetworkConfig.DEFAULT_RETRY_ATTEMPTS,
              NetworkConfig.DEFAULT_RETRY_DELAY,
              net.fetch
            )

            buffer = Buffer.from(await response.arrayBuffer())
            await CacheManager.getInstance().getImageCache().set(hash, buffer)
          } catch (e) {
            console.error(`[DownloadManager] Failed to cache page: ${url}`, e)
            return
          }
        }

        // Save to structured directory
        if (buffer) {
          try {
            const parsedUrl = new URL(url)
            const rawExt = path.extname(parsedUrl.pathname).replace('.', '').toLowerCase()
            const validExts = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif']
            const sanitizedExt = rawExt.replace(/[^a-z0-0]/g, '').slice(0, 5)
            const ext = validExts.includes(sanitizedExt) ? sanitizedExt : 'jpg'

            const filename = `${String(pageIndex + 1).padStart(3, '0')}.${ext}`
            const filePath = path.join(targetDir, filename)

            fs.writeFileSync(filePath, buffer)
            cachedCount++
          } catch (e) {
            console.error(`[DownloadManager] Failed to save file to disk: ${url}`, e)
            return
          }
        }

        await downloadRepo.upsert({
          mangaId: task.mangaId,
          chapterId: task.chapterId,
          cachedPages: cachedCount,
          status: 'downloading'
        })

        this.emit({
          type: 'progress',
          mangaId: task.mangaId,
          chapterId: task.chapterId,
          cached: cachedCount,
          total: task.pageUrls.length,
          mangaTitle: task.mangaTitle,
          chapterTitle: task.chapterTitle,
          typeLabel: task.type
        })
      })

      // Wait for all pages of THIS chapter to finish (respecting global concurrency)
      await this.globalRequestQueue.addAll(key, pageTasks)

      // Final check if it was cancelled during pool execution
      if (!this.activeDownloads.get(key)?.active) {
        console.log(`[DownloadManager] Download cancelled for ${key}`)
        return
      }

      await downloadRepo.upsert({
        mangaId: task.mangaId,
        chapterId: task.chapterId,
        status: 'completed'
      })

      this.emit({
        type: 'completed',
        mangaId: task.mangaId,
        chapterId: task.chapterId,
        mangaTitle: task.mangaTitle,
        chapterTitle: task.chapterTitle,
        typeLabel: task.type
      })

      console.log(`[DownloadManager] Download completed for ${key}`)
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error(`[DownloadManager] Download failed for ${key}:`, error)
      await downloadRepo.upsert({
        mangaId: task.mangaId,
        chapterId: task.chapterId,
        status: 'error',
        error: msg
      })
      this.emit({
        type: 'error',
        mangaId: task.mangaId,
        chapterId: task.chapterId,
        error: msg
      })
    } finally {
      this.activeDownloads.delete(key)
    }
  }

  cancelDownload(mangaId: string, chapterId: string): void {
    const key = `${mangaId}:${chapterId}`
    this.globalRequestQueue.cancel(key)

    const existing = this.activeDownloads.get(key)
    if (existing) {
      this.activeDownloads.set(key, { ...existing, active: false })

      // Emit cancellation immediately so UI can react
      this.emit({
        type: 'canceled',
        mangaId,
        chapterId
      })
      console.log(`[DownloadManager] Cancellation emitted for ${key}`)
    }
  }

  async deleteDownload(mangaId: string, chapterId: string): Promise<void> {
    this.cancelDownload(mangaId, chapterId)
    return downloadRepo.remove(mangaId, chapterId)
  }

  async getStatus(mangaId: string, chapterId: string): Promise<DownloadEntry | undefined> {
    return downloadRepo.get(mangaId, chapterId)
  }

  async getMangaDownloads(mangaId: string): Promise<DownloadEntry[]> {
    return downloadRepo.getByManga(mangaId)
  }

  async getDownloadedManga(type?: 'manga' | 'anime'): Promise<DownloadedMedia[]> {
    return downloadRepo.getDownloadedManga(type)
  }

  async clearAll(type?: 'manga' | 'anime'): Promise<void> {
    // Cancel active downloads that match the type
    for (const [key, val] of this.activeDownloads) {
      if (!type || val.type === type) {
        this.activeDownloads.set(key, { ...val, active: false })
      }
    }
    return downloadRepo.clear(type)
  }
}

export const downloadManager = DownloadManager.getInstance()
