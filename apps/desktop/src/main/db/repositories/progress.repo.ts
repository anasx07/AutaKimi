import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from '../schema'
import { eq } from 'drizzle-orm'

export class ProgressRepository {
  constructor(private db: BetterSQLite3Database<typeof schema>) {}

  async getProgress(mangaId: string) {
    return this.db
      .select({
        chapterId: schema.readingProgress.chapterId,
        isRead: schema.readingProgress.isRead,
        lastPage: schema.readingProgress.lastPage
      })
      .from(schema.readingProgress)
      .where(eq(schema.readingProgress.mangaId, mangaId))
      .all()
  }

  async getAllProgress() {
    return this.db
      .select({
        mangaId: schema.readingProgress.mangaId,
        chapterId: schema.readingProgress.chapterId,
        isRead: schema.readingProgress.isRead,
        lastPage: schema.readingProgress.lastPage,
        updatedAt: schema.readingProgress.updatedAt
      })
      .from(schema.readingProgress)
      .all()
  }

  async updateProgress(data: {
    mangaId: string
    chapterId: string
    isRead: boolean
    lastPage?: number
    updatedAt?: string
  }) {
    const now = data.updatedAt || new Date().toISOString()
    const updateSet: Record<string, any> = {
      isRead: data.isRead,
      updatedAt: now
    }
    if (data.lastPage !== undefined) {
      updateSet.lastPage = data.lastPage
    }

    return this.db
      .insert(schema.readingProgress)
      .values({
        mangaId: data.mangaId,
        chapterId: data.chapterId,
        isRead: data.isRead,
        lastPage: data.lastPage ?? 0,
        updatedAt: now
      })
      .onConflictDoUpdate({
        target: [schema.readingProgress.mangaId, schema.readingProgress.chapterId],
        set: updateSet
      })
      .run()
  }

  async updateProgressBatch(data: {
    mangaId: string
    chapterIds: string[]
    isRead: boolean
    lastPage?: number
    updatedAt?: string
  }) {
    if (!data || !data.mangaId || !Array.isArray(data.chapterIds) || data.chapterIds.length === 0) {
      return { success: true }
    }
    const now = data.updatedAt || new Date().toISOString()
    const lastPage = data.lastPage || 0

    this.db.transaction((tx) => {
      for (const chapterId of data.chapterIds) {
        tx.insert(schema.readingProgress)
          .values({
            mangaId: data.mangaId,
            chapterId,
            isRead: data.isRead,
            lastPage,
            updatedAt: now
          })
          .onConflictDoUpdate({
            target: [schema.readingProgress.mangaId, schema.readingProgress.chapterId],
            set: {
              isRead: data.isRead,
              lastPage,
              updatedAt: now
            }
          })
          .run()
      }
    })

    return { success: true }
  }
}
