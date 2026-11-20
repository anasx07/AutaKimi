import { downloadRepo, settingsRepo } from '../db'
import { AppService, ServicePriority } from './service.registry'
import { IpcChannel } from '@common/types/ipc'
import { stateRegistry } from './state.service'
import { broadcastService } from './broadcast.service'
import { cacheManager } from './cache.service'
import { ReactiveQueue } from '../utils/reactive-queue'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { app, net, session } from 'electron'
import { networkClient } from '@common'
import { createCbzArchive, listCbzEntries } from '../utils/cbz'

export interface DownloadTask {
  mangaId: string
  chapterId: string
  pageUrls: string[]
  type: 'manga' | 'anime'
  mangaTitle?: string
  extensionName?: string
  chapterTitle?: string
}

export function safeDirKey(id: string): string {
  return crypto.createHash('sha256').update(id).digest('hex').slice(0, 24)
}

export class DownloadManager implements AppService {
  public priority = ServicePriority.FEATURE
  private queue = new ReactiveQueue({ concurrency: 3 })
  public activeDownloads = new Map<string, boolean>()

  constructor() {}

  async initialize(): Promise<void> {
    try {
      await downloadRepo.recoverOrphanedDownloads()
    } catch (e) {
      console.warn('[Download] Failed to recover orphaned downloads:', e)
    }

    const concurrency = parseInt((await settingsRepo.get('download_concurrency')) || '3')
    this.queue.setConcurrency(concurrency)
  }

  async shutdown(): Promise<void> {
    this.queue.destroy()
  }

  public setConcurrency(concurrency: number): void {
    if (typeof concurrency === 'number' && !isNaN(concurrency) && concurrency > 0) {
      this.queue.setConcurrency(concurrency)
    }
  }

  async startDownload(task: DownloadTask) {
    const key = `${task.mangaId}:${task.chapterId}`
    if (this.activeDownloads.has(key)) return

    this.activeDownloads.set(key, true)

    // Add to ReactiveQueue with processing logic in the runner
    this.queue.add(key, async () => {
      await this.processTask(task)
    })

    await downloadRepo.upsert({
      mangaId: task.mangaId,
      chapterId: task.chapterId,
      status: 'downloading',
      totalPages: task.pageUrls.length,
      cachedPages: 0,
      updatedAt: new Date().toISOString(),
      mediaType: task.type,
      pageUrls: JSON.stringify(task.pageUrls)
    })

    this.notifyStatus(task, 'start')
  }

  async cancelDownload(mangaId: string, chapterId: string) {
    const key = `${mangaId}:${chapterId}`
    this.activeDownloads.delete(key)
    this.queue.cancel(key)
    this.notifyStatus({ mangaId, chapterId } as any, 'canceled')

    // Clean up temporary download staging folder if canceled
    try {
      const safeManga = safeDirKey(mangaId)
      const safeChapter = safeDirKey(chapterId)
      const tmpDir = path.join(app.getPath('userData'), 'downloads', safeManga, `${safeChapter}.tmp`)
      if (fs.existsSync(tmpDir)) {
        await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
      }
    } catch {}
  }

  async deleteDownload(mangaId: string, chapterId: string) {
    await this.cancelDownload(mangaId, chapterId)
    await downloadRepo.remove(mangaId, chapterId)

    // Clean up persistent files on disk (.cbz, .tmp, or legacy folder)
    try {
      const safeManga = safeDirKey(mangaId)
      const safeChapter = safeDirKey(chapterId)
      const mangaDir = path.join(app.getPath('userData'), 'downloads', safeManga)
      const cbzFile = path.join(mangaDir, `${safeChapter}.cbz`)
      const tmpDir = path.join(mangaDir, `${safeChapter}.tmp`)
      const legacyChapterDir = path.join(mangaDir, safeChapter)

      if (fs.existsSync(cbzFile)) {
        await fs.promises.rm(cbzFile, { force: true }).catch(() => {})
      }
      if (fs.existsSync(tmpDir)) {
        await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
      }
      if (fs.existsSync(legacyChapterDir)) {
        await fs.promises.rm(legacyChapterDir, { recursive: true, force: true }).catch(() => {})
      }

      // Legacy unhashed path cleanup fallback
      try {
        const legacyDir = path.join(app.getPath('userData'), 'downloads', mangaId, chapterId)
        if (fs.existsSync(legacyDir)) {
          await fs.promises.rm(legacyDir, { recursive: true, force: true }).catch(() => {})
        }
        const legacyCbz = path.join(app.getPath('userData'), 'downloads', mangaId, `${chapterId}.cbz`)
        if (fs.existsSync(legacyCbz)) {
          await fs.promises.rm(legacyCbz, { force: true }).catch(() => {})
        }
      } catch {}

      // Clean up parent manga directory if empty
      if (fs.existsSync(mangaDir)) {
        const remaining = await fs.promises.readdir(mangaDir).catch(() => [])
        if (remaining.length === 0) {
          await fs.promises.rmdir(mangaDir).catch(() => {})
        }
      }
    } catch (e) {
      console.warn('[Download] Failed to delete download files from disk:', e)
    }
  }

