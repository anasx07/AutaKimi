import { eq, and } from 'drizzle-orm';
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../schema';

export class DownloadRepository {
  constructor(private db: BetterSQLite3Database<typeof schema>) {}

  async upsert(data: any) {
    const existing = await this.db
      .select()
      .from(schema.downloads)
      .where(
        and(
          eq(schema.downloads.mangaId, data.mangaId),
          eq(schema.downloads.chapterId, data.chapterId)
        )
      )
      .get();

    if (existing) {
      return this.db
        .update(schema.downloads)
        .set({ ...data, updatedAt: new Date().toISOString() })
        .where(
          and(
            eq(schema.downloads.mangaId, data.mangaId),
            eq(schema.downloads.chapterId, data.chapterId)
          )
        )
        .run();
    } else {
      return this.db
        .insert(schema.downloads)
        .values({ ...data, updatedAt: new Date().toISOString() })
        .run();
    }
  }

  async get(mangaId: string, chapterId: string) {
    return this.db
      .select()
      .from(schema.downloads)
      .where(
        and(
          eq(schema.downloads.mangaId, mangaId),
          eq(schema.downloads.chapterId, chapterId)
        )
      )
      .get();
  }

  async getByManga(mangaId: string) {
    return this.db
      .select()
      .from(schema.downloads)
      .where(eq(schema.downloads.mangaId, mangaId))
      .all();
  }

  async getAll() {
    return this.db.select().from(schema.downloads).all();
  }

  async getDownloadedManga() {
    return this.db
      .select({
        id: schema.mangaCache.id,
        title: schema.mangaCache.title,
        coverUrl: schema.mangaCache.coverUrl,
        url: schema.mangaCache.url,
      })
      .from(schema.downloads)
      .innerJoin(schema.mangaCache, eq(schema.downloads.mangaId, schema.mangaCache.id))
      .where(eq(schema.downloads.status, 'completed'))
      .groupBy(schema.mangaCache.id)
      .all();
  }

  async remove(mangaId: string, chapterId: string) {
    return this.db
      .delete(schema.downloads)
      .where(
        and(
          eq(schema.downloads.mangaId, mangaId),
          eq(schema.downloads.chapterId, chapterId)
        )
      )
      .run();
  }
}
