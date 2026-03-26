import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../schema';
import { eq } from 'drizzle-orm';

export class ExtensionRepository {
  constructor(private db: BetterSQLite3Database<typeof schema>) {}

  async getAll() {
    return this.db.select({
      pkg: schema.extensions.pkg,
      name: schema.extensions.name,
      lang: schema.extensions.lang,
      icon: schema.extensions.icon,
      baseUrl: schema.extensions.baseUrl,
      version: schema.extensions.version,
    }).from(schema.extensions).all();
  }

  async getByPkg(pkg: string) {
    const result = this.db.select().from(schema.extensions).where(eq(schema.extensions.pkg, pkg)).get();
    return result || null;
  }

  async upsert(data: typeof schema.extensions.$inferInsert) {
    return this.db.insert(schema.extensions)
      .values(data)
      .onConflictDoUpdate({
        target: schema.extensions.pkg,
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
    return this.db.delete(schema.extensions).where(eq(schema.extensions.pkg, pkg)).run();
  }
}
