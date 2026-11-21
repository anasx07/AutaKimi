import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'

import { is } from '@electron-toolkit/utils'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from './schema'
import { ExtensionRepository } from './repositories/extension.repo'
import { LibraryRepository } from './repositories/library.repo'
import { SettingsRepository } from './repositories/settings.repo'
import { ProgressRepository } from './repositories/progress.repo'
import { HistoryRepository } from './repositories/history.repo'
import { DownloadRepository } from './repositories/download.repo'
import { ChapterRepository } from './repositories/chapter.repo'
import { MangaCacheRepository } from './repositories/manga_cache.repo'
import { TrackerRepository } from './repositories/tracker.repo'

const userDataPath = app.getPath('userData')
if (!fs.existsSync(userDataPath)) {
  fs.mkdirSync(userDataPath, { recursive: true })
}

const dbPath = path.join(userDataPath, 'autakimi.db')
export const sqliteDb = new Database(dbPath)
sqliteDb.pragma('journal_mode = WAL')
sqliteDb.pragma('auto_vacuum = INCREMENTAL')
const sqlite = sqliteDb

// === Versioned Migrations (Raw SQL for legacy compatibility) ===


// Initialize Drizzle
export const ddb = drizzle(sqlite, { schema })

// === Drizzle Migrations ===
const runMigrations = () => {
  const currentVersion = sqlite.pragma('user_version', { simple: true }) as number
  
  // Transition legacy users to Drizzle migrations
  if (currentVersion >= 17) {
    try {
      // Check if drizzle migrations table exists
      const tableExists = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='__drizzle_migrations'").get()
      if (!tableExists) {
        console.log('[DB] Transitioning legacy user to Drizzle migrations...')
        sqlite.exec(`
          CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            hash TEXT NOT NULL,
            created_at INTEGER
          );
          -- Mark the initial migration as already completed
          -- Note: The hash here doesn't strictly matter as long as it exists for the first migration
          -- Drizzle will skip 0000 if it's already in the table.
          INSERT INTO "__drizzle_migrations" (hash, created_at) VALUES ('legacy_transition_v17', ${Date.now()});
        `)
      }
    } catch (err) {
      console.error('[DB] Legacy transition failed:', err)
    }
  }

  try {
    // Determine migrations path relative to the app bundle
    const migrationsPath = is.dev 
      ? path.join(__dirname, '../../src/main/db/migrations')
      : path.join(process.resourcesPath, 'migrations')
    
    // In production, electron-vite might bundle it differently. 
    // We should check if the folder exists, otherwise fallback to a common location.
    const finalPath = fs.existsSync(migrationsPath) ? migrationsPath : path.join(__dirname, 'migrations')

    migrate(ddb, { migrationsFolder: finalPath })
    console.log('[DB] Migrations completed successfully.')
  } catch (err) {
    console.error('[DB] Migrations failed:', err)
  }
}

runMigrations()

try {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS trackers (
      manga_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      remote_id TEXT NOT NULL,
      score INTEGER,
      status TEXT,
      last_synced_chapter INTEGER DEFAULT 0,
      updated_at TEXT,
      PRIMARY KEY (manga_id, provider)
    );
    CREATE TABLE IF NOT EXISTS anilist_sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      manga_id TEXT NOT NULL,
      media_id INTEGER NOT NULL UNIQUE,
      status TEXT,
      progress INTEGER NOT NULL,
      score INTEGER,
      attempts INTEGER DEFAULT 0,
      last_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_anilist_queue_media ON anilist_sync_queue (media_id);
    CREATE INDEX IF NOT EXISTS idx_anilist_queue_created ON anilist_sync_queue (created_at);
    CREATE INDEX IF NOT EXISTS idx_trackers_manga ON trackers (manga_id);
    CREATE INDEX IF NOT EXISTS idx_library_type ON library (type);
    CREATE INDEX IF NOT EXISTS idx_history_type_started ON reading_history (type, started_at);
    CREATE INDEX IF NOT EXISTS idx_manga_cache_expires ON manga_cache (expires_at);
  `)
} catch (e) {
  console.warn('[DB] Failed to ensure composite indexes/tables:', e)
}

// Export Repositories
export const extensionRepo = new ExtensionRepository(ddb)
export const libraryRepo = new LibraryRepository(ddb)
export const settingsRepo = new SettingsRepository(ddb)
export const progressRepo = new ProgressRepository(ddb)
export const historyRepo = new HistoryRepository(ddb)
export const downloadRepo = new DownloadRepository(ddb)
export const chapterRepo = new ChapterRepository(ddb)
export const mangaCacheRepo = new MangaCacheRepository(ddb)
export const trackerRepo = new TrackerRepository(ddb)

// === Startup Cleanup Routine ===
export const runCleanupRoutine = () => {
  console.log('[DB] Running startup cleanup routine...')
  try {
    // Delete chapters for manga that are NOT in library, history, or downloads
    sqlite.exec(`
      DELETE FROM chapters 
      WHERE manga_id NOT IN (
        SELECT id FROM library
        UNION
        SELECT manga_id FROM reading_history
        UNION
        SELECT manga_id FROM downloads
      )
    `)

    // Delete manga_cache for manga that are NOT in library, history, or downloads
    sqlite.exec(`
      DELETE FROM manga_cache
      WHERE id NOT IN (
        SELECT id FROM library
        UNION
        SELECT manga_id FROM reading_history
        UNION
        SELECT manga_id FROM downloads
      )
    `)

    // Weekly VACUUM throttling: only run full VACUUM once every 7 days
    const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000
    const row = sqlite.prepare('SELECT value FROM settings WHERE key = ?').get('last_vacuum_at') as
      | { value: string }
      | undefined
    const lastVacuumAt = row ? parseInt(row.value, 10) : 0
    const now = Date.now()

    if (!lastVacuumAt || now - lastVacuumAt >= ONE_WEEK_MS) {
      console.log('[DB] Running weekly VACUUM to reclaim disk space...')
      sqlite.exec('VACUUM;')
      sqlite.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
        'last_vacuum_at',
        String(now)
      )
      console.log('[DB] Weekly VACUUM completed.')
    } else {
      // Incremental vacuum to reclaim pages freed by the DELETE queries without blocking the main thread
      try {
        sqlite.pragma('incremental_vacuum(100)')
      } catch (e) {
        console.warn('[DB] Incremental vacuum failed or not enabled:', e)
      }
      console.log(
        `[DB] Skipped full VACUUM (last run was ${Math.round((now - lastVacuumAt) / (1000 * 60 * 60 * 24))} days ago). Incremental vacuum executed.`
      )
    }
    console.log('[DB] Cleanup finished.')
  } catch (err) {
    console.error('[DB] Cleanup failed:', err)
  }
}

// Cleanup is now called from main index.ts after window is ready-to-show

export default sqlite
