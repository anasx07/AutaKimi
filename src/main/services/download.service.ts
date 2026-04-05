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

/**
 * Runs `fn` over all `items` with at most `concurrency` tasks running in parallel.
 * Workers pull from the shared index counter — safe because JS is single-threaded.
 */
async function runWithPool<T>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<void>
): Promise<void> {
  let index = 0
  async function worker(): Promise<void> {
    while (index < items.length) {
      const i = index++
      await fn(items[i], i)
    }
  }
  const workerCount = Math.min(concurrency, items.length)
  await Promise.all(Array.from({ length: workerCount }, worker))
}

export class DownloadManager implements AppService {
  private static instance: DownloadManager
  private activeDownloads: Map<string, { type: 'manga' | 'anime'; active: boolean }> = new Map()
  private webContents: WebContents | null = null

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
  }): void {
    if (this.webContents) {
      this.webContents.send(IpcChannel.DOWNLOAD_EVENT, data)
      if (data.type !== 'progress') {
        console.log(
          `[DownloadManager] Emitted event: ${data.type} for ${data.mangaId}:${data.chapterId}`
        )
      }
    } else {
      console.warn(`[DownloadManager] Cannot emit event ${data.type}: webContents not set!`)
    }
  }

  async initialize(): Promise<void> {
    console.log('[DownloadManager] Initializing and recovering downloads...')
    await downloadRepo.recoverOrphanedDownloads()
  }

  async shutdown(): Promise<void> {
    console.log('[DownloadManager] Shutting down, pausing active downloads...')
    for (const [key, val] of this.activeDownloads) {
      this.activeDownloads.set(key, { ...val, active: false })
    }
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
      total: task.pageUrls.length
    })

    const concurrency = await this.getConcurrency()

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

      await runWithPool(task.pageUrls, concurrency, async (url, pageIndex) => {
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

            // Only count successfully cached pages (bug fix: was counting even on failure)
            cachedCount++
          } catch (e) {
            console.error(`[DownloadManager] Failed to cache page: ${url}`, e)
            return // Continue with remaining pages
          }
        } else {
          // Already cached
          cachedCount++
        }

        // Save to structured directory
        if (buffer) {
          try {
            // Ultra-robust extension extraction
            const parsedUrl = new URL(url)
            const rawExt = path.extname(parsedUrl.pathname).replace('.', '').toLowerCase()
            const validExts = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif']

            // Strictly alphanumeric, no slashes, no dots, max 5 chars
            const sanitizedExt = rawExt.replace(/[^a-z0-0]/g, '').slice(0, 5)
            const ext = validExts.includes(sanitizedExt) ? sanitizedExt : 'jpg'

            const filename = `${String(pageIndex + 1).padStart(3, '0')}.${ext}`
            const filePath = path.join(targetDir, filename)

            console.log(`[DownloadManager] Writing page to: ${filePath}`)
            fs.writeFileSync(filePath, buffer)

            // Only count successfully written files
            cachedCount++
          } catch (e) {
            console.error(`[DownloadManager] Failed to save file to disk: ${url}`, e)
            return // Don't count this as cached/progress if write failed
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
          total: task.pageUrls.length
        })

        if (cachedCount % 5 === 0 || cachedCount === task.pageUrls.length) {
          console.log(
            `[DownloadManager] Progress for ${key}: ${cachedCount}/${task.pageUrls.length}`
          )
        }
      })

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
        chapterId: task.chapterId
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
