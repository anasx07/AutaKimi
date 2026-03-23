import crypto from 'crypto'
import { downloadRepo } from '../db'
import { imageCache } from '../index'
import { NetworkService } from '../../common/services/network'

export interface DownloadTask {
  mangaId: string
  chapterId: string
  pageUrls: string[]
}

export class DownloadManager {
  private static instance: DownloadManager
  private activeDownloads: Map<string, boolean> = new Map()

  public static getInstance(): DownloadManager {
    if (!DownloadManager.instance) {
      DownloadManager.instance = new DownloadManager()
    }
    return DownloadManager.instance
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

    console.log(`[DownloadManager] Starting download for ${key} (${task.pageUrls.length} pages)`);

    try {
      let cachedCount = 0;
      for (const url of task.pageUrls) {
        if (!this.activeDownloads.get(key)) break; // Cancelled

        const hash = crypto.createHash('md5').update(url).digest('hex')
        const buffer = await imageCache.get(hash);

        if (!buffer) {
          try {
            const response = await NetworkService.fetchWithRetry(url, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': new URL(url).origin + '/'
              }
            }, 3, 1000, fetch);
            
            const resBuffer = Buffer.from(await response.arrayBuffer());
            await imageCache.set(hash, resBuffer);
          } catch (e) {
            console.error(`[DownloadManager] Failed to cache page: ${url}`, e);
            // We continue with other pages even if one fails
          }
        }
        
        cachedCount++;
        await downloadRepo.upsert({
          mangaId: task.mangaId,
          chapterId: task.chapterId,
          cachedPages: cachedCount,
          status: 'downloading'
        });
      }

      await downloadRepo.upsert({
        mangaId: task.mangaId,
        chapterId: task.chapterId,
        status: 'completed',
      });
      console.log(`[DownloadManager] Download completed for ${key}`);

    } catch (error: any) {
      console.error(`[DownloadManager] Download failed for ${key}:`, error);
      await downloadRepo.upsert({
        mangaId: task.mangaId,
        chapterId: task.chapterId,
        status: 'error',
        error: error.message
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

  async getDownloadedManga() {
    return downloadRepo.getDownloadedManga()
  }
}

export const downloadManager = DownloadManager.getInstance()
