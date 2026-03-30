import { eq, and, inArray, SQL } from 'drizzle-orm'
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from '../schema'
import { DownloadEntry, DownloadedMedia } from '../../../common/types/download'

export class DownloadRepository {
  constructor(private db: BetterSQLite3Database<typeof schema>) {}

  async upsert(data: any): Promise<any> {
    const existing = await this.db
      .select()
      .from(schema.downloads)
      .where(
        and(
          eq(schema.downloads.mangaId, data.mangaId),
          eq(schema.downloads.chapterId, data.chapterId)
        )
      )
      .get()

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
        .run()
    } else {
      return this.db
        .insert(schema.downloads)
        .values({ ...data, updatedAt: new Date().toISOString() })
        .run()
    }
  }

  async get(mangaId: string, chapterId: string): Promise<DownloadEntry | undefined> {
    const row = await this.db
      .select()
      .from(schema.downloads)
      .where(and(eq(schema.downloads.mangaId, mangaId), eq(schema.downloads.chapterId, chapterId)))
      .get()
    return row as DownloadEntry | undefined
  }

  async getByManga(mangaId: string): Promise<DownloadEntry[]> {
    const rows = await this.db
      .select()
      .from(schema.downloads)
      .where(eq(schema.downloads.mangaId, mangaId))
      .all()
    return rows as DownloadEntry[]
  }

  async getAll(): Promise<DownloadEntry[]> {
    const rows = await this.db.select().from(schema.downloads).all()
    return rows as DownloadEntry[]
  }

  async getDownloadedManga(type?: 'manga' | 'anime'): Promise<DownloadedMedia[]> {
    const filters: SQL[] = [eq(schema.downloads.status, 'completed')]
    if (type) {
      filters.push(eq(schema.downloads.mediaType, type))
    }

    const rows = await this.db
      .select({
        id: schema.downloads.mangaId,
        title: schema.mangaCache.title,
        coverUrl: schema.mangaCache.coverUrl,
        url: schema.mangaCache.url,
        mediaType: schema.downloads.mediaType
      })
      .from(schema.downloads)
      .leftJoin(schema.mangaCache, eq(schema.downloads.mangaId, schema.mangaCache.id))
      .where(and(...filters))
      .groupBy(schema.downloads.mangaId)
      .all()

    return rows.map((r) => ({
      id: r.id,
      title: r.title || 'Unknown Title',
      coverUrl: r.coverUrl,
      url: r.url,
      mediaType: r.mediaType as 'manga' | 'anime' | null
    }))
  }

  async recoverOrphanedDownloads(): Promise<any> {
    return this.db
      .update(schema.downloads)
      .set({ status: 'paused', updatedAt: new Date().toISOString() })
      .where(eq(schema.downloads.status, 'downloading'))
      .run()
  }

  async remove(mangaId: string, chapterId: string): Promise<any> {
    return this.db
      .delete(schema.downloads)
      .where(and(eq(schema.downloads.mangaId, mangaId), eq(schema.downloads.chapterId, chapterId)))
      .run()
  }

  async clear(type?: 'manga' | 'anime'): Promise<any> {
    if (!type) {
      return this.db.delete(schema.downloads).run()
    }

    const mangaIdsToClear = this.db
      .select({ id: schema.mangaCache.id })
      .from(schema.mangaCache)
      .where(eq(schema.mangaCache.mediaType, type))
      .all()
      .map((m) => m.id)

    if (mangaIdsToClear.length === 0) return

    return this.db
      .delete(schema.downloads)
      .where(inArray(schema.downloads.mangaId, mangaIdsToClear))
      .run()
  }
}
