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

const userDataPath = app.getPath('userData')
if (!fs.existsSync(userDataPath)) {
  fs.mkdirSync(userDataPath, { recursive: true })
}

const dbPath = path.join(userDataPath, 'autakimi.db')
const sqlite = new Database(dbPath)
sqlite.pragma('journal_mode = WAL')

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

// Export Repositories
export const extensionRepo = new ExtensionRepository(ddb)
export const libraryRepo = new LibraryRepository(ddb)
export const settingsRepo = new SettingsRepository(ddb)
export const progressRepo = new ProgressRepository(ddb)
export const historyRepo = new HistoryRepository(ddb)
export const downloadRepo = new DownloadRepository(ddb)
export const chapterRepo = new ChapterRepository(ddb)
export const mangaCacheRepo = new MangaCacheRepository(ddb)

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
    console.log('[DB] Cleanup finished.')
  } catch (err) {
    console.error('[DB] Cleanup failed:', err)
  }
}

// Cleanup is now called from main index.ts after window is ready-to-show

export default sqlite
