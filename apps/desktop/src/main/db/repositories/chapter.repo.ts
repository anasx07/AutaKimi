import { eq } from 'drizzle-orm'
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from '../schema'

export class ChapterRepository {
  constructor(private db: BetterSQLite3Database<typeof schema>) {}

  async upsertMany(mangaId: string, chapters: any[]) {
    // Delete old chapters for this manga before saving new ones
    // This simplifies the sync process since extensions often return fresh snapshots
    this.db.transaction(() => {
      this.db.delete(schema.chapters).where(eq(schema.chapters.mangaId, mangaId)).run()

      if (chapters.length === 0) return

      const values = chapters.map((c) => ({
        mangaId,
        id: c.id,
        number: c.number?.toString() || null,
        title: c.title || null,
        date: c.date || null,
        scanlator: c.scanlator || null,
        url: c.url || null
      }))

      // Better-sqlite3 has a limit of 999 parameters per query.
      // We chunk the inserts to be safe.
      const chunkSize = 100
      for (let i = 0; i < values.length; i += chunkSize) {
        const chunk = values.slice(i, i + chunkSize)
        this.db.insert(schema.chapters).values(chunk).run()
      }
    })
  }

  async getByManga(mangaId: string) {
    return this.db.select().from(schema.chapters).where(eq(schema.chapters.mangaId, mangaId)).all()
  }
}
