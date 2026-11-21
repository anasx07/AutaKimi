import * as SQLite from 'expo-sqlite'
import { Manga, IpcResult, HistoryEntry, Chapter, DownloadEntry } from '@common/types'
import { Extension } from '@common/types'

type SuccessResult = IpcResult<{ success?: boolean; error?: string }>

let db: SQLite.SQLiteDatabase | null = null
let initPromise: Promise<IpcResult<void>> | null = null
const DB_NAME = 'autakimi_db'

export const MobileDB = {
  init(): Promise<IpcResult<void>> {
    if (initPromise) {
      return initPromise
    }

    initPromise = (async () => {
      try {
        if (!db) {
          db = await SQLite.openDatabaseAsync(DB_NAME)
          await this.migrate(db)
        }
        return { ok: true, value: undefined }
      } catch (err: any) {
        console.error('[MobileDB Native] Initialization failed:', err)
        initPromise = null
        return { ok: false, error: err.message || String(err) }
      }
    })()

    return initPromise
  },

  async ensureReady(): Promise<void> {
    await this.init()
  },

  async migrate(connection: SQLite.SQLiteDatabase): Promise<void> {
    // Get current version
    const res = await connection.getFirstAsync<{ user_version: number }>('PRAGMA user_version;')
    let currentVersion = res?.user_version || 0

    // V1: Initial Core Schema
    if (currentVersion < 1) {
      await connection.execAsync(`
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
        CREATE TABLE IF NOT EXISTS downloads (
          manga_id TEXT NOT NULL,
          chapter_id TEXT NOT NULL,
          total_pages INTEGER DEFAULT 0,
          cached_pages INTEGER DEFAULT 0,
          status TEXT,
          page_urls TEXT,
          error_message TEXT,
          updated_at TEXT,
          type TEXT DEFAULT 'manga',
          manga_title TEXT,
          chapter_title TEXT,
          PRIMARY KEY (manga_id, chapter_id)
        );
      `)

      // Indices
      await connection.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_progress_manga ON reading_progress(manga_id);
        CREATE INDEX IF NOT EXISTS idx_history_manga ON reading_history(manga_id);
        CREATE INDEX IF NOT EXISTS idx_history_started ON reading_history(started_at DESC);
        CREATE INDEX IF NOT EXISTS idx_chapters_manga ON chapters(manga_id);
        CREATE INDEX IF NOT EXISTS idx_downloads_status ON downloads(status);
        CREATE INDEX IF NOT EXISTS idx_downloads_type ON downloads(type);
      `)

      currentVersion = 21
      await connection.execAsync(`PRAGMA user_version = ${currentVersion};`)
    }

    if (currentVersion < 21) {
      await connection.execAsync(`
        CREATE TABLE IF NOT EXISTS downloads (
          manga_id TEXT NOT NULL,
          chapter_id TEXT NOT NULL,
          total_pages INTEGER DEFAULT 0,
          cached_pages INTEGER DEFAULT 0,
          status TEXT,
          page_urls TEXT,
          error_message TEXT,
          updated_at TEXT,
          type TEXT DEFAULT 'manga',
          manga_title TEXT,
          chapter_title TEXT,
          PRIMARY KEY (manga_id, chapter_id)
        );
        CREATE INDEX IF NOT EXISTS idx_downloads_status ON downloads(status);
        CREATE INDEX IF NOT EXISTS idx_downloads_type ON downloads(type);
      `)

      // Migrate legacy downloads from settings if any exist
      try {
        const legacySettings = await connection.getAllAsync<{ key: string; value: string }>(
          "SELECT key, value FROM settings WHERE key LIKE 'dl_meta_%';"
        )
        for (const item of legacySettings || []) {
          try {
            const raw = item.key.slice('dl_meta_'.length)
            const statusRow = await connection.getFirstAsync<{ value: string }>(
              'SELECT value FROM settings WHERE key = ?;',
              [`dl_status_${raw}`]
            )
            const meta = JSON.parse(item.value || '{}')
            const lastColon = raw.lastIndexOf(':')
            if (lastColon > 0) {
              const mangaId = raw.slice(0, lastColon)
              const chapterId = raw.slice(lastColon + 1)
              await connection.runAsync(
                `INSERT OR IGNORE INTO downloads 
                  (manga_id, chapter_id, total_pages, cached_pages, status, page_urls, updated_at, type, manga_title, chapter_title)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
                [
                  mangaId,
                  chapterId,
                  meta.totalPages || 0,
                  meta.totalPages || 0,
                  statusRow?.value || 'completed',
                  meta.pageUrls ? JSON.stringify(meta.pageUrls) : null,
                  meta.downloadedAt || new Date().toISOString(),
                  meta.type || 'manga',
                  meta.mangaTitle || null,
                  meta.chapterTitle || null
                ]
              )
            }
          } catch {}
        }
      } catch (e) {
        console.warn('[MobileDB] Legacy downloads migration skipped/failed:', e)
      }

      currentVersion = 21
      await connection.execAsync(`PRAGMA user_version = ${currentVersion};`)
    }
  },

  async getExtensions(): Promise<IpcResult<any[]>> {
    await this.ensureReady()
    const res = await db!.getAllAsync<any>('SELECT * FROM extensions;')
    return { ok: true, value: res }
  },

  async addExtension(data: any): Promise<SuccessResult> {
    await this.ensureReady()
    await db!.runAsync(
      'INSERT OR REPLACE INTO extensions (pkg, installed_at, code, name, baseUrl, lang, icon, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?);',
      [
        data.pkg ?? null,
        new Date().toISOString(),
        data.code ?? null,
        data.name ?? null,
        data.baseUrl ?? null,
        data.lang ?? null,
        data.icon ?? null,
        data.version ?? null
      ]
    )
    return { ok: true, value: { success: true } }
  },

  async removeExtension(pkg: string): Promise<IpcResult<boolean>> {
    await this.ensureReady()
    await db!.runAsync('DELETE FROM extensions WHERE pkg = ?;', [pkg])
    return { ok: true, value: true }
  },

  async getExtension(pkg: string): Promise<IpcResult<any>> {
    await this.ensureReady()
    const res = await db!.getFirstAsync<any>('SELECT * FROM extensions WHERE pkg = ?;', [pkg])
    return { ok: true, value: res || null }
  },

  async getLibrary(args?: {
    type?: string
    limit?: number
    offset?: number
  }): Promise<IpcResult<Manga[]>> {
    await this.ensureReady()
    let sql = 'SELECT * FROM library'
    const params: any[] = []
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
    const res = await db!.getAllAsync<any>(sql, params)
    const mapped = (res || []).map((row) => {
      let meta: any = {}
      try {
        meta = JSON.parse(row.metadata || '{}')
      } catch {}
      return {
        ...meta,
        id: row.id,
        title: row.title,
        coverUrl: row.cover_url || meta.coverUrl,
        status: row.status,
        mediaType: row.type || meta.mediaType || 'manga',
        type: row.type || meta.mediaType || 'manga'
      }
    })
    return { ok: true, value: mapped }
  },

  async toggleLibrary(manga: Manga): Promise<IpcResult<boolean>> {
    await this.ensureReady()
    const res = await db!.getFirstAsync<any>('SELECT id FROM library WHERE id = ?;', [manga.id])
    if (res) {
      await db!.runAsync('DELETE FROM library WHERE id = ?;', [manga.id])
      return { ok: true, value: false }
    } else {
      await db!.runAsync(
        'INSERT INTO library (id, title, cover_url, status, metadata, type) VALUES (?, ?, ?, ?, ?, ?);',
        [
          manga.id ?? null,
          manga.title ?? null,
          manga.coverUrl ?? null,
          manga.status ?? null,
          JSON.stringify(manga),
          manga.mediaType || 'manga'
        ]
      )
      return { ok: true, value: true }
    }
  },

  async getSettings(): Promise<IpcResult<Record<string, string>>> {
    await this.ensureReady()
    const res = await db!.getAllAsync<{ key: string; value: string }>('SELECT * FROM settings;')
    const settings: Record<string, string> = {}
    res.forEach((s) => (settings[s.key] = s.value))
    return { ok: true, value: settings }
  },

  async getSetting(key: string): Promise<IpcResult<string | null>> {
    await this.ensureReady()
    const res = await db!.getFirstAsync<{ value: string }>(
      'SELECT value FROM settings WHERE key = ?;',
      [key]
    )
    return { ok: true, value: res?.value || null }
  },

  async setSetting(key: string, value: string): Promise<SuccessResult> {
    await this.ensureReady()
    await db!.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?);', [key, value])
    return { ok: true, value: { success: true } }
  },

  async getHistory(args?: { type?: string; limit?: number }): Promise<IpcResult<HistoryEntry[]>> {
    await this.ensureReady()
    let sql = 'SELECT * FROM reading_history'
    const params: any[] = []
    if (args?.type) {
      sql += ' WHERE type = ?'
      params.push(args.type)
    }
    sql += ' ORDER BY started_at DESC'
    if (args?.limit) {
      sql += ' LIMIT ?'
      params.push(args.limit)
    }
    const res = await db!.getAllAsync<any>(sql, params)
    return { ok: true, value: res }
  },

  async addHistory(data: HistoryEntry): Promise<SuccessResult> {
    await this.ensureReady()
    await db!.runAsync(
      'INSERT INTO reading_history (manga_id, manga_title, manga_cover, manga_url, chapter_id, chapter_title, started_at, duration_seconds, pkg, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);',
      [
        data.mangaId ?? null,
        data.mangaTitle ?? null,
        data.mangaCover ?? null,
        data.mangaUrl ?? null,
        data.chapterId || '',
        data.chapterTitle ?? null,
        data.startedAt ?? null,
        data.durationSeconds || 0,
        data.pkg ?? null,
        data.type || 'manga'
      ]
    )
    return { ok: true, value: { success: true } }
  },

  async updateHistoryDuration(args: {
    mangaId: string
    chapterId: string
    durationSeconds: number
  }): Promise<SuccessResult> {
    await this.ensureReady()
    const latest = await db!.getFirstAsync<{ id: number; duration_seconds: number }>(
      'SELECT id, duration_seconds FROM reading_history WHERE manga_id = ? AND chapter_id = ? ORDER BY started_at DESC LIMIT 1;',
      [args.mangaId, args.chapterId]
    )
    if (latest) {
      const newDuration = Math.max(latest.duration_seconds || 0, args.durationSeconds)
      await db!.runAsync('UPDATE reading_history SET duration_seconds = ? WHERE id = ?;', [
        newDuration,
        latest.id
      ])
    }
    return { ok: true, value: { success: true } }
  },

  async updateProgress(data: any): Promise<SuccessResult> {
    await this.ensureReady()
    await db!.runAsync(
      'INSERT OR REPLACE INTO reading_progress (manga_id, chapter_id, is_read, last_page, updated_at) VALUES (?, ?, ?, ?, ?);',
      [
        data.mangaId,
        data.chapterId,
        data.isRead ? 1 : 0,
        data.lastPage || 0,
        new Date().toISOString()
      ]
    )
    return { ok: true, value: { success: true } }
  },

  async updateProgressBatch(data: {
    mangaId: string
    chapterIds: string[]
    isRead: boolean
    lastPage?: number
  }): Promise<SuccessResult> {
    await this.ensureReady()
    if (!data.chapterIds || data.chapterIds.length === 0) {
      return { ok: true, value: { success: true } }
    }
    const now = new Date().toISOString()
    const isRead = data.isRead ? 1 : 0
    const lastPage = data.lastPage || 0

    await db!.withTransactionAsync(async () => {
      const CHUNK_SIZE = 50
      for (let i = 0; i < data.chapterIds.length; i += CHUNK_SIZE) {
        const chunk = data.chapterIds.slice(i, i + CHUNK_SIZE)
        const placeholders = chunk.map(() => '(?, ?, ?, ?, ?)').join(', ')
        const params: any[] = []
        for (const chapterId of chunk) {
          params.push(data.mangaId, chapterId, isRead, lastPage, now)
        }
        await db!.runAsync(
          `INSERT OR REPLACE INTO reading_progress (manga_id, chapter_id, is_read, last_page, updated_at) VALUES ${placeholders};`,
          params
        )
      }
    })
    return { ok: true, value: { success: true } }
  },

  async getChapters(mangaId: string): Promise<IpcResult<any[]>> {
    await this.ensureReady()
    const res = await db!.getAllAsync<any>('SELECT * FROM chapters WHERE manga_id = ?;', [mangaId])
    return { ok: true, value: res }
  },

  async saveChapters(args: { mangaId: string; chapters: any[] }): Promise<SuccessResult> {
    await this.ensureReady()
    await db!.withTransactionAsync(async () => {
      await db!.runAsync('DELETE FROM chapters WHERE manga_id = ?;', [args.mangaId])
      for (const ch of args.chapters) {
        await db!.runAsync(
          'INSERT INTO chapters (manga_id, id, number, title, date, scanlator, url) VALUES (?, ?, ?, ?, ?, ?, ?);',
          [args.mangaId, ch.id, ch.number, ch.title, ch.date, ch.scanlator, ch.url]
        )
      }
    })
    return { ok: true, value: { success: true } }
  },

  async deleteHistoryEntry(id: number): Promise<SuccessResult> {
    await this.ensureReady()
    await db!.runAsync('DELETE FROM reading_history WHERE id = ?;', [id])
    return { ok: true, value: { success: true } }
  },

  async deleteHistoryByManga(mangaId: string): Promise<SuccessResult> {
    await this.ensureReady()
    await db!.runAsync('DELETE FROM reading_history WHERE manga_id = ?;', [mangaId])
    return { ok: true, value: { success: true } }
  },

  async clearHistory(type?: string): Promise<SuccessResult> {
    await this.ensureReady()
    if (type) {
      await db!.runAsync('DELETE FROM reading_history WHERE type = ?;', [type])
    } else {
      await db!.runAsync('DELETE FROM reading_history;')
    }
    return { ok: true, value: { success: true } }
  },

  async clearLibrary(type?: string): Promise<SuccessResult> {
    await this.ensureReady()
    if (type) {
      await db!.runAsync('DELETE FROM library WHERE type = ?;', [type])
    } else {
      await db!.runAsync('DELETE FROM library;')
    }
    return { ok: true, value: { success: true } }
  },

  async getProgress(mangaId: string): Promise<IpcResult<any[]>> {
    await this.ensureReady()
    const res = await db!.getAllAsync<any>(
      'SELECT * FROM reading_progress WHERE manga_id = ?;',
      [mangaId]
    )
    return { ok: true, value: res }
  },

  async getAllProgress(): Promise<IpcResult<any[]>> {
    await this.ensureReady()
    const res = await db!.getAllAsync<any>('SELECT * FROM reading_progress;')
    return { ok: true, value: res }
  },

  async getMangaCache(mangaId: string): Promise<IpcResult<any>> {
    await this.ensureReady()
    const res = await db!.getFirstAsync<any>(
      'SELECT * FROM manga_cache WHERE id = ?;',
      [mangaId]
    )
    return { ok: true, value: res || null }
  },

  async saveMangaCache(manga: any): Promise<SuccessResult> {
    await this.ensureReady()
    await db!.runAsync(
      `INSERT OR REPLACE INTO manga_cache
       (id, title, cover_url, description, author, artist, status, genres, url, updated_at, type, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        manga.id,
        manga.title || null,
        manga.coverUrl || manga.cover_url || null,
        manga.description || null,
        manga.author || null,
        manga.artist || null,
        manga.status || null,
        manga.genres ? JSON.stringify(manga.genres) : null,
        manga.url || null,
        new Date().toISOString(),
        manga.mediaType || manga.type || 'manga',
        null
      ]
    )
    return { ok: true, value: { success: true } }
  },

  async upsertDownload(data: {
    mangaId: string
    chapterId: string
    totalPages?: number | null
    cachedPages?: number | null
    status?: string | null
    pageUrls?: string | null
    errorMessage?: string | null
    updatedAt?: string | null
    type?: string | null
    mangaTitle?: string | null
    chapterTitle?: string | null
  }): Promise<SuccessResult> {
    await this.ensureReady()
    await db!.runAsync(
      `INSERT INTO downloads (
        manga_id, chapter_id, total_pages, cached_pages, status, 
        page_urls, error_message, updated_at, type, manga_title, chapter_title
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(manga_id, chapter_id) DO UPDATE SET
        total_pages = COALESCE(excluded.total_pages, downloads.total_pages),
        cached_pages = COALESCE(excluded.cached_pages, downloads.cached_pages),
        status = COALESCE(excluded.status, downloads.status),
        page_urls = COALESCE(excluded.page_urls, downloads.page_urls),
        error_message = excluded.error_message,
        updated_at = excluded.updated_at,
        type = COALESCE(excluded.type, downloads.type),
        manga_title = COALESCE(excluded.manga_title, downloads.manga_title),
        chapter_title = COALESCE(excluded.chapter_title, downloads.chapter_title);`,
      [
        data.mangaId,
        data.chapterId,
        data.totalPages ?? null,
        data.cachedPages ?? null,
        data.status ?? null,
        data.pageUrls ?? null,
        data.errorMessage ?? null,
        data.updatedAt ?? new Date().toISOString(),
        data.type ?? 'manga',
        data.mangaTitle ?? null,
        data.chapterTitle ?? null
      ]
    )
    return { ok: true, value: { success: true } }
  },

  async getDownload(mangaId: string, chapterId: string): Promise<IpcResult<DownloadEntry | undefined>> {
    await this.ensureReady()
    const row = await db!.getFirstAsync<any>(
      'SELECT * FROM downloads WHERE manga_id = ? AND chapter_id = ?;',
      [mangaId, chapterId]
    )
    if (!row) return { ok: true, value: undefined }
    return { ok: true, value: this.mapDownloadRow(row) }
  },

  async getDownloadsByManga(mangaId: string): Promise<IpcResult<DownloadEntry[]>> {
    await this.ensureReady()
    const rows = await db!.getAllAsync<any>(
      'SELECT * FROM downloads WHERE manga_id = ? ORDER BY chapter_id ASC;',
      [mangaId]
    )
    return { ok: true, value: (rows || []).map((r) => this.mapDownloadRow(r)) }
  },

  async getAllDownloads(type?: string): Promise<IpcResult<DownloadEntry[]>> {
    await this.ensureReady()
    let sql = 'SELECT * FROM downloads'
    const params: any[] = []
    if (type && type !== 'all') {
      sql += ' WHERE type = ?'
      params.push(type)
    }
    sql += ' ORDER BY updated_at DESC;'
    const rows = await db!.getAllAsync<any>(sql, params)
    return { ok: true, value: (rows || []).map((r) => this.mapDownloadRow(r)) }
  },

  async deleteDownload(mangaId: string, chapterId: string): Promise<IpcResult<boolean>> {
    await this.ensureReady()
    await db!.runAsync('DELETE FROM downloads WHERE manga_id = ? AND chapter_id = ?;', [mangaId, chapterId])
    return { ok: true, value: true }
  },

  async clearDownloads(type?: string): Promise<IpcResult<boolean>> {
    await this.ensureReady()
    if (type && type !== 'all') {
      await db!.runAsync('DELETE FROM downloads WHERE type = ?;', [type])
    } else {
      await db!.runAsync('DELETE FROM downloads;')
    }
    return { ok: true, value: true }
  },

  async updateDownloadProgress(mangaId: string, chapterId: string, cachedPages: number, totalPages?: number): Promise<IpcResult<boolean>> {
    await this.ensureReady()
    const now = new Date().toISOString()
    if (typeof totalPages === 'number') {
      await db!.runAsync(
        'UPDATE downloads SET cached_pages = ?, total_pages = ?, updated_at = ? WHERE manga_id = ? AND chapter_id = ?;',
        [cachedPages, totalPages, now, mangaId, chapterId]
      )
    } else {
      await db!.runAsync(
        'UPDATE downloads SET cached_pages = ?, updated_at = ? WHERE manga_id = ? AND chapter_id = ?;',
        [cachedPages, now, mangaId, chapterId]
      )
    }
    return { ok: true, value: true }
  },

  async updateDownloadStatus(mangaId: string, chapterId: string, status: string, error?: string): Promise<IpcResult<boolean>> {
    await this.ensureReady()
    await db!.runAsync(
      'UPDATE downloads SET status = ?, error_message = ?, updated_at = ? WHERE manga_id = ? AND chapter_id = ?;',
      [status, error || null, new Date().toISOString(), mangaId, chapterId]
    )
    return { ok: true, value: true }
  },

  mapDownloadRow(row: any): DownloadEntry {
    return {
      mangaId: row.manga_id,
      chapterId: row.chapter_id,
      totalPages: row.total_pages ?? null,
      cachedPages: row.cached_pages ?? null,
      status: row.status ?? null,
      pageUrls: row.page_urls ?? null,
      error: row.error_message ?? null,
      updatedAt: row.updated_at ?? null,
      mediaType: (row.type as 'manga' | 'anime') || 'manga',
      mangaTitle: row.manga_title ?? null,
      chapterTitle: row.chapter_title ?? null
    }
  }
}
