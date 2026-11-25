export const SMART_DOWNLOAD_PREFETCH_COUNT = 3;

export interface SmartDownloadChapterRef {
  id: string;
  number?: number | string;
  url?: string;
  title?: string;
}

export interface SmartDownloadPlanInput<
  T extends SmartDownloadChapterRef = SmartDownloadChapterRef,
> {
  enabled: boolean;
  /** Chapters sorted in ascending reading order */
  chapters: readonly T[];
  /** Currently active chapter ID, or null when exiting the reader */
  currentChapterId: string | null;
  /** Chapter IDs known to have been completed/read */
  completedChapterIds: ReadonlySet<string>;
  /** Chapter IDs already downloaded, downloading, or queued (excluded from new downloads) */
  downloadedChapterIds: ReadonlySet<string>;
  /** Chapter IDs stored on disk / active in download manager that can be deleted if completed */
  deletableDownloadChapterIds?: ReadonlySet<string>;
  prefetchCount?: number;
}

export interface SmartDownloadPlan<
  T extends SmartDownloadChapterRef = SmartDownloadChapterRef,
> {
  chaptersToDownload: T[];
  chapterIdsToDelete: string[];
}

/**
 * Computes Netflix-style Smart Downloads actions when reading or finishing chapters:
 * - Queues up to `prefetchCount` (default 3) unread, not-yet-downloaded chapters ahead of `currentChapterId`.
 * - Schedules deletion of downloaded chapters that have been completed (`completedChapterIds`),
 *   never deleting `currentChapterId` while it is actively being read.
 */
export function computeSmartDownloadPlan<T extends SmartDownloadChapterRef>(
  input: SmartDownloadPlanInput<T>,
): SmartDownloadPlan<T> {
  const {
    enabled,
    chapters,
    currentChapterId,
    completedChapterIds,
    downloadedChapterIds,
    deletableDownloadChapterIds = downloadedChapterIds,
    prefetchCount = SMART_DOWNLOAD_PREFETCH_COUNT,
  } = input;

  if (!enabled) {
    return { chaptersToDownload: [], chapterIdsToDelete: [] };
  }

  const chapterIdsToDelete: string[] = [];
  for (const chId of deletableDownloadChapterIds) {
    if (chId === currentChapterId) continue;
    if (completedChapterIds.has(chId)) {
      chapterIdsToDelete.push(chId);
    }
  }

  const chaptersToDownload: T[] = [];
  if (currentChapterId && prefetchCount > 0) {
    const currentIndex = chapters.findIndex((c) => c.id === currentChapterId);
    if (currentIndex !== -1) {
      let checked = 0;
      for (
        let i = currentIndex + 1;
        i < chapters.length && checked < prefetchCount;
        i++
      ) {
        checked += 1;
        const candidate = chapters[i];
        if (downloadedChapterIds.has(candidate.id)) continue;
        if (completedChapterIds.has(candidate.id)) continue;
        chaptersToDownload.push(candidate);
      }
    }
  }

  return {
    chaptersToDownload,
    chapterIdsToDelete,
  };
}
