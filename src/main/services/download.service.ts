import { net } from 'electron'
import crypto from 'crypto'
import { downloadRepo, settingsRepo } from '../db'
import { imageCache } from '../index'
import { NetworkService } from '../../common/services/network'
import { NetworkConfig } from '../../common/config/network'
import { AppService } from './service.registry'

export interface DownloadTask {
  mangaId: string
  chapterId: string
  pageUrls: string[]
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
  async function worker() {
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
  private activeDownloads: Map<string, boolean> = new Map()

  public static getInstance(): DownloadManager {
    if (!DownloadManager.instance) {
      DownloadManager.instance = new DownloadManager()
    }
    return DownloadManager.instance
  }

  async initialize() {
    console.log('[DownloadManager] Initializing and recovering downloads...');
    await downloadRepo.recoverOrphanedDownloads();
  }

  async shutdown() {
    console.log('[DownloadManager] Shutting down, pausing active downloads...');
    for (const [key] of this.activeDownloads) {
      this.activeDownloads.set(key, false);
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
    } catch { /* ignore, use default */ }
    return 3
  }

  async startDownload(task: DownloadTask) {
    const key = `${task.mangaId}:${task.chapterId}`
    if (this.activeDownloads.has(key)) return

    this.activeDownloads.set(key, true)

    await downloadRepo.upsert({
      mangaId: task.mangaId,
      chapterId: task.chapterId,
      totalPages: task.pageUrls.length,
      cachedPages: 0,
      status: 'downloading',
      pageUrls: JSON.stringify(task.pageUrls),
    });

    const concurrency = await this.getConcurrency()
    console.log(`[DownloadManager] Starting download for ${key} (${task.pageUrls.length} pages, concurrency=${concurrency})`);

    try {
      // Atomic counter — safe since JS is single-threaded
      let cachedCount = 0;

      await runWithPool(task.pageUrls, concurrency, async (url) => {
        if (!this.activeDownloads.get(key)) return; // Cancelled

        const hash = crypto.createHash('md5').update(url).digest('hex')
        const buffer = await imageCache.get(hash);

        if (!buffer) {
          try {
            const response = await NetworkService.fetchWithRetry(url, {
              headers: {
                'User-Agent': NetworkConfig.DEFAULT_UA,
                'Referer': new URL(url).origin + '/'
              }
            }, NetworkConfig.DEFAULT_RETRY_ATTEMPTS, NetworkConfig.DEFAULT_RETRY_DELAY, net.fetch);

            const resBuffer = Buffer.from(await response.arrayBuffer());
            await imageCache.set(hash, resBuffer);

            // Only count successfully cached pages (bug fix: was counting even on failure)
            cachedCount++;
          } catch (e) {
            console.error(`[DownloadManager] Failed to cache page: ${url}`, e);
            return; // Continue with remaining pages
          }
        } else {
          // Already cached
          cachedCount++;
        }

        await downloadRepo.upsert({
          mangaId: task.mangaId,
          chapterId: task.chapterId,
          cachedPages: cachedCount,
          status: 'downloading'
        });
      });

      await downloadRepo.upsert({
        mangaId: task.mangaId,
        chapterId: task.chapterId,
        status: 'completed',
      });
      console.log(`[DownloadManager] Download completed for ${key}`);

    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error(`[DownloadManager] Download failed for ${key}:`, error);
      await downloadRepo.upsert({
        mangaId: task.mangaId,
        chapterId: task.chapterId,
        status: 'error',
        error: msg
      });
    } finally {
      this.activeDownloads.delete(key);
    }
  }

  cancelDownload(mangaId: string, chapterId: string) {
    const key = `${mangaId}:${chapterId}`
    this.activeDownloads.set(key, false)
  }

  async getStatus(mangaId: string, chapterId: string) {
    return downloadRepo.get(mangaId, chapterId)
  }

  async getMangaDownloads(mangaId: string) {
    return downloadRepo.getByManga(mangaId)
  }

  async getDownloadedManga(type?: 'manga' | 'anime') {
    return downloadRepo.getDownloadedManga(type)
  }
}

export const downloadManager = DownloadManager.getInstance()
