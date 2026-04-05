import { MangaCacheRepository } from '../db/repositories/manga_cache.repo'
import { AppService } from './service.registry'
import { WebContents, app } from 'electron'
import { DiskCache } from '../cache/DiskCache'
import path from 'path'

export enum CacheGroup {
  IMAGES = 'images',
  MANGA_METADATA = 'manga_metadata',
  BROWSE_LISTS = 'browse_lists',
  CHAPTER_LISTS = 'chapter_lists'
}

const MAX_IMAGE_CACHE_SIZE = 500 * 1024 * 1024 // 500MB

export interface CacheTTL {
  [CacheGroup.IMAGES]: number // ms
  [CacheGroup.MANGA_METADATA]: number
  [CacheGroup.BROWSE_LISTS]: number
  [CacheGroup.CHAPTER_LISTS]: number
}

export const DEFAULT_TTL: CacheTTL = {
  [CacheGroup.IMAGES]: 30 * 24 * 60 * 60 * 1000, // 30 days
  [CacheGroup.MANGA_METADATA]: 7 * 24 * 60 * 60 * 1000, // 7 days
  [CacheGroup.BROWSE_LISTS]: 24 * 60 * 60 * 1000, // 24 hours
  [CacheGroup.CHAPTER_LISTS]: 12 * 60 * 60 * 1000 // 12 hours
}

export class CacheManager implements AppService {
  private static instance: CacheManager
  private webContents: WebContents | null = null
  private mangaRepo: MangaCacheRepository | null = null
  private imageCache: DiskCache | null = null

  private constructor() {}

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager()
    }
    return CacheManager.instance
  }

  setWebContents(wc: WebContents): void {
    this.webContents = wc
  }

  setMangaRepo(repo: MangaCacheRepository): void {
    this.mangaRepo = repo
  }

  async initialize(): Promise<void> {
    const userDataPath = app.getPath('userData')
    const cacheDir = path.join(userDataPath, 'image_cache')
    this.imageCache = new DiskCache(cacheDir, MAX_IMAGE_CACHE_SIZE)

    console.log('[CacheManager] Initialized with DiskCache at:', cacheDir)
    // Run initial cleanup
    await this.cleanup()
  }

  getImageCache(): DiskCache {
    if (!this.imageCache) {
      // Fallback for case where it's accessed before initialization
      const userDataPath = app.getPath('userData')
      const cacheDir = path.join(userDataPath, 'image_cache')
      this.imageCache = new DiskCache(cacheDir, MAX_IMAGE_CACHE_SIZE)
    }
    return this.imageCache
  }

  async shutdown(): Promise<void> {
    console.log('[CacheManager] Shutting down')
  }

  async cleanup(): Promise<void> {
    console.log('[CacheManager] Running periodic cleanup...')

    // 1. Cleanup Disk Cache (Images) - managed by DiskCache itself on set,
    // but we can trigger a full check here.
    if (this.imageCache) {
      await this.imageCache.evict()
    }

    // 2. Cleanup SQLITE (Manga Metadata)
    if (this.mangaRepo) {
      await this.mangaRepo.cleanupExpired(new Date().toISOString())
    }

    // 3. Notify Renderer to cleanup Memory Cache
    this.broadcastInvalidation(CacheGroup.BROWSE_LISTS)
    this.broadcastInvalidation(CacheGroup.CHAPTER_LISTS)
  }

  async invalidate(group: CacheGroup, key?: string): Promise<void> {
    console.log(`[CacheManager] Invalidating group: ${group}${key ? `, key: ${key}` : ''}`)

    switch (group) {
      case CacheGroup.IMAGES:
        if (key) {
          // Invalidate specific image? (Rarely needed as they are hashed)
        } else if (this.imageCache) {
          await this.imageCache.clear()
        }
        break
      case CacheGroup.MANGA_METADATA:
        // Triggered when manual refresh happens
        break
      default:
        // Memory caches in renderer
        break
    }

    this.broadcastInvalidation(group, key)
  }

  private broadcastInvalidation(group: CacheGroup, key?: string) {
    if (this.webContents) {
      this.webContents.send('CACHE_INVALIDATE', { group, key })
    }
  }

  getExpiryDate(group: CacheGroup): string {
    const ttl = DEFAULT_TTL[group]
    return new Date(Date.now() + ttl).toISOString()
  }
}
