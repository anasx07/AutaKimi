import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../schema';
import { eq } from 'drizzle-orm';

export class ProgressRepository {
  constructor(private db: BetterSQLite3Database<typeof schema>) {}

  async getProgress(mangaId: string) {
    return this.db.select({
      chapterId: schema.readingProgress.chapterId,
      isRead: schema.readingProgress.isRead,
      lastPage: schema.readingProgress.lastPage
    })
    .from(schema.readingProgress)
    .where(eq(schema.readingProgress.mangaId, mangaId))
    .all();
  }

  async updateProgress(data: { mangaId: string, chapterId: string, isRead: boolean, lastPage?: number }) {
    const now = new Date().toISOString();
    return this.db.insert(schema.readingProgress)
      .values({
        mangaId: data.mangaId,
        chapterId: data.chapterId,
        isRead: data.isRead,
        lastPage: data.lastPage || 0,
        updatedAt: now
      })
      .onConflictDoUpdate({
        target: [schema.readingProgress.mangaId, schema.readingProgress.chapterId],
        set: {
          isRead: data.isRead,
          lastPage: data.lastPage || 0,
          updatedAt: now
        }
      }).run();
  }
}
