import { describe, it, expect } from "vitest";
import {
  computeSmartDownloadPlan,
  SMART_DOWNLOAD_PREFETCH_COUNT,
} from "@common/utils/smartDownloads";
import { SettingsMapper } from "../apps/desktop/src/renderer/src/shared/lib/settings.mapper";

describe("Netflix-Style Smart Downloads", () => {
  const chapters = [
    { id: "ch-1", number: 1, url: "https://example.com/1" },
    { id: "ch-2", number: 2, url: "https://example.com/2" },
    { id: "ch-3", number: 3, url: "https://example.com/3" },
    { id: "ch-4", number: 4, url: "https://example.com/4" },
    { id: "ch-5", number: 5, url: "https://example.com/5" },
    { id: "ch-6", number: 6, url: "https://example.com/6" },
  ];

  it("does nothing when disabled", () => {
    expect(
      computeSmartDownloadPlan({
        enabled: false,
        chapters,
        currentChapterId: "ch-2",
        completedChapterIds: new Set(["ch-1"]),
        downloadedChapterIds: new Set(["ch-1"]),
      }),
    ).toEqual({
      chaptersToDownload: [],
      chapterIdsToDelete: [],
    });
  });

  it("queues the next 3 unread chapters when reading starts and deletes completed ones", () => {
    expect(SMART_DOWNLOAD_PREFETCH_COUNT).toBe(3);

    const plan = computeSmartDownloadPlan({
      enabled: true,
      chapters,
      currentChapterId: "ch-2",
      completedChapterIds: new Set(["ch-1"]),
      downloadedChapterIds: new Set(["ch-1", "ch-3"]),
    });

    // Next 3 after ch-2 are [ch-3, ch-4, ch-5]; ch-3 is already downloaded, so queue ch-4 & ch-5
    expect(plan.chaptersToDownload.map((c) => c.id)).toEqual(["ch-4", "ch-5"]);
    // ch-1 is completed and not the active chapter -> deleted
    expect(plan.chapterIdsToDelete).toEqual(["ch-1"]);
  });

  it("never deletes the currently open chapter even after reaching its last page", () => {
    const plan = computeSmartDownloadPlan({
      enabled: true,
      chapters,
      currentChapterId: "ch-2",
      completedChapterIds: new Set(["ch-1", "ch-2"]),
      downloadedChapterIds: new Set(["ch-1", "ch-2", "ch-3", "ch-4", "ch-5"]),
    });

    expect(plan.chapterIdsToDelete).toEqual(["ch-1"]);
    expect(plan.chaptersToDownload).toEqual([]);
  });

  it("deletes the completed active chapter once reader exits (currentChapterId = null)", () => {
    const plan = computeSmartDownloadPlan({
      enabled: true,
      chapters,
      currentChapterId: null,
      completedChapterIds: new Set(["ch-2"]),
      downloadedChapterIds: new Set(["ch-2", "ch-3", "ch-4", "ch-5"]),
    });

    expect(plan.chapterIdsToDelete).toEqual(["ch-2"]);
    expect(plan.chaptersToDownload).toEqual([]);
  });

  it("skips already read chapters in the lookahead window and handles chapter end cleanly", () => {
    const plan = computeSmartDownloadPlan({
      enabled: true,
      chapters,
      currentChapterId: "ch-4",
      completedChapterIds: new Set(["ch-5"]),
      downloadedChapterIds: new Set(),
    });

    // Remaining chapters after ch-4 are ch-5 (already completed -> skip) and ch-6
    expect(plan.chaptersToDownload.map((c) => c.id)).toEqual(["ch-6"]);
  });

  it("persists smart_downloads_enabled through SettingsMapper defaulting to false", () => {
    const defaultSchema = SettingsMapper.toSchema({});
    expect(defaultSchema.download.smartDownloadsEnabled).toBe(false);

    const enabledSchema = SettingsMapper.toSchema({
      smart_downloads_enabled: "true",
    });
    expect(enabledSchema.download.smartDownloadsEnabled).toBe(true);
  });
});
