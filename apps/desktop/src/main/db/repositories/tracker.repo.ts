import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from '../schema'
import { eq, and } from 'drizzle-orm'
import { Tracker, TrackerProvider } from '@common/types'

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
}
