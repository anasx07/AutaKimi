import { describe, it, expect } from "vitest";
import { mergeHistoryRowFallback } from "../apps/desktop/src/main/db/repositories/history.repo";

describe("History Cover & Metadata Backfill", () => {
  it("prefers cover/url stored directly on reading_history when present", () => {
    const merged = mergeHistoryRowFallback({
      id: 1,
      mangaId: "anime-1",
      mangaTitle: "Solo Leveling",
      mangaCover: "https://cdn.example.com/direct.jpg",
      mangaUrl: "https://example.com/anime/1",
      chapterId: "ep-1",
      chapterTitle: "Episode 1",
      startedAt: "2026-11-25T00:00:00.000Z",
      durationSeconds: 1200,
      pkg: "ext.anime",
      mediaType: "anime",
      cacheCoverUrl: "https://cdn.example.com/cache.jpg",
      libraryCoverUrl: "https://cdn.example.com/lib.jpg",
    });

    expect(merged.mangaCover).toBe("https://cdn.example.com/direct.jpg");
    expect(merged.mangaUrl).toBe("https://example.com/anime/1");
    expect(merged.type).toBe("anime");
  });

  it("recovers missing anime covers and URLs from manga_cache or library", () => {
    const fromCache = mergeHistoryRowFallback({
      id: 2,
      mangaId: "anime-2",
      mangaTitle: "Ninja Kamui",
      mangaCover: null,
      mangaUrl: null,
      chapterId: "ep-1",
      chapterTitle: "Episode 1",
      startedAt: "2026-11-25T00:00:00.000Z",
      durationSeconds: 900,
      pkg: "ext.anime",
      mediaType: "anime",
      cacheCoverUrl: "https://cdn.example.com/ninja-cache.jpg",
      cacheUrl: "https://example.com/anime/ninja-kamui",
      libraryCoverUrl: "https://cdn.example.com/ninja-lib.jpg",
    });
    expect(fromCache.mangaCover).toBe(
      "https://cdn.example.com/ninja-cache.jpg",
    );
    expect(fromCache.mangaUrl).toBe("https://example.com/anime/ninja-kamui");

    const fromLibrary = mergeHistoryRowFallback({
      id: 3,
      mangaId: "anime-3",
      mangaTitle: null,
      mangaCover: null,
      mangaUrl: null,
      chapterId: "ep-2",
      chapterTitle: "Episode 2",
      startedAt: "2026-11-25T00:00:00.000Z",
      durationSeconds: 300,
      pkg: "ext.anime",
      mediaType: "anime",
      cacheCoverUrl: null,
      libraryCoverUrl: "https://cdn.example.com/lib-cover.jpg",
      libraryTitle: "Vinland Saga",
    });
    expect(fromLibrary.mangaCover).toBe(
      "https://cdn.example.com/lib-cover.jpg",
    );
    expect(fromLibrary.mangaTitle).toBe("Vinland Saga");
  });
});
