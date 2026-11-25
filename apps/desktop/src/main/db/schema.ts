import { sqliteTable, text, integer, primaryKey, index, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const extensions = sqliteTable('extensions', {
  pkg: text('pkg').primaryKey(),
  installedAt: text('installed_at'),
  code: text('code'),
  name: text('name'),
  baseUrl: text('baseUrl'),
  lang: text('lang'),
  icon: text('icon'),
  version: text('version'),
  repoUrl: text('repo_url'),
  repoName: text('repo_name'),
  repoColor: text('repo_color')
})

export const library = sqliteTable(
  'library',
  {
    id: text('id').primaryKey(),
    title: text('title'),
    coverUrl: text('cover_url'),
    status: text('status'),
    metadata: text('metadata'), // JSON string
    mediaType: text('type').$type<'manga' | 'anime'>().default('manga')
  },
  (table) => [index('idx_library_type').on(table.mediaType)]
)

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value')
})

export const readingProgress = sqliteTable(
  'reading_progress',
  {
    mangaId: text('manga_id'),
    chapterId: text('chapter_id'),
    isRead: integer('is_read', { mode: 'boolean' }).default(false),
    lastPage: integer('last_page').default(0),
    updatedAt: text('updated_at')
  },
  (table) => {
    return [
      primaryKey({ columns: [table.mangaId, table.chapterId] }),
      index('idx_progress_manga').on(table.mangaId)
    ]
  }
)

export const readingHistory = sqliteTable(
  'reading_history',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    mangaId: text('manga_id').notNull(),
    mangaTitle: text('manga_title'),
    mangaCover: text('manga_cover'),
    mangaUrl: text('manga_url'),
    chapterId: text('chapter_id').notNull(),
    chapterTitle: text('chapter_title'),
    startedAt: text('started_at').notNull(), // ISO timestamp
    durationSeconds: integer('duration_seconds').default(0),
    pkg: text('pkg'),
    mediaType: text('type').$type<'manga' | 'anime'>().default('manga')
  },
  (table) => {
    return [
      index('idx_history_manga').on(table.mangaId),
      index('idx_history_started').on(table.startedAt),
      index('idx_history_type_started').on(table.mediaType, table.startedAt)
    ]
  }
)

export const downloads = sqliteTable(
  'downloads',
  {
    mangaId: text('manga_id').notNull(),
    chapterId: text('chapter_id').notNull(),
    totalPages: integer('total_pages').default(0),
    cachedPages: integer('cached_pages').default(0),
    status: text('status'), // 'pending', 'downloading', 'completed', 'error'
    pageUrls: text('page_urls'), // JSON string
    error: text('error_message'),
    updatedAt: text('updated_at'),
    mediaType: text('type').$type<'manga' | 'anime'>().default('manga')
  },
  (table) => {
    return [
      primaryKey({ columns: [table.mangaId, table.chapterId] }),
      index('idx_downloads_status').on(table.status)
    ]
  }
)

export const chapters = sqliteTable(
  'chapters',
  {
    mangaId: text('manga_id').notNull(),
    id: text('id').notNull(),
    number: text('number'),
    title: text('title'),
    date: text('date'),
    scanlator: text('scanlator'),
    url: text('url')
  },
  (table) => {
    return [
      primaryKey({ columns: [table.mangaId, table.id] }),
      index('idx_chapters_manga').on(table.mangaId)
    ]
  }
)

export const mangaCache = sqliteTable(
  'manga_cache',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    coverUrl: text('cover_url'),
    description: text('description'),
    author: text('author'),
    artist: text('artist'),
    status: text('status'),
    genres: text('genres'), // JSON array string
    url: text('url'),
    mediaType: text('type').$type<'manga' | 'anime'>().default('manga'),
    updatedAt: text('updated_at'),
    expiresAt: text('expires_at')
  },
  (table) => [index('idx_manga_cache_expires').on(table.expiresAt)]
)

export const trackers = sqliteTable(
  'trackers',
  {
    mangaId: text('manga_id').notNull(),
    provider: text('provider').$type<'anilist' | 'mal'>().notNull(),
    remoteId: text('remote_id').notNull(),
    score: integer('score'),
    status: text('status'),
    lastSyncedChapter: integer('last_synced_chapter').default(0),
    updatedAt: text('updated_at')
  },
  (table) => [
    primaryKey({ columns: [table.mangaId, table.provider] }),
    index('idx_trackers_manga').on(table.mangaId)
  ]
)

export const anilistSyncQueue = sqliteTable(
  'anilist_sync_queue',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    mangaId: text('manga_id').notNull(),
    mediaId: integer('media_id').notNull(),
    status: text('status'),
    progress: integer('progress').notNull(),
    score: integer('score'),
    attempts: integer('attempts').default(0),
    lastError: text('last_error'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull()
  },
  (table) => [
    uniqueIndex('idx_anilist_queue_media').on(table.mediaId),
    index('idx_anilist_queue_created').on(table.createdAt)
  ]
)
