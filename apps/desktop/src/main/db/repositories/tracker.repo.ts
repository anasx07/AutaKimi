import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from '../schema'
import { eq, and, asc } from 'drizzle-orm'
import { Tracker, TrackerProvider } from '@common/types'

export interface AniListQueueItem {
  id: number
  mangaId: string
  mediaId: number
  status?: string | null
  progress: number
  score?: number | null
  attempts: number
  lastError?: string | null
  createdAt: string
  updatedAt: string
}

export class TrackerRepository {
  constructor(private db: BetterSQLite3Database<typeof schema>) {}

  async getTrackers(mangaId: string): Promise<Tracker[]> {
    return this.db
      .select()
      .from(schema.trackers)
      .where(eq(schema.trackers.mangaId, mangaId))
      .all() as any
  }

  async getTracker(mangaId: string, provider: TrackerProvider): Promise<Tracker | null> {
    const row = this.db
      .select()
      .from(schema.trackers)
      .where(and(eq(schema.trackers.mangaId, mangaId), eq(schema.trackers.provider, provider)))
      .get()

    return (row as any) || null
  }

  async saveTracker(data: {
    mangaId: string
    provider: TrackerProvider
    remoteId: string
    score?: number
    status?: string
    lastSyncedChapter?: number
    updatedAt?: string
  }): Promise<{ success: boolean }> {
    const now = data.updatedAt || new Date().toISOString()
    const updateSet: Record<string, any> = {
      remoteId: data.remoteId,
      updatedAt: now
    }
    if (data.score !== undefined) updateSet.score = data.score
    if (data.status !== undefined) updateSet.status = data.status
    if (data.lastSyncedChapter !== undefined) updateSet.lastSyncedChapter = data.lastSyncedChapter

    this.db
      .insert(schema.trackers)
      .values({
        mangaId: data.mangaId,
        provider: data.provider,
        remoteId: data.remoteId,
        score: data.score !== undefined ? data.score : null,
        status: data.status || 'CURRENT',
        lastSyncedChapter: data.lastSyncedChapter ?? 0,
        updatedAt: now
      })
      .onConflictDoUpdate({
        target: [schema.trackers.mangaId, schema.trackers.provider],
        set: updateSet
      })
      .run()

    return { success: true }
  }

  async updateSyncedChapter(
    mangaId: string,
    provider: TrackerProvider,
    chapter: number
  ): Promise<void> {
    const now = new Date().toISOString()
    this.db
      .update(schema.trackers)
      .set({
        lastSyncedChapter: chapter,
        updatedAt: now
      })
      .where(and(eq(schema.trackers.mangaId, mangaId), eq(schema.trackers.provider, provider)))
      .run()
  }

  async deleteTracker(mangaId: string, provider: TrackerProvider): Promise<{ success: boolean }> {
    this.db
      .delete(schema.trackers)
      .where(and(eq(schema.trackers.mangaId, mangaId), eq(schema.trackers.provider, provider)))
      .run()

    return { success: true }
  }

  async getTrackerByRemoteId(remoteId: string, provider: TrackerProvider): Promise<Tracker | null> {
    const row = this.db
      .select()
      .from(schema.trackers)
      .where(and(eq(schema.trackers.remoteId, remoteId), eq(schema.trackers.provider, provider)))
      .get()

    return (row as any) || null
  }

  async enqueueSync(item: {
    mangaId: string
    mediaId: number
    status?: string
    progress: number
    score?: number
    lastError?: string
  }): Promise<void> {
    const now = new Date().toISOString()
    const existing = this.db
      .select()
      .from(schema.anilistSyncQueue)
      .where(eq(schema.anilistSyncQueue.mediaId, item.mediaId))
      .get()

    if (existing) {
      this.db
        .update(schema.anilistSyncQueue)
        .set({
          mangaId: item.mangaId || existing.mangaId,
          status: item.status || existing.status,
          progress: Math.max(existing.progress, item.progress),
          score: item.score !== undefined ? item.score : existing.score,
          lastError: item.lastError !== undefined ? item.lastError : existing.lastError,
          updatedAt: now
        })
        .where(eq(schema.anilistSyncQueue.id, existing.id))
        .run()
    } else {
      this.db
        .insert(schema.anilistSyncQueue)
        .values({
          mangaId: item.mangaId,
          mediaId: item.mediaId,
          status: item.status || 'CURRENT',
          progress: item.progress,
          score: item.score ?? null,
          attempts: 0,
          lastError: item.lastError ?? null,
          createdAt: now,
          updatedAt: now
        })
        .run()
    }
  }

  async getPendingSyncs(): Promise<AniListQueueItem[]> {
    return this.db
      .select()
      .from(schema.anilistSyncQueue)
      .orderBy(asc(schema.anilistSyncQueue.createdAt))
      .all() as any
  }

  async removeSyncQueueItem(id: number): Promise<void> {
    this.db
      .delete(schema.anilistSyncQueue)
      .where(eq(schema.anilistSyncQueue.id, id))
      .run()
  }

  async incrementSyncAttempts(id: number, error?: string): Promise<void> {
    const now = new Date().toISOString()
    const existing = this.db
      .select()
      .from(schema.anilistSyncQueue)
      .where(eq(schema.anilistSyncQueue.id, id))
      .get()

    if (existing) {
      this.db
        .update(schema.anilistSyncQueue)
        .set({
          attempts: (existing.attempts || 0) + 1,
          lastError: error !== undefined ? error : existing.lastError,
          updatedAt: now
        })
        .where(eq(schema.anilistSyncQueue.id, id))
        .run()
    }
  }

  async clearSyncQueue(): Promise<void> {
    this.db.delete(schema.anilistSyncQueue).run()
  }
}
