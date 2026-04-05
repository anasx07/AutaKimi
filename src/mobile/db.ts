import { Manga, IpcResult, HistoryEntry } from '@common/types'

// Capacitor SQLite removed. Mobile version uses React Native / Expo instead.
let db: any = null
let initPromise: Promise<void> | null = null

export const MobileDB = {
  async init(): Promise<IpcResult<void>> {
    if (initPromise) return initPromise.then(() => ({ ok: true, value: undefined }))

    initPromise = (async () => {
      console.warn('[MobileDB] Capacitor SQLite removed. No-op in web/fallback mode.')
    })()

    return initPromise.then(() => ({ ok: true, value: undefined }))
  },

  async ensureReady(): Promise<void> {
    if (!db) {
      await this.init()
    }
  },

  async migrate(_connection: any): Promise<void> {
    // Capacitor removed.
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
        [
          manga.id,
          manga.title,
          manga.coverUrl,
          manga.status,
          JSON.stringify(manga),
          manga.mediaType || 'manga'
        ]
      )
      return { ok: true, value: true }
    }
  },

  async getSettings(): Promise<IpcResult<Record<string, string>>> {
    await this.ensureReady()
    const res = await db!.query('SELECT * FROM settings;')
    const settings: Record<string, string> = {}
    res.values?.forEach((s) => (settings[s.key] = s.value))
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
    return this.wrap(
      db!
        .query('SELECT * FROM reading_progress WHERE manga_id = ?;', [mangaId])
        .then((r) => r.values || [])
    )
  },

  async updateProgress(data: any): Promise<IpcResult<any>> {
    return this.wrap(
      db!.run(
        'INSERT OR REPLACE INTO reading_progress (manga_id, chapter_id, is_read, last_page, updated_at) VALUES (?, ?, ?, ?, ?);',
        [
          data.mangaId,
          data.chapterId,
          data.isRead ? 1 : 0,
          data.lastPage || 0,
          new Date().toISOString()
        ]
      )
    )
  },

  async getChapters(mangaId: string): Promise<IpcResult<any[]>> {
    await this.ensureReady()
    return this.wrap(
      db!.query('SELECT * FROM chapters WHERE manga_id = ?;', [mangaId]).then((r) => r.values || [])
    )
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
      try {
        manga.genres = JSON.parse(manga.genres)
      } catch (e) {}
    }
    return { ok: true, value: manga || null }
  },

  async saveMangaCache(manga: Manga): Promise<IpcResult<any>> {
    await this.ensureReady()
    return this.wrap(
      db!.run(
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
      )
    )
  }
}
