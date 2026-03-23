import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { settings } from '../schema';
import { eq } from 'drizzle-orm';

export class SettingsRepository {
  constructor(private db: BetterSQLite3Database<any>) {}

  async get(key: string) {
    const result = this.db.select().from(settings).where(eq(settings.key, key)).get();
    return result ? result.value : null;
  }

  async set(key: string, value: string) {
    return this.db.insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value }
      }).run();
  }

  async getAll() {
    return this.db.select().from(settings).all();
  }
}
