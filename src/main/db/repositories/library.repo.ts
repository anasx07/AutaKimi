import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from '../schema'
import { eq } from 'drizzle-orm'
import { normalizeManga } from '../../../common/utils/mangaNormalizer'

export class LibraryRepository {
  constructor(private db: BetterSQLite3Database<typeof schema>) {}

  async getAll(limit?: number, offset?: number, type?: 'manga' | 'anime') {
    let query = this.db.select().from(schema.library).$dynamic()
    if (type) query = query.where(eq(schema.library.mediaType, type))
    if (limit !== undefined) query = query.limit(limit)
    if (offset !== undefined) query = query.offset(offset)
    return query.all()
  }

  async getById(id: string) {
    const result = this.db.select().from(schema.library).where(eq(schema.library.id, id)).get()
    return result || null
  }

  async add(manga: any) {
    const normalized = normalizeManga(manga)

    return this.db
      .insert(schema.library)
      .values({
        id: normalized.id,
        title: normalized.title,
        coverUrl: normalized.coverUrl,
        status: normalized.status,
        metadata: JSON.stringify(manga),
        mediaType: normalized.mediaType || 'manga'
      })
      .run()
  }

  async remove(id: string) {
    return this.db.delete(schema.library).where(eq(schema.library.id, id)).run()
  }

  async toggle(manga: any) {
    const id = manga.id
    const exists = await this.getById(id)
    if (exists) {
      await this.remove(id)
      return false // Removed
    } else {
      await this.add(manga)
      return true // Added
    }
  }
 
  async clear(type?: 'manga' | 'anime') {
    let query = this.db.delete(schema.library).$dynamic()
    if (type) {
      query = query.where(eq(schema.library.mediaType, type))
    }
    return query.run()
  }
}
