import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { desc, eq, and } from 'drizzle-orm'
import * as schema from '../schema'

export interface HistoryEntryInput {
  mangaId: string
  mangaTitle?: string
  mangaCover?: string
  mangaUrl?: string
  chapterId: string
  chapterTitle?: string
  startedAt: string
  durationSeconds?: number
  pkg?: string
  type?: 'manga' | 'anime'
}

export class HistoryRepository {
  constructor(private db: BetterSQLite3Database<typeof schema>) {}

  async addEntry(entry: HistoryEntryInput) {
    try {
      const result = this.db
        .insert(schema.readingHistory)
        .values({
          mangaId: entry.mangaId,
          mangaTitle: entry.mangaTitle || null,
          mangaCover: entry.mangaCover || null,
          mangaUrl: entry.mangaUrl || null,
          chapterId: entry.chapterId,
          chapterTitle: entry.chapterTitle || null,
          startedAt: entry.startedAt,
          durationSeconds: entry.durationSeconds || 0,
          pkg: entry.pkg || null,
          mediaType: entry.type || 'manga'
        })
        .run()
      return result
    } catch (err) {
      throw err
    }
  }

  async updateDuration(mangaId: string, chapterId: string, durationSeconds: number) {
    try {
      const latest = this.db
        .select({ id: schema.readingHistory.id, currentDuration: schema.readingHistory.durationSeconds })
        .from(schema.readingHistory)
        .where(
          and(
            eq(schema.readingHistory.mangaId, mangaId),
            eq(schema.readingHistory.chapterId, chapterId)
          )
        )
        .orderBy(desc(schema.readingHistory.startedAt))
        .limit(1)
        .get()

      if (latest) {
        const newDuration = Math.max(latest.currentDuration || 0, durationSeconds)
        return this.db
          .update(schema.readingHistory)
          .set({ durationSeconds: newDuration })
          .where(eq(schema.readingHistory.id, latest.id))
          .run()
      }
      return { changes: 0 }
    } catch (err) {
      console.error('[HistoryRepo] Failed to update duration:', err)
      throw err
    }
  }

  async getHistory(limit = 50, offset = 0, type?: 'manga' | 'anime') {
    try {
      let query = this.db.select().from(schema.readingHistory).$dynamic()

      if (type) {
        query = query.where(eq(schema.readingHistory.mediaType, type))
      }

      const rows = query
        .orderBy(desc(schema.readingHistory.startedAt))
        .limit(limit)
        .offset(offset)
        .all()

      return rows
    } catch (err) {
      // Fallback: try without type filter
      try {
        const fallbackRows = this.db
          .select()
          .from(schema.readingHistory)
          .orderBy(desc(schema.readingHistory.startedAt))
          .limit(limit)
          .offset(offset)
          .all()
        return fallbackRows
      } catch (fallbackErr) {
        return []
      }
    }
  }

  async deleteEntry(id: number) {
    return this.db.delete(schema.readingHistory).where(eq(schema.readingHistory.id, id)).run()
  }

  async deleteByManga(mangaId: string) {
    return this.db
      .delete(schema.readingHistory)
      .where(eq(schema.readingHistory.mangaId, mangaId))
      .run()
  }

  async clearHistory(type?: 'manga' | 'anime') {
    let query = this.db.delete(schema.readingHistory).$dynamic()
    if (type) {
      query = query.where(eq(schema.readingHistory.mediaType, type))
    }
    return query.run()
  }
}
