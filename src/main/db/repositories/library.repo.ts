import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { library } from '../schema';
import { eq } from 'drizzle-orm';
import { normalizeManga } from '../../../common/utils/mangaNormalizer';

export class LibraryRepository {
  constructor(private db: BetterSQLite3Database<any>) {}

  async getAll(limit?: number, offset?: number, type?: string) {
    const query = this.db.select().from(library);
    if (type) query.where(eq(library.type, type));
    if (limit !== undefined) query.limit(limit);
    if (offset !== undefined) query.offset(offset);
    return query.all();
  }

  async getById(id: string) {
    const result = this.db.select().from(library).where(eq(library.id, id)).get();
    return result || null;
  }

  async add(manga: any) {
    const normalized = normalizeManga(manga);

    return this.db.insert(library)
      .values({
        id: normalized.id,
        title: normalized.title,
        coverUrl: normalized.coverUrl,
        status: normalized.status,
        metadata: JSON.stringify(manga),
        type: normalized.mediaType || 'manga'
      }).run();
  }

  async remove(id: string) {
    return this.db.delete(library).where(eq(library.id, id)).run();
  }

  async toggle(manga: any) {
    const id = manga.id;
    const exists = await this.getById(id);
    if (exists) {
      await this.remove(id);
      return false; // Removed
    } else {
      await this.add(manga);
      return true; // Added
    }
  }
}
