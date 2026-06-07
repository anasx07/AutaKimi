import { downloadRepo, settingsRepo } from '../db'
import { AppService, ServicePriority } from './service.registry'
import { IpcChannel } from '@common/types/ipc'
import { stateRegistry } from './state.service'
import { broadcastService } from './broadcast.service'
import { cacheManager } from './cache.service'
import { ReactiveQueue } from '../utils/reactive-queue'
import crypto from 'crypto'
import { networkClient } from '@common'

export interface DownloadTask {
  mangaId: string
  chapterId: string
  pageUrls: string[]
  type: 'manga' | 'anime'
  mangaTitle?: string
  extensionName?: string
  chapterTitle?: string
}

export class DownloadManager implements AppService {
  public priority = ServicePriority.FEATURE
  private queue = new ReactiveQueue({ concurrency: 3 })
  public activeDownloads = new Map<string, boolean>()

  constructor() {}

  async initialize(): Promise<void> {
    const concurrency = parseInt((await settingsRepo.get('download_concurrency')) || '3')
    this.queue.setConcurrency(concurrency)
  }

  async shutdown(): Promise<void> {
    this.queue.destroy()
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
  }

  async deleteDownload(mangaId: string, chapterId: string) {
    await this.cancelDownload(mangaId, chapterId)
    await downloadRepo.remove(mangaId, chapterId)
  }

  getStatus(mangaId: string, chapterId: string) {
    const key = `${mangaId}:${chapterId}`
    return this.activeDownloads.get(key) ? 'downloading' : 'idle'
  }

  async getMangaDownloads(mangaId: string) {
    return downloadRepo.getByManga(mangaId)
  }

  async getDownloadedManga(type?: 'manga' | 'anime') {
    return downloadRepo.getDownloadedManga(type)
  }

  async clearAll(type?: 'manga' | 'anime') {
    this.queue.clear()
    this.activeDownloads.clear()
    await downloadRepo.clear(type)
  }

  private notifyStatus(
    task: DownloadTask,
    type: 'start' | 'progress' | 'completed' | 'error' | 'canceled',
    cached?: number,
    total?: number,
    error?: string
  ) {
    broadcastService.send(IpcChannel.DOWNLOAD_EVENT, {
      type,
      mangaId: task.mangaId,
      chapterId: task.chapterId,
      cached,
      total,
      error
    })

    stateRegistry.updateDownloadState(task.mangaId, task.chapterId, type)
  }

  private async processTask(task: DownloadTask) {
    const key = `${task.mangaId}:${task.chapterId}`
    let cachedCount = 0

    try {
      for (let i = 0; i < task.pageUrls.length; i++) {
        if (!this.activeDownloads.has(key)) return // Canceled

        const url = task.pageUrls[i]
        const hash = crypto.createHash('md5').update(url).digest('hex')
        const imageCache = cacheManager.getImageCache()

        try {
          const cachedBuffer = await imageCache.get(hash)
          if (!cachedBuffer) {
            let origin = 'https://'
            try {
              origin = new URL(url).origin + '/'
            } catch {
              /* ignore */
            }

            const { net, session } = await import('electron')
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
            await imageCache.set(hash, buffer)
          }

          cachedCount++
          this.notifyStatus(task, 'progress', cachedCount, task.pageUrls.length)

          await downloadRepo.updateProgress(task.mangaId, task.chapterId, cachedCount)
        } catch (err) {
          console.error(`[Download] Failed to download page ${i}:`, err)
        }
      }

      this.activeDownloads.delete(key)
      await downloadRepo.updateStatus(task.mangaId, task.chapterId, 'completed')
      this.notifyStatus(task, 'completed', cachedCount, task.pageUrls.length)
    } catch (err: any) {
      this.activeDownloads.delete(key)
      await downloadRepo.updateStatus(task.mangaId, task.chapterId, 'error', err.message)
      this.notifyStatus(task, 'error', cachedCount, task.pageUrls.length, err.message)
    }
  }
}

export const downloadManager = new DownloadManager()
