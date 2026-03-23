import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { readingProgress } from '../schema';
import { eq } from 'drizzle-orm';

export class ProgressRepository {
  constructor(private db: BetterSQLite3Database<any>) {}

  async getProgress(mangaId: string) {
    return this.db.select({
      chapterId: readingProgress.chapterId,
      isRead: readingProgress.isRead,
      lastPage: readingProgress.lastPage
    })
    .from(readingProgress)
    .where(eq(readingProgress.mangaId, mangaId))
    .all();
  }

  async updateProgress(data: { mangaId: string, chapterId: string, isRead: boolean, lastPage?: number }) {
    const now = new Date().toISOString();
    return this.db.insert(readingProgress)
      .values({
        mangaId: data.mangaId,
        chapterId: data.chapterId,
        isRead: data.isRead,
        lastPage: data.lastPage || 0,
        updatedAt: now
      })
      .onConflictDoUpdate({
        target: [readingProgress.mangaId, readingProgress.chapterId],
        set: {
          isRead: data.isRead,
          lastPage: data.lastPage || 0,
          updatedAt: now
        }
      }).run();
  }
}
