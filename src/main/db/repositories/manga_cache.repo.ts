import { eq } from 'drizzle-orm';
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../schema';

export class MangaCacheRepository {
  constructor(private db: BetterSQLite3Database<typeof schema>) {}

  async upsert(manga: any) {
    const genres = manga.genres ? JSON.stringify(manga.genres) : null;
    
    // Check if exists
    const existing = await this.db.select().from(schema.mangaCache).where(eq(schema.mangaCache.id, manga.id)).get();

    if (existing) {
      await this.db.update(schema.mangaCache)
        .set({
          title: manga.title,
          coverUrl: manga.coverUrl || null,
          description: manga.description || null,
          author: manga.author || null,
          artist: manga.artist || null,
          status: manga.status || null,
          genres: genres,
          url: manga.url || null,
          updatedAt: new Date().toISOString()
        })
        .where(eq(schema.mangaCache.id, manga.id))
        .run();
    } else {
      await this.db.insert(schema.mangaCache)
        .values({
          id: manga.id,
          title: manga.title,
          coverUrl: manga.coverUrl || null,
          description: manga.description || null,
          author: manga.author || null,
          artist: manga.artist || null,
          status: manga.status || null,
          genres: genres,
          url: manga.url || null,
          updatedAt: new Date().toISOString()
        })
        .run();
    }
  }

  async get(id: string) {
    const row = await this.db.select().from(schema.mangaCache).where(eq(schema.mangaCache.id, id)).get();
    if (!row) return null;
    
    return {
      ...row,
      genres: row.genres ? JSON.parse(row.genres) : []
    };
  }
}
