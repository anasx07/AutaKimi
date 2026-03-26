import { sqliteTable, text, integer, primaryKey, index } from 'drizzle-orm/sqlite-core';

export const extensions = sqliteTable('extensions', {
  pkg: text('pkg').primaryKey(),
  installedAt: text('installed_at'),
  code: text('code'),
  name: text('name'),
  baseUrl: text('baseUrl'),
  lang: text('lang'),
  icon: text('icon'),
  version: text('version'),
});

export const library = sqliteTable('library', {
  id: text('id').primaryKey(),
  title: text('title'),
  coverUrl: text('cover_url'),
  status: text('status'),
  metadata: text('metadata'), // JSON string
  type: text('type').$type<'manga' | 'anime'>().default('manga'),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value'),
});

export const readingProgress = sqliteTable('reading_progress', {
  mangaId: text('manga_id'),
  chapterId: text('chapter_id'),
  isRead: integer('is_read', { mode: 'boolean' }).default(false),
  lastPage: integer('last_page').default(0),
  updatedAt: text('updated_at'),
}, (table) => {
  return [
    primaryKey({ columns: [table.mangaId, table.chapterId] }),
    index('idx_progress_manga').on(table.mangaId),
  ];
});

export const readingHistory = sqliteTable('reading_history', {
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
  type: text('type').$type<'manga' | 'anime'>().default('manga'),
}, (table) => {
  return [
    index('idx_history_manga').on(table.mangaId),
    index('idx_history_started').on(table.startedAt),
  ];
});

export const downloads = sqliteTable('downloads', {
  mangaId: text('manga_id').notNull(),
  chapterId: text('chapter_id').notNull(),
  totalPages: integer('total_pages').default(0),
  cachedPages: integer('cached_pages').default(0),
  status: text('status'), // 'pending', 'downloading', 'completed', 'error'
  pageUrls: text('page_urls'), // JSON string
  error: text('error_message'),
  updatedAt: text('updated_at'),
  type: text('type').$type<'manga' | 'anime'>().default('manga'),
}, (table) => {
  return [
    primaryKey({ columns: [table.mangaId, table.chapterId] }),
    index('idx_downloads_status').on(table.status),
  ];
});

export const chapters = sqliteTable('chapters', {
  mangaId: text('manga_id').notNull(),
  id: text('id').notNull(),
  number: text('number'),
  title: text('title'),
  date: text('date'),
  scanlator: text('scanlator'),
  url: text('url'),
}, (table) => {
  return [
    primaryKey({ columns: [table.mangaId, table.id] }),
    index('idx_chapters_manga').on(table.mangaId),
  ];
});

export const mangaCache = sqliteTable('manga_cache', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  coverUrl: text('cover_url'),
  description: text('description'),
  author: text('author'),
  artist: text('artist'),
  status: text('status'),
  genres: text('genres'), // JSON array string
  url: text('url'),
  type: text('type').$type<'manga' | 'anime'>().default('manga'),
  updatedAt: text('updated_at')
});