  async getStatus(mangaId: string, chapterId: string) {
    const key = `${mangaId}:${chapterId}`
    const entry = await downloadRepo.get(mangaId, chapterId)
    if (!entry) {
      if (this.activeDownloads.has(key)) {
        return {
          mangaId,
          chapterId,
          status: 'downloading',
          totalPages: null,
          cachedPages: 0,
          pageUrls: null,
          error: null,
          updatedAt: new Date().toISOString(),
          mediaType: 'manga'
        }
      }
      return undefined
    }

    if (this.activeDownloads.has(key)) {
      entry.status = 'downloading'
    }

    if (entry.status === 'completed') {
      try {
        const safeManga = safeDirKey(mangaId)
        const safeChapter = safeDirKey(chapterId)
        const mangaDir = path.join(app.getPath('userData'), 'downloads', safeManga)
        let cbzPath = path.join(mangaDir, `${safeChapter}.cbz`)

        // Check CBZ first (standard format)
        if (!fs.existsSync(cbzPath)) {
          const legacyCbz = path.join(app.getPath('userData'), 'downloads', mangaId, `${chapterId}.cbz`)
          if (fs.existsSync(legacyCbz)) {
            cbzPath = legacyCbz
          }
        }

        if (fs.existsSync(cbzPath)) {
          const entries = await listCbzEntries(cbzPath)
          if (entries.length > 0) {
            entry.localPages = entries.map((e) => {
              const fullVirtualPath = `${cbzPath.replace(/\\/g, '/')}/${e.name}`
              return `autakimi-local://${encodeURI(fullVirtualPath)}`
            })
          }
        } else {
          // Backward compatibility fallback for legacy loose files
          let downloadsDir = path.join(mangaDir, safeChapter)
          if (!fs.existsSync(downloadsDir)) {
            try {
              const legacyDir = path.join(app.getPath('userData'), 'downloads', mangaId, chapterId)
              if (fs.existsSync(legacyDir)) {
                downloadsDir = legacyDir
              }
            } catch {}
          }

          if (fs.existsSync(downloadsDir)) {
            const files = await fs.promises.readdir(downloadsDir)
            const validFiles = files.filter((f) => /^\d+_/.test(f))
            if (validFiles.length > 0) {
              validFiles.sort((a, b) => {
                const numA = parseInt(a.split('_')[0], 10)
                const numB = parseInt(b.split('_')[0], 10)
                return numA - numB
              })
              entry.localPages = validFiles.map((f) => {
                const fullPath = path.join(downloadsDir, f)
                return `autakimi-local://${encodeURI(fullPath.replace(/\\/g, '/'))}`
              })
            }
          }
        }
      } catch (e) {
        console.warn('[Download] Failed to resolve localPages for chapter:', e)
      }
    }

    return entry
  }

  async getMangaDownloads(mangaId: string) {
    const entries = await downloadRepo.getByManga(mangaId)
    for (const entry of entries) {
      if (this.activeDownloads.has(`${entry.mangaId}:${entry.chapterId}`)) {
        entry.status = 'downloading'
      }
    }
    return entries
  }

  async getDownloadedManga(type?: 'manga' | 'anime') {
    return downloadRepo.getDownloadedManga(type)
  }

  async clearAll(type?: 'manga' | 'anime') {
    this.queue.clear()
    this.activeDownloads.clear()
    const mangaIdsToClear = await downloadRepo.clear(type)

    try {
      const downloadsBaseDir = path.join(app.getPath('userData'), 'downloads')
      if (fs.existsSync(downloadsBaseDir)) {
        if (!type) {
          await fs.promises.rm(downloadsBaseDir, { recursive: true, force: true })
        } else if (Array.isArray(mangaIdsToClear) && mangaIdsToClear.length > 0) {
          for (const mangaId of mangaIdsToClear) {
            const safeManga = safeDirKey(mangaId)
            const mangaDir = path.join(downloadsBaseDir, safeManga)
            if (fs.existsSync(mangaDir)) {
              await fs.promises.rm(mangaDir, { recursive: true, force: true }).catch(() => {})
            }

            // Legacy directory cleanup
            try {
              const legacyDir = path.join(downloadsBaseDir, mangaId)
              if (fs.existsSync(legacyDir)) {
                await fs.promises.rm(legacyDir, { recursive: true, force: true }).catch(() => {})
              }
            } catch {}
          }
        }
      }
    } catch (e) {
      console.warn('[Download] Failed to clear downloads directory on disk:', e)
    }
  }

  private notifyStatus(
    task: DownloadTask,
    type: 'start' | 'progress' | 'completed' | 'error' | 'canceled',
    cached?: number,
    total?: number,
    error?: string
  ) {
    const cachedCount = cached ?? 0
    const totalCount = total ?? (task.pageUrls ? task.pageUrls.length : 0)

    broadcastService.send(IpcChannel.DOWNLOAD_EVENT, {
      type,
      mangaId: task.mangaId,
      chapterId: task.chapterId,
      cached: cachedCount,
      total: totalCount,
      error
    })

    stateRegistry.updateDownloadState(
      task.mangaId,
      task.chapterId,
      type,
      cachedCount,
      totalCount,
      error,
      task.type,
      task.mangaTitle,
      task.chapterTitle
    )
  }

