import { eq, lte } from 'drizzle-orm'
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from '../schema'

export class MangaCacheRepository {
  constructor(private db: BetterSQLite3Database<typeof schema>) {}

  async upsert(manga: any, expiresAt?: string) {
    const genres = manga.genres ? JSON.stringify(manga.genres) : null
    const type = manga.mediaType || 'manga'

    // Check if exists
    const existing = await this.db
      .select()
      .from(schema.mangaCache)
      .where(eq(schema.mangaCache.id, manga.id))
      .get()

    if (existing) {
      await this.db
        .update(schema.mangaCache)
        .set({
          title: manga.title,
          coverUrl: manga.coverUrl || null,
          description: manga.description || null,
          author: manga.author || null,
          artist: manga.artist || null,
          status: manga.status || null,
          genres: genres,
          url: manga.url || null,
          mediaType: type,
          updatedAt: new Date().toISOString(),
          expiresAt: expiresAt || null
        })
        .where(eq(schema.mangaCache.id, manga.id))
        .run()
    } else {
      await this.db
        .insert(schema.mangaCache)
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
          mediaType: type,
          updatedAt: new Date().toISOString(),
          expiresAt: expiresAt || null
        })
        .run()
    }
  }

  async get(id: string) {
    const row = await this.db
      .select()
      .from(schema.mangaCache)
      .where(eq(schema.mangaCache.id, id))
      .get()
    if (!row) return null

    // TTL Check: If row has an expiry date and it's in the past, return null
    if (row.expiresAt && new Date(row.expiresAt) < new Date()) {
      return null
    }

    return {
      ...row,
      genres: row.genres ? JSON.parse(row.genres) : []
    }
  }

  async cleanupExpired(now: string): Promise<void> {
    await this.db.delete(schema.mangaCache).where(lte(schema.mangaCache.expiresAt, now)).run()
  }
}
