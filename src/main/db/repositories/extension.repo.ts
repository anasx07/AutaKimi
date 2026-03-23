import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { extensions } from '../schema';
import { eq } from 'drizzle-orm';

export class ExtensionRepository {
  constructor(private db: BetterSQLite3Database<any>) {}

  async getAll() {
    return this.db.select({
      pkg: extensions.pkg,
      name: extensions.name,
      lang: extensions.lang,
      icon: extensions.icon,
      baseUrl: extensions.baseUrl,
      version: extensions.version,
    }).from(extensions).all();
  }

  async getByPkg(pkg: string) {
    const result = this.db.select().from(extensions).where(eq(extensions.pkg, pkg)).get();
    return result || null;
  }

  async upsert(data: typeof extensions.$inferInsert) {
    return this.db.insert(extensions)
      .values(data)
      .onConflictDoUpdate({
        target: extensions.pkg,
        set: {
          code: data.code,
          name: data.name,
          baseUrl: data.baseUrl,
          lang: data.lang,
          icon: data.icon,
          version: data.version,
        }
      }).run();
  }

  async remove(pkg: string) {
    return this.db.delete(extensions).where(eq(extensions.pkg, pkg)).run();
  }
}
