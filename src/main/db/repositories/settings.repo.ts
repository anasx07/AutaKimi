import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../schema';
import { eq } from 'drizzle-orm';

export class SettingsRepository {
  constructor(private db: BetterSQLite3Database<typeof schema>) {}

  async get(key: string) {
    const result = this.db.select().from(schema.settings).where(eq(schema.settings.key, key)).get();
    return result ? result.value : null;
  }

  async set(key: string, value: string) {
    return this.db.insert(schema.settings)
      .values({ key, value })
      .onConflictDoUpdate({
        target: schema.settings.key,
        set: { value }
      }).run();
  }

  async getAll() {
    return this.db.select().from(schema.settings).all();
  }
}