  private async processTask(task: DownloadTask) {
    const key = `${task.mangaId}:${task.chapterId}`
    let cachedCount = 0
    let failedCount = 0
    let lastError: string | null = null

    // Dedicated persistent downloads directory decoupled from 500MB LRU cache using safe hashed paths
    const safeManga = safeDirKey(task.mangaId)
    const safeChapter = safeDirKey(task.chapterId)
    const mangaDir = path.join(app.getPath('userData'), 'downloads', safeManga)
    const cbzFilePath = path.join(mangaDir, `${safeChapter}.cbz`)
    const tmpDir = path.join(mangaDir, `${safeChapter}.tmp`)

    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true })
    }

    try {
      for (let i = 0; i < task.pageUrls.length; i++) {
        if (!this.activeDownloads.has(key)) return // Canceled

        const url = task.pageUrls[i]
        const hash = crypto.createHash('md5').update(url).digest('hex')
        let ext = '.jpg'
        try {
          const parsedPath = new URL(url).pathname
          const parsedExt = path.extname(parsedPath)
          if (parsedExt && parsedExt.length <= 5) ext = parsedExt
        } catch {}

        const fileName = `${String(i).padStart(4, '0')}_${hash}${ext}`
        const filePath = path.join(tmpDir, fileName)

        try {
          if (!fs.existsSync(filePath)) {
            let origin = 'https://'
            try {
              origin = new URL(url).origin + '/'
            } catch {
              /* ignore */
            }

            const res = await networkClient.fetch(url, {
              headers: {
                'User-Agent': session.defaultSession.getUserAgent(),
                Referer: origin
              },
              attempts: 3,
              delay: 1000,
              fetchFn: net.fetch
            })

            if (!res.ok) throw new Error(res.error || `HTTP ${res.status}`)
            const response = res.value
            const buffer = Buffer.from(await response.arrayBuffer())

            // Atomic page file write to temporary staging directory
            const partPath = `${filePath}.${Date.now()}.part`
            await fs.promises.writeFile(partPath, buffer)
            await fs.promises.rename(partPath, filePath)

            // Also keep in imageCache so immediate reader view hits memory/disk cache
            await cacheManager.getImageCache().set(hash, buffer).catch(() => {})
          }

          cachedCount++
          this.notifyStatus(task, 'progress', cachedCount, task.pageUrls.length)
          await downloadRepo.updateProgress(task.mangaId, task.chapterId, cachedCount)
        } catch (err: any) {
          failedCount++
          lastError = err?.message || String(err)
          console.error(`[Download] Failed to download page ${i} for ${key}:`, err)
        }
      }

      this.activeDownloads.delete(key)

      // If any page failed to download, do NOT mark status as completed
      if (failedCount > 0 || cachedCount === 0) {
        const errorMsg = `Completed with ${failedCount} failed page(s): ${lastError || 'Unknown error'}`
        await downloadRepo.updateStatus(task.mangaId, task.chapterId, 'error', errorMsg)
        this.notifyStatus(task, 'error', cachedCount, task.pageUrls.length, errorMsg)
      } else {
        // Build single-file .cbz archive with STORE method (no CPU overhead, instant access)
        const pageFiles = await fs.promises.readdir(tmpDir)
        const validFiles = pageFiles.filter((f) => /^\d+_/.test(f))
        validFiles.sort((a, b) => {
          const numA = parseInt(a.split('_')[0], 10)
          const numB = parseInt(b.split('_')[0], 10)
          return numA - numB
        })

        const cbzEntries: Array<{ name: string; buffer: Buffer }> = []
        for (let idx = 0; idx < validFiles.length; idx++) {
          const file = validFiles[idx]
          const ext = path.extname(file) || '.jpg'
          const pageBuf = await fs.promises.readFile(path.join(tmpDir, file))
          const entryName = `${String(idx + 1).padStart(4, '0')}${ext}`
          cbzEntries.push({ name: entryName, buffer: pageBuf })
        }

        await createCbzArchive(cbzEntries, cbzFilePath)

        // Clean up temporary staging directory
        await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {})

        // Clean up legacy loose-files directory for this chapter if it exists
        const legacyChapterDir = path.join(mangaDir, safeChapter)
        if (fs.existsSync(legacyChapterDir) && fs.statSync(legacyChapterDir).isDirectory()) {
          await fs.promises.rm(legacyChapterDir, { recursive: true, force: true }).catch(() => {})
        }

        await downloadRepo.updateStatus(task.mangaId, task.chapterId, 'completed')
        this.notifyStatus(task, 'completed', cachedCount, task.pageUrls.length)
      }
    } catch (err: any) {
      this.activeDownloads.delete(key)
      await downloadRepo.updateStatus(task.mangaId, task.chapterId, 'error', err.message)
      this.notifyStatus(task, 'error', cachedCount, task.pageUrls.length, err.message)
    }
  }
}

export const downloadManager = new DownloadManager()
