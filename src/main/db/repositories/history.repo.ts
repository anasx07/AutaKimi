import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { desc, eq } from 'drizzle-orm';
import * as schema from '../schema';

export interface HistoryEntryInput {
  mangaId: string;
  mangaTitle?: string;
  mangaCover?: string;
  mangaUrl?: string;
  chapterId: string;
  chapterTitle?: string;
  startedAt: string;
  durationSeconds?: number;
  pkg?: string;
}

export class HistoryRepository {
  constructor(private db: BetterSQLite3Database<typeof schema>) {}

  async addEntry(entry: HistoryEntryInput) {
    return this.db.insert(schema.readingHistory).values({
      mangaId: entry.mangaId,
      mangaTitle: entry.mangaTitle || null,
      mangaCover: entry.mangaCover || null,
      mangaUrl: entry.mangaUrl || null,
      chapterId: entry.chapterId,
      chapterTitle: entry.chapterTitle || null,
      startedAt: entry.startedAt,
      durationSeconds: entry.durationSeconds || 0,
      pkg: entry.pkg || null,
    }).run();
  }

  async getHistory(limit = 50, offset = 0) {
    return this.db
      .select()
      .from(schema.readingHistory)
      .orderBy(desc(schema.readingHistory.startedAt))
      .limit(limit)
      .offset(offset)
      .all();
  }

  async deleteEntry(id: number) {
    return this.db.delete(schema.readingHistory).where(eq(schema.readingHistory.id, id)).run();
  }

  async deleteByManga(mangaId: string) {
    return this.db.delete(schema.readingHistory).where(eq(schema.readingHistory.mangaId, mangaId)).run();
  }

  async clearHistory() {
    return this.db.delete(schema.readingHistory).run();
  }
}
