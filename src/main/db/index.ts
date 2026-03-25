import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'

// Force userData path to be exactly what was requested (AppData/Roaming/LManwa on Windows)
try {
  const appData = app.getPath('appData')
  const targetPath = path.join(appData, 'LManwa')
  app.setPath('userData', targetPath)
} catch (e) {
  console.error('Failed to set userData path:', e)
}

import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import { ExtensionRepository } from './repositories/extension.repo';
import { LibraryRepository } from './repositories/library.repo';
import { SettingsRepository } from './repositories/settings.repo';
import { ProgressRepository } from './repositories/progress.repo';
import { HistoryRepository } from './repositories/history.repo';
import { DownloadRepository } from './repositories/download.repo';
import { ChapterRepository } from './repositories/chapter.repo';
import { MangaCacheRepository } from './repositories/manga_cache.repo';

const userDataPath = app.getPath('userData')
if (!fs.existsSync(userDataPath)) {
  fs.mkdirSync(userDataPath, { recursive: true })
}

const dbPath = path.join(userDataPath, 'lmanwa.db')
const sqlite = new Database(dbPath)
sqlite.pragma('journal_mode = WAL')

// === Versioned Migrations (Raw SQL for legacy compatibility) ===
const migrate = () => {
  let currentVersion = sqlite.pragma('user_version', { simple: true }) as number

  if (currentVersion < 1) {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS extensions (
        pkg TEXT PRIMARY KEY,
        installed_at TEXT
      );
      
      CREATE TABLE IF NOT EXISTS library (
        id TEXT PRIMARY KEY,
        title TEXT,
        cover_url TEXT,
        status TEXT,
        metadata TEXT
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `)
    sqlite.pragma('user_version = 1')
    currentVersion = 1;
  }

  // Hotfix: If user_version was prematurely set to 12 or 13, but older tables are missing
  if (currentVersion >= 12) {
    try {
      sqlite.prepare('SELECT 1 FROM downloads LIMIT 1').get()
    } catch {
      console.log('[DB] Detected prematurely set user_version. Resetting migration pipeline to v1 to create missing tables.')
      currentVersion = 1;
    }
  }

  // Migration 2: Fix extension columns (already in initial schema but for legacy v1 users)
  if (currentVersion < 2) {
    try { sqlite.exec(`ALTER TABLE extensions ADD COLUMN code TEXT;`) } catch (e) {}
    try { sqlite.exec(`ALTER TABLE extensions ADD COLUMN name TEXT;`) } catch (e) {}
    try { sqlite.exec(`ALTER TABLE extensions ADD COLUMN baseUrl TEXT;`) } catch (e) {}
    sqlite.pragma('user_version = 2')
    currentVersion = 2;
  }

  if (currentVersion < 3) {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS reading_progress (
        manga_id TEXT,
        chapter_id TEXT,
        is_read INTEGER DEFAULT 0,
        last_page INTEGER DEFAULT 0,
        updated_at TEXT,
        PRIMARY KEY (manga_id, chapter_id)
      );
    `)
    sqlite.pragma('user_version = 3')
    currentVersion = 3;
  }

  if (currentVersion < 4) {
    try { sqlite.exec(`ALTER TABLE extensions ADD COLUMN lang TEXT;`) } catch (e) {}
    try { sqlite.exec(`ALTER TABLE extensions ADD COLUMN icon TEXT;`) } catch (e) {}
    sqlite.pragma('user_version = 4')
    currentVersion = 4;
  }

  if (currentVersion < 6) {
    try { sqlite.exec(`ALTER TABLE extensions ADD COLUMN version TEXT;`) } catch (e) {}
    sqlite.pragma('user_version = 6')
    currentVersion = 6;
  }

  if (currentVersion < 7) {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS reading_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        manga_id TEXT NOT NULL,
        manga_title TEXT,
        manga_cover TEXT,
        chapter_id TEXT NOT NULL,
        chapter_title TEXT,
        started_at TEXT NOT NULL,
        duration_seconds INTEGER DEFAULT 0,
        pkg TEXT
      );
    `)
    sqlite.pragma('user_version = 7')
    currentVersion = 7;
  }

  if (currentVersion < 8) {
    try { sqlite.exec(`ALTER TABLE reading_history ADD COLUMN manga_url TEXT;`) } catch (e) {}
    sqlite.pragma('user_version = 8')
    currentVersion = 8;
  }

  if (currentVersion < 9) {
    try { sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_progress_manga ON reading_progress(manga_id);`) } catch (e) {}
    try { sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_history_manga ON reading_history(manga_id);`) } catch (e) {}
    try { sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_history_started ON reading_history(started_at DESC);`) } catch (e) {}
    sqlite.pragma('user_version = 9')
    currentVersion = 9;
  }

  if (currentVersion < 10) {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS downloads (
        manga_id TEXT NOT NULL,
        chapter_id TEXT NOT NULL,
        total_pages INTEGER DEFAULT 0,
        cached_pages INTEGER DEFAULT 0,
        status TEXT,
        error_message TEXT,
        updated_at TEXT,
        PRIMARY KEY (manga_id, chapter_id)
      );
      CREATE INDEX IF NOT EXISTS idx_downloads_status ON downloads(status);
    `)
    sqlite.pragma('user_version = 10')
    currentVersion = 10;
  }

  if (currentVersion < 11) {
    try { sqlite.exec(`ALTER TABLE downloads ADD COLUMN page_urls TEXT;`) } catch (e) {}
    sqlite.pragma('user_version = 11')
    currentVersion = 11;
  }

  if (currentVersion < 12) {
    sqlite.exec(`
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
      CREATE INDEX IF NOT EXISTS idx_chapters_manga ON chapters(manga_id);
    `)
    sqlite.pragma('user_version = 12')
    currentVersion = 12;
  }

  if (currentVersion < 13) {
    sqlite.exec(`
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
        updated_at TEXT
      );
    `)
    sqlite.pragma('user_version = 13')
    currentVersion = 13;
  }
}

migrate()

// Initialize Drizzle
export const ddb = drizzle(sqlite, { schema });

// Export Repositories
export const extensionRepo = new ExtensionRepository(ddb);
export const libraryRepo = new LibraryRepository(ddb);
export const settingsRepo = new SettingsRepository(ddb);
export const progressRepo = new ProgressRepository(ddb);
export const historyRepo = new HistoryRepository(ddb);
export const downloadRepo = new DownloadRepository(ddb);
export const chapterRepo = new ChapterRepository(ddb);
export const mangaCacheRepo = new MangaCacheRepository(ddb);

// === Startup Cleanup Routine ===
export const runCleanupRoutine = () => {
  console.log('[DB] Running startup cleanup routine...');
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
    `);

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
    `);
    console.log('[DB] Cleanup finished.');
  } catch (err) {
    console.error('[DB] Cleanup failed:', err);
  }
};

// Cleanup is now called from main index.ts after window is ready-to-show

export default sqlite;
