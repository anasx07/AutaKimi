CREATE TABLE `chapters` (
	`manga_id` text NOT NULL,
	`id` text NOT NULL,
	`number` text,
	`title` text,
	`date` text,
	`scanlator` text,
	`url` text,
	PRIMARY KEY(`manga_id`, `id`)
);
--> statement-breakpoint
CREATE INDEX `idx_chapters_manga` ON `chapters` (`manga_id`);--> statement-breakpoint
CREATE TABLE `downloads` (
	`manga_id` text NOT NULL,
	`chapter_id` text NOT NULL,
	`total_pages` integer DEFAULT 0,
	`cached_pages` integer DEFAULT 0,
	`status` text,
	`page_urls` text,
	`error_message` text,
	`updated_at` text,
	`type` text DEFAULT 'manga',
	PRIMARY KEY(`manga_id`, `chapter_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_downloads_status` ON `downloads` (`status`);--> statement-breakpoint
CREATE TABLE `extensions` (
	`pkg` text PRIMARY KEY NOT NULL,
	`installed_at` text,
	`code` text,
	`name` text,
	`baseUrl` text,
	`lang` text,
	`icon` text,
	`version` text
);
--> statement-breakpoint
CREATE TABLE `library` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text,
	`cover_url` text,
	`status` text,
	`metadata` text,
	`type` text DEFAULT 'manga'
);
--> statement-breakpoint
CREATE TABLE `manga_cache` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`cover_url` text,
	`description` text,
	`author` text,
	`artist` text,
	`status` text,
	`genres` text,
	`url` text,
	`type` text DEFAULT 'manga',
	`updated_at` text,
	`expires_at` text
);
--> statement-breakpoint
CREATE TABLE `reading_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`manga_id` text NOT NULL,
	`manga_title` text,
	`manga_cover` text,
	`manga_url` text,
	`chapter_id` text NOT NULL,
	`chapter_title` text,
	`started_at` text NOT NULL,
	`duration_seconds` integer DEFAULT 0,
	`pkg` text,
	`type` text DEFAULT 'manga'
);
--> statement-breakpoint
CREATE INDEX `idx_history_manga` ON `reading_history` (`manga_id`);--> statement-breakpoint
CREATE INDEX `idx_history_started` ON `reading_history` (`started_at`);--> statement-breakpoint
CREATE TABLE `reading_progress` (
	`manga_id` text,
	`chapter_id` text,
	`is_read` integer DEFAULT false,
	`last_page` integer DEFAULT 0,
	`updated_at` text,
	PRIMARY KEY(`manga_id`, `chapter_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_progress_manga` ON `reading_progress` (`manga_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text
);
