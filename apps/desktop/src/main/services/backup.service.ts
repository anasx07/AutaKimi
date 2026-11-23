import { app, dialog } from 'electron'
import fs from 'fs'
import { sqliteDb } from '../db'
import { BackupData } from '@common/types'
import { serializeBackup, deserializeBackup } from '../utils/backupPayload'

export type { BackupData }

export class BackupService {
  /**
   * Dumps library, reading_progress, reading_history, source_repositories, and trackers
   * into a single compressed .json.gz file.
   */
  async exportBackup(): Promise<{
    success: boolean
    canceled?: boolean
    filePath?: string
    counts?: {
      library: number
      readingProgress: number
      readingHistory: number
      sourceRepositories: number
      trackers: number
    }
    error?: string
  }> {
    try {
      const now = new Date()
      const dateStr = now.toISOString().split('T')[0]
      const defaultFilename = `autakimi-backup-${dateStr}.json.gz`

      const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Export AutaKimi Backup',
        defaultPath: defaultFilename,
        filters: [
          { name: 'AutaKimi Backup (*.json.gz)', extensions: ['json.gz', 'gz'] },
          { name: 'JSON Backup (*.json)', extensions: ['json'] },
          { name: 'All Files (*.*)', extensions: ['*'] }
        ]
      })

      if (canceled || !filePath) {
        return { success: false, canceled: true }
      }

      // 1. Fetch library rows
      const library = sqliteDb
        .prepare(
          'SELECT id, title, cover_url as coverUrl, status, metadata, type as mediaType FROM library'
        )
        .all() as any[]

      // 2. Fetch reading_progress rows
      const readingProgress = sqliteDb
        .prepare(
          'SELECT manga_id as mangaId, chapter_id as chapterId, is_read as isRead, last_page as lastPage, updated_at as updatedAt FROM reading_progress'
        )
        .all() as any[]

      // 3. Fetch reading_history rows
      const readingHistory = sqliteDb
        .prepare(
          'SELECT manga_id as mangaId, manga_title as mangaTitle, manga_cover as mangaCover, manga_url as mangaUrl, chapter_id as chapterId, chapter_title as chapterTitle, started_at as startedAt, duration_seconds as durationSeconds, pkg, type as mediaType FROM reading_history'
        )
        .all() as any[]

      // 4. Fetch source_repositories from settings
      let sourceRepositories: string[] = []
      const reposRow = sqliteDb
        .prepare("SELECT value FROM settings WHERE key = 'source_repositories'")
        .get() as any
      if (reposRow?.value) {
        try {
          sourceRepositories = JSON.parse(reposRow.value)
        } catch {}
      }

      // 5. Fetch trackers rows
      let trackers: any[] = []
      try {
        trackers = sqliteDb
          .prepare(
            'SELECT manga_id as mangaId, provider, remote_id as remoteId, score, status, last_synced_chapter as lastSyncedChapter, updated_at as updatedAt FROM trackers'
          )
          .all() as any[]
      } catch {}

      const backupData: BackupData = {
        version: 1,
        appVersion: app.getVersion ? app.getVersion() : '2.0.18',
        createdAt: now.toISOString(),
        library,
        readingProgress: readingProgress.map((r) => ({ ...r, isRead: Boolean(r.isRead) })),
        readingHistory,
        sourceRepositories,
        trackers
      }

      const isJsonOnly = filePath.endsWith('.json') && !filePath.endsWith('.json.gz')
      const fileBuffer = serializeBackup(backupData, !isJsonOnly)

      await fs.promises.writeFile(filePath, fileBuffer)

