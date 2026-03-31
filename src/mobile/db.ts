import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite'
import { Manga, IpcResult, HistoryEntry } from '@common/types'

let _sqliteConnection: SQLiteConnection | null = null
const getSQLiteConnection = (): SQLiteConnection => {
  if (!_sqliteConnection) {
    _sqliteConnection = new SQLiteConnection(CapacitorSQLite)
  }
  return _sqliteConnection
}

let db: SQLiteDBConnection | null = null
let initPromise: Promise<void> | null = null

const DB_NAME = 'autakimi_db'

export const MobileDB = {
  async init(): Promise<IpcResult<void>> {
    if (initPromise) return initPromise.then(() => ({ ok: true, value: undefined }))

    initPromise = (async () => {
      try {
        const sqlite = getSQLiteConnection()

        const isConn = await sqlite.isConnection(DB_NAME, false)
        let connection: SQLiteDBConnection

        if (isConn.result) {
          connection = await sqlite.retrieveConnection(DB_NAME, false)
        } else {
          connection = await sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false)
        }

        if (!connection) {
          throw new Error('Failed to create SQLite connection')
        }

        await connection.open()
        db = connection
        await this.migrate(connection)
      } catch (err) {
        console.error('[MobileDB] Initialization failed:', err)
        db = null
        initPromise = null
        throw err
      }
    })()

    return initPromise.then(() => ({ ok: true, value: undefined }))
  },

  async ensureReady(): Promise<void> {
    if (!db) {
      await this.init()
    }
  },

  async migrate(connection: SQLiteDBConnection): Promise<void> {
    // Get current version
    const res = await connection.query('PRAGMA user_version;')
    let currentVersion = 0
    if (res.values && res.values.length > 0) {
      currentVersion = res.values[0].user_version || 0
    }

    const execute = async (sql: string): Promise<void> => {
      await connection.execute(sql)
    }

    // V1: Initial Core Schema (Consolidated for fresh installs)
    if (currentVersion < 1) {
      await execute(`
        CREATE TABLE IF NOT EXISTS extensions (
          pkg TEXT PRIMARY KEY,
          installed_at TEXT,
          name TEXT,
          baseUrl TEXT,
          lang TEXT,
          icon TEXT,
          version TEXT,
          code TEXT
        );
        CREATE TABLE IF NOT EXISTS library (
          id TEXT PRIMARY KEY,
          title TEXT,
          cover_url TEXT,
          status TEXT,
          metadata TEXT,
          type TEXT DEFAULT 'manga'
        );
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT
        );
        CREATE TABLE IF NOT EXISTS manga_cache (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          cover_url TEXT,
          description TEXT,
          author TEXT,
          artist TEXT,
          status TEXT,
          genres TEXT,
          url TEXT,
          updated_at TEXT,
          type TEXT DEFAULT 'manga',
          expires_at TEXT
        );
        CREATE TABLE IF NOT EXISTS reading_progress (
          manga_id TEXT,
          chapter_id TEXT,
          is_read INTEGER DEFAULT 0,
          last_page INTEGER DEFAULT 0,
          updated_at TEXT,
          PRIMARY KEY (manga_id, chapter_id)
        );
        CREATE TABLE IF NOT EXISTS reading_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          manga_id TEXT NOT NULL,
          manga_title TEXT,
          manga_cover TEXT,
          manga_url TEXT,
          chapter_id TEXT NOT NULL,
          chapter_title TEXT,
          started_at TEXT NOT NULL,
          duration_seconds INTEGER DEFAULT 0,
          pkg TEXT,
          type TEXT DEFAULT 'manga'
        );
        CREATE TABLE IF NOT EXISTS downloads (
          manga_id TEXT NOT NULL,
          chapter_id TEXT NOT NULL,
          total_pages INTEGER DEFAULT 0,
          cached_pages INTEGER DEFAULT 0,
          status TEXT,
          error_message TEXT,
          updated_at TEXT,
          page_urls TEXT,
          type TEXT DEFAULT 'manga',
          PRIMARY KEY (manga_id, chapter_id)
        );
        CREATE TABLE IF NOT EXISTS chapters (
          manga_id TEXT NOT NULL,
          id TEXT NOT NULL,
          number TEXT,
          title TEXT,
          date TEXT,
          scanlator TEXT,
          url TEXT,
          PRIMARY KEY (manga_id, id)
        );
        CREATE INDEX IF NOT EXISTS idx_progress_manga ON reading_progress(manga_id);
        CREATE INDEX IF NOT EXISTS idx_history_manga ON reading_history(manga_id);
        CREATE INDEX IF NOT EXISTS idx_history_started ON reading_history(started_at DESC);
        CREATE INDEX IF NOT EXISTS idx_downloads_status ON downloads(status);
        CREATE INDEX IF NOT EXISTS idx_chapters_manga ON chapters(manga_id);
      `)
      currentVersion = 20 // Jump to latest version for fresh installs
    }

    // Individual migrations for incremental updates (if needed in the future)
    // No changes needed for version 2-20 as they are consolidated in V1
    
    await connection.execute(`PRAGMA user_version = ${currentVersion};`)
    console.log(`[MobileDB] Migration finished. Current version: ${currentVersion}`)
  },

  // --- Helper for results ---
  async wrap<T>(promise: Promise<any>): Promise<IpcResult<T>> {
    try {
      const result = await promise
      return { ok: true, value: result }
    } catch (err: any) {
      return { ok: false, error: err.message || String(err) }
    }
  },

  // --- Repository Methods ---

  async getExtensions(): Promise<IpcResult<any[]>> {
    await this.ensureReady()
    const res = await db!.query('SELECT * FROM extensions;')
    return { ok: true, value: res.values || [] }
  },

  async addExtension(data: {
    pkg: string
    code: string
    name: string
    baseUrl: string
    lang: string
    icon: string
    version: string
  }): Promise<IpcResult<void>> {
    await this.ensureReady()
    await db!.run(
      'INSERT OR REPLACE INTO extensions (pkg, installed_at, code, name, baseUrl, lang, icon, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?);',
      [
        data.pkg,
        new Date().toISOString(),
        data.code,
        data.name,
        data.baseUrl,
        data.lang,
        data.icon,
        data.version
      ]
    )
    return { ok: true, value: undefined }
  },

  async getLibrary(args?: {
    type?: 'manga' | 'anime'
    limit?: number
    offset?: number
  }): Promise<IpcResult<Manga[]>> {
    await this.ensureReady()
    let sql = 'SELECT * FROM library'
    const params: (string | number)[] = []
    if (args?.type) {
      sql += ' WHERE type = ?'
      params.push(args.type)
    }
    if (args?.limit) {
      sql += ' LIMIT ?'
      params.push(args.limit)
    }
    if (args?.offset) {
      sql += ' OFFSET ?'
      params.push(args.offset)
    }
    const res = await db!.query(sql, params)
    return { ok: true, value: res.values || [] }
  },

  async toggleLibrary(manga: Manga): Promise<IpcResult<boolean>> {
    await this.ensureReady()
    const res = await db!.query('SELECT id FROM library WHERE id = ?;', [manga.id])
    if (res.values && res.values.length > 0) {
      await db!.run('DELETE FROM library WHERE id = ?;', [manga.id])
      return { ok: true, value: false }
    } else {
      await db!.run(
        'INSERT INTO library (id, title, cover_url, status, metadata, type) VALUES (?, ?, ?, ?, ?, ?);',
        [manga.id, manga.title, manga.coverUrl, manga.status, JSON.stringify(manga), manga.mediaType || 'manga']
      )
      return { ok: true, value: true }
    }
  },

  async getSettings(): Promise<IpcResult<Record<string, string>>> {
    await this.ensureReady()
    const res = await db!.query('SELECT * FROM settings;')
    const settings: Record<string, string> = {}
    res.values?.forEach(s => settings[s.key] = s.value)
    return { ok: true, value: settings }
  },

  async getSetting(key: string): Promise<IpcResult<string | null>> {
    await this.ensureReady()
    const res = await db!.query('SELECT value FROM settings WHERE key = ?;', [key])
    return { ok: true, value: res.values?.[0]?.value || null }
  },

  async setSetting(key: string, value: string): Promise<IpcResult<void>> {
    await this.ensureReady()
    await db!.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?);', [key, value])
    return { ok: true, value: undefined }
  },

  async getHistory(args?: {
    type?: 'manga' | 'anime'
    limit?: number
  }): Promise<IpcResult<HistoryEntry[]>> {
    await this.ensureReady()
    let sql = 'SELECT * FROM reading_history'
    const params: (string | number)[] = []
    if (typeof args === 'object' && args?.type) {
      sql += ' WHERE type = ?'
      params.push(args.type)
    }
    sql += ' ORDER BY started_at DESC'
    if (typeof args === 'object' && args?.limit) {
      sql += ' LIMIT ?'
      params.push(args.limit)
    }
    const res = await db!.query(sql, params)
    return { ok: true, value: res.values || [] }
  },

  async addHistory(data: HistoryEntry): Promise<IpcResult<void>> {
    await this.ensureReady()
    await db!.run(
      'INSERT INTO reading_history (manga_id, manga_title, manga_cover, manga_url, chapter_id, chapter_title, started_at, duration_seconds, pkg, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);',
      [
        data.mangaId,
        data.mangaTitle,
        data.mangaCover,
        data.mangaUrl,
        data.chapterId || '',
        data.chapterTitle,
        data.startedAt,
        data.durationSeconds || 0,
        data.pkg,
        data.type || 'manga'
      ]
    )
    return { ok: true, value: undefined }
  },

  async getProgress(mangaId: string): Promise<IpcResult<any[]>> {
    return this.wrap(db!.query('SELECT * FROM reading_progress WHERE manga_id = ?;', [mangaId]).then(r => r.values || []))
  },

  async updateProgress(data: any): Promise<IpcResult<any>> {
    return this.wrap(db!.run(
      'INSERT OR REPLACE INTO reading_progress (manga_id, chapter_id, is_read, last_page, updated_at) VALUES (?, ?, ?, ?, ?);',
      [data.mangaId, data.chapterId, data.isRead ? 1 : 0, data.lastPage || 0, new Date().toISOString()]
    ))
  },

  async getChapters(mangaId: string): Promise<IpcResult<any[]>> {
    await this.ensureReady()
    return this.wrap(db!.query('SELECT * FROM chapters WHERE manga_id = ?;', [mangaId]).then(r => r.values || []))
  },

  async saveChapters(args: { mangaId: string; chapters: any[] }): Promise<IpcResult<boolean>> {
    await this.ensureReady()
    await db!.run('DELETE FROM chapters WHERE manga_id = ?;', [args.mangaId])
    for (const ch of args.chapters) {
      await db!.run(
        'INSERT INTO chapters (manga_id, id, number, title, date, scanlator, url) VALUES (?, ?, ?, ?, ?, ?, ?);',
        [args.mangaId, ch.id, ch.number, ch.title, ch.date, ch.scanlator, ch.url]
      )
    }
    return { ok: true, value: true }
  },

  async getExtension(pkg: string): Promise<IpcResult<any | null>> {
    await this.ensureReady()
    const res = await db!.query('SELECT * FROM extensions WHERE pkg = ?;', [pkg])
    return { ok: true, value: res.values?.[0] || null }
  },

  async removeExtension(pkg: string): Promise<IpcResult<boolean>> {
    return this.wrap(db!.run('DELETE FROM extensions WHERE pkg = ?;', [pkg]).then(() => true))
  },

  async deleteHistoryEntry(id: number): Promise<IpcResult<any>> {
    return this.wrap(db!.run('DELETE FROM reading_history WHERE id = ?;', [id]))
  },

  async deleteHistoryByManga(mangaId: string): Promise<IpcResult<any>> {
    return this.wrap(db!.run('DELETE FROM reading_history WHERE manga_id = ?;', [mangaId]))
  },

  async clearHistory(type?: string): Promise<IpcResult<any>> {
    let sql = 'DELETE FROM reading_history'
    const params: any[] = []
    if (type) {
      sql += ' WHERE type = ?'
      params.push(type)
    }
    return this.wrap(db!.run(sql, params))
  },

  async clearLibrary(type?: string): Promise<IpcResult<any>> {
    let sql = 'DELETE FROM library'
    const params: any[] = []
    if (type) {
      sql += ' WHERE type = ?'
      params.push(type)
    }
    return this.wrap(db!.run(sql, params))
  },

  async getMangaCache(mangaId: string): Promise<IpcResult<any | null>> {
    await this.ensureReady()
    const res = await db!.query('SELECT * FROM manga_cache WHERE id = ?;', [mangaId])
    const manga = res.values?.[0]
    if (manga && manga.genres) {
      try { manga.genres = JSON.parse(manga.genres) } catch (e) {}
    }
    return { ok: true, value: manga || null }
  },

  async saveMangaCache(manga: Manga): Promise<IpcResult<any>> {
    await this.ensureReady()
    return this.wrap(db!.run(
      'INSERT OR REPLACE INTO manga_cache (id, title, cover_url, description, author, artist, status, genres, url, type, updated_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);',
      [
        manga.id,
        manga.title,
        manga.coverUrl,
        manga.description,
        manga.author,
        manga.artist,
        manga.status,
        Array.isArray(manga.genres) ? JSON.stringify(manga.genres) : manga.genres,
        manga.url,
        manga.mediaType || 'manga',
        new Date().toISOString(),
        (manga as any).expiresAt || null
      ]
    ))
  }
}