      return {
        success: true,
        filePath,
        counts: {
          library: library.length,
          readingProgress: readingProgress.length,
          readingHistory: readingHistory.length,
          sourceRepositories: sourceRepositories.length,
          trackers: trackers.length
        }
      }
    } catch (err: any) {
      console.error('[BackupService] Export failed:', err)
      return { success: false, error: err?.message || 'Export failed' }
    }
  }

  /**
   * Restores library, reading_progress, reading_history, source_repositories, and trackers
   * from a .json.gz or .json backup inside a single ACID SQLite transaction.
   */
  async importBackup(): Promise<{
    success: boolean
    canceled?: boolean
    counts?: {
      library: number
      readingProgress: number
      readingHistory: number
      sourceRepositories: number
      trackers: number
    }
    error?: string
  }> {
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        title: 'Select AutaKimi Backup File',
        filters: [
          { name: 'AutaKimi Backup (*.json.gz, *.json)', extensions: ['json.gz', 'gz', 'json'] },
          { name: 'All Files (*.*)', extensions: ['*'] }
        ],
        properties: ['openFile']
      })

      if (canceled || !filePaths || filePaths.length === 0) {
        return { success: false, canceled: true }
      }

      const filePath = filePaths[0]
      const rawBuffer = await fs.promises.readFile(filePath)
      const data: BackupData = deserializeBackup(rawBuffer)

      let restoredCounts = {
        library: 0,
        readingProgress: 0,
        readingHistory: 0,
        sourceRepositories: 0,
        trackers: 0
      }

      // Execute all restores in a single atomic transaction
      const restoreTransaction = sqliteDb.transaction((backup: BackupData) => {
        // 1. Library
        if (Array.isArray(backup.library) && backup.library.length > 0) {
          const insertLib = sqliteDb.prepare(`
            INSERT INTO library (id, title, cover_url, status, metadata, type)
            VALUES (@id, @title, @coverUrl, @status, @metadata, @mediaType)
            ON CONFLICT(id) DO UPDATE SET
              title = excluded.title,
              cover_url = excluded.cover_url,
              status = excluded.status,
              metadata = excluded.metadata,
              type = excluded.type
          `)
          for (const item of backup.library) {
            if (!item.id) continue
            insertLib.run({
              id: item.id,
              title: item.title ?? null,
              coverUrl: item.coverUrl ?? (item as any).cover_url ?? null,
              status: item.status ?? null,
              metadata:
                typeof item.metadata === 'object'
                  ? JSON.stringify(item.metadata)
                  : item.metadata ?? null,
              mediaType: item.mediaType || (item as any).type || 'manga'
            })
            restoredCounts.library++
          }
        }

        // 2. Reading Progress
        if (Array.isArray(backup.readingProgress) && backup.readingProgress.length > 0) {
          const insertProg = sqliteDb.prepare(`
            INSERT INTO reading_progress (manga_id, chapter_id, is_read, last_page, updated_at)
            VALUES (@mangaId, @chapterId, @isRead, @lastPage, @updatedAt)
            ON CONFLICT(manga_id, chapter_id) DO UPDATE SET
              is_read = excluded.is_read,
              last_page = excluded.last_page,
              updated_at = excluded.updated_at
          `)
          for (const item of backup.readingProgress) {
            if (!item.mangaId || !item.chapterId) continue
            insertProg.run({
              mangaId: item.mangaId,
              chapterId: item.chapterId,
              isRead: item.isRead ? 1 : 0,
              lastPage: item.lastPage ?? (item as any).last_page ?? 0,
              updatedAt: item.updatedAt ?? (item as any).updated_at ?? new Date().toISOString()
            })
            restoredCounts.readingProgress++
          }
        }

        // 3. Reading History
        if (Array.isArray(backup.readingHistory) && backup.readingHistory.length > 0) {
          const checkHist = sqliteDb.prepare(`
            SELECT 1 FROM reading_history WHERE manga_id = ? AND chapter_id = ? AND started_at = ?
          `)
          const insertHist = sqliteDb.prepare(`
            INSERT INTO reading_history (manga_id, manga_title, manga_cover, manga_url, chapter_id, chapter_title, started_at, duration_seconds, pkg, type)
            VALUES (@mangaId, @mangaTitle, @mangaCover, @mangaUrl, @chapterId, @chapterTitle, @startedAt, @durationSeconds, @pkg, @mediaType)
          `)
          for (const item of backup.readingHistory) {
            if (!item.mangaId || !item.chapterId) continue
            const startedAt = item.startedAt ?? (item as any).started_at ?? new Date().toISOString()
            if (!checkHist.get(item.mangaId, item.chapterId, startedAt)) {
              insertHist.run({
                mangaId: item.mangaId,
                mangaTitle: item.mangaTitle ?? (item as any).manga_title ?? null,
                mangaCover: item.mangaCover ?? (item as any).manga_cover ?? null,
                mangaUrl: item.mangaUrl ?? (item as any).manga_url ?? null,
                chapterId: item.chapterId,
                chapterTitle: item.chapterTitle ?? (item as any).chapter_title ?? null,
                startedAt,
                durationSeconds: item.durationSeconds ?? (item as any).duration_seconds ?? 0,
                pkg: item.pkg ?? null,
                mediaType: item.mediaType || (item as any).type || 'manga'
              })
              restoredCounts.readingHistory++
            }
          }
        }

        // 4. Source Repositories
        if (Array.isArray(backup.sourceRepositories) && backup.sourceRepositories.length > 0) {
          const reposRow = sqliteDb
            .prepare("SELECT value FROM settings WHERE key = 'source_repositories'")
            .get() as any
          let currentRepos: string[] = []
          if (reposRow?.value) {
            try {
              currentRepos = JSON.parse(reposRow.value)
            } catch {}
          }
          const mergedRepos = Array.from(new Set([...currentRepos, ...backup.sourceRepositories]))
          sqliteDb
            .prepare(
              `
              INSERT INTO settings (key, value) VALUES ('source_repositories', ?)
              ON CONFLICT(key) DO UPDATE SET value = excluded.value
            `
            )
            .run(JSON.stringify(mergedRepos))
          restoredCounts.sourceRepositories = backup.sourceRepositories.length
        }

        // 5. Trackers
        if (Array.isArray(backup.trackers) && backup.trackers.length > 0) {
          const insertTrack = sqliteDb.prepare(`
            INSERT INTO trackers (manga_id, provider, remote_id, score, status, last_synced_chapter, updated_at)
            VALUES (@mangaId, @provider, @remoteId, @score, @status, @lastSyncedChapter, @updatedAt)
            ON CONFLICT(manga_id, provider) DO UPDATE SET
              remote_id = excluded.remote_id,
              score = excluded.score,
              status = excluded.status,
              last_synced_chapter = excluded.last_synced_chapter,
              updated_at = excluded.updated_at
          `)
          for (const item of backup.trackers) {
            if (!item.mangaId || !item.provider || !item.remoteId) continue
            insertTrack.run({
              mangaId: item.mangaId,
              provider: item.provider,
              remoteId: String(item.remoteId),
              score: item.score ?? 0,
              status: item.status || 'CURRENT',
              lastSyncedChapter: item.lastSyncedChapter ?? (item as any).last_synced_chapter ?? 0,
              updatedAt: item.updatedAt ?? (item as any).updated_at ?? new Date().toISOString()
            })
            restoredCounts.trackers++
          }
        }
      })

      // Run the atomic transaction
      restoreTransaction(data)

      return {
        success: true,
        counts: restoredCounts
      }
    } catch (err: any) {
      console.error('[BackupService] Import failed:', err)
      return { success: false, error: err?.message || 'Import failed' }
    }
  }
}

export const backupService = new BackupService()
