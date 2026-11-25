import { describe, it, expect } from "vitest";
import {
  computeWrappedStats,
  formatWrappedDuration,
  formatWrappedHours,
  normalizeHistoryRecord,
  toLocalDateKey,
} from "@common/utils/wrappedStats";

describe("Local Wrapped / Stats Dashboard", () => {
  it("normalizes both Desktop camelCase and Mobile snake_case history records", () => {
    const desktopRow = normalizeHistoryRecord({
      mangaId: "solo-leveling",
      mangaTitle: "Solo Leveling",
      chapterId: "ep-4",
      startedAt: "2026-11-24T20:00:00",
      durationSeconds: 1420,
      mediaType: "anime",
    });
    expect(desktopRow).toMatchObject({
      mangaId: "solo-leveling",
      mangaTitle: "Solo Leveling",
      durationSeconds: 1420,
      mediaType: "anime",
    });

    const mobileRow = normalizeHistoryRecord({
      manga_id: "vagabond",
      manga_title: "Vagabond",
      chapter_id: "ch-120",
      started_at: "2026-11-24T22:15:00",
      duration_seconds: 900,
      type: "manga",
    });
    expect(mobileRow).toMatchObject({
      mangaId: "vagabond",
      mangaTitle: "Vagabond",
      durationSeconds: 900,
      mediaType: "manga",
    });

    expect(
      normalizeHistoryRecord({ mangaId: "", startedAt: "2026-11-24T20:00:00" }),
    ).toBeNull();
  });

  it("computes weekly anime/manga duration, current/longest streaks, top genres, and top titles", () => {
    const now = new Date(2026, 10, 25, 21, 0, 0); // Local Nov 25, 2026
    const isoAt = (year: number, monthIdx: number, day: number, hour: number) =>
      new Date(year, monthIdx, day, hour, 30, 0).toISOString();

    const stats = computeWrappedStats({
      now,
      historyEntries: [
        // 3 consecutive days ending today (Nov 23, 24, 25) -> current streak = 3
        {
          mangaId: "solo",
          mangaTitle: "Solo Leveling",
          chapterId: "ep-4",
          startedAt: isoAt(2026, 10, 25, 20),
          durationSeconds: 3600,
          mediaType: "anime",
        },
        {
          mangaId: "vagabond",
          mangaTitle: "Vagabond",
          chapterId: "ch-120",
          startedAt: isoAt(2026, 10, 24, 22),
          durationSeconds: 1800,
          mediaType: "manga",
        },
        {
          mangaId: "solo",
          mangaTitle: "Solo Leveling",
          chapterId: "ep-3",
          startedAt: isoAt(2026, 10, 23, 21),
          durationSeconds: 1800,
          mediaType: "anime",
        },
        // Older 4-day streak earlier in November -> longest streak = 4
        {
          mangaId: "berserk",
          mangaTitle: "Berserk",
          chapterId: "ch-1",
          startedAt: isoAt(2026, 10, 10, 23),
          durationSeconds: 600,
          mediaType: "manga",
        },
        {
          mangaId: "berserk",
          mangaTitle: "Berserk",
          chapterId: "ch-2",
          startedAt: isoAt(2026, 10, 11, 23),
          durationSeconds: 600,
          mediaType: "manga",
        },
        {
          mangaId: "berserk",
          mangaTitle: "Berserk",
          chapterId: "ch-3",
          startedAt: isoAt(2026, 10, 12, 23),
          durationSeconds: 600,
          mediaType: "manga",
        },
        {
          mangaId: "berserk",
          mangaTitle: "Berserk",
          chapterId: "ch-4",
          startedAt: isoAt(2026, 10, 13, 23),
          durationSeconds: 600,
          mediaType: "manga",
        },
      ],
      genresByMangaId: {
        solo: ["Action", "Fantasy"],
        vagabond: ["Action", "Historical", "Seinen"],
        berserk: ["Dark Fantasy", "Action"],
      },
    });

    expect(stats.hasData).toBe(true);
    expect(stats.weeklyAnimeSeconds).toBe(5400);
    expect(stats.weeklyMangaSeconds).toBe(1800);
    expect(stats.weeklyTotalSeconds).toBe(7200);
    expect(stats.weeklySessions).toBe(3);
    expect(stats.allTimeTotalSeconds).toBe(9600);
    expect(stats.currentStreakDays).toBe(3);
    expect(stats.longestStreakDays).toBe(4);
    expect(stats.totalActiveDays).toBe(7);
    expect(stats.dailyActivity).toHaveLength(7);
    expect(stats.dailyActivity[6].dateKey).toBe(toLocalDateKey(now));
    expect(stats.topGenres[0].genre).toBe("Action");
    expect(stats.topTitles[0]).toMatchObject({
      mangaId: "solo",
      durationSeconds: 5400,
      sessions: 2,
    });
    expect(stats.persona).toBe("Evening Binger");
  });

  it("preserves streak across today grace window if active yesterday and formats labels", () => {
    const now = new Date(2026, 10, 25, 9, 0, 0);
    const yesterday = new Date(2026, 10, 24, 1, 30, 0);
    const dayBefore = new Date(2026, 10, 23, 2, 0, 0);

    const stats = computeWrappedStats({
      now,
      historyEntries: [
        {
          mangaId: "one-piece",
          mangaTitle: "One Piece",
          chapterId: "ch-1000",
          startedAt: yesterday.toISOString(),
          durationSeconds: 1200,
          mediaType: "manga",
        },
        {
          mangaId: "one-piece",
          mangaTitle: "One Piece",
          chapterId: "ch-999",
          startedAt: dayBefore.toISOString(),
          durationSeconds: 1200,
          mediaType: "manga",
        },
      ],
    });

    expect(stats.currentStreakDays).toBe(2);
    expect(stats.persona).toBe("Night Owl");
    expect(formatWrappedDuration(5400)).toBe("1h 30m");
    expect(formatWrappedHours(5400)).toBe("1.5h");
  });

  it("handles empty history gracefully", () => {
    const stats = computeWrappedStats({ historyEntries: [] });
    expect(stats.mediaFilter).toBe("all");
    expect(stats.hasData).toBe(false);
    expect(stats.currentStreakDays).toBe(0);
    expect(stats.topGenres).toEqual([]);
    expect(stats.topTitles).toEqual([]);
    expect(stats.persona).toBe("Getting Started");
  });

  it("filters weekly time, streaks, genres, and titles cleanly by Anime or Manga tab", () => {
    const now = new Date(2026, 10, 25, 21, 0, 0);
    const entries = [
      {
        mangaId: "solo",
        mangaTitle: "Solo Leveling",
        chapterId: "ep-4",
        startedAt: new Date(2026, 10, 25, 20, 0, 0).toISOString(),
        durationSeconds: 3600,
        mediaType: "anime",
      },
      {
        mangaId: "vagabond",
        mangaTitle: "Vagabond",
        chapterId: "ch-120",
        startedAt: new Date(2026, 10, 25, 1, 0, 0).toISOString(),
        durationSeconds: 1800,
        mediaType: "manga",
      },
      {
        mangaId: "vagabond",
        mangaTitle: "Vagabond",
        chapterId: "ch-119",
        startedAt: new Date(2026, 10, 24, 1, 0, 0).toISOString(),
        durationSeconds: 1200,
        mediaType: "manga",
      },
    ];
    const genresByMangaId = {
      solo: ["Fantasy"],
      vagabond: ["Historical", "Seinen"],
    };

    const animeStats = computeWrappedStats({
      now,
      historyEntries: entries,
      genresByMangaId,
      mediaFilter: "anime",
    });
    expect(animeStats.mediaFilter).toBe("anime");
    expect(animeStats.weeklyTotalSeconds).toBe(3600);
    expect(animeStats.currentStreakDays).toBe(1);
    expect(animeStats.topGenres.map((g) => g.genre)).toEqual(["Fantasy"]);
    expect(animeStats.topTitles.map((t) => t.mangaId)).toEqual(["solo"]);

    const mangaStats = computeWrappedStats({
      now,
      historyEntries: entries,
      genresByMangaId,
      mediaFilter: "manga",
    });
    expect(mangaStats.mediaFilter).toBe("manga");
    expect(mangaStats.weeklyTotalSeconds).toBe(3000);
    expect(mangaStats.currentStreakDays).toBe(2);
    expect(mangaStats.persona).toBe("Night Owl");
    expect(mangaStats.topGenres.map((g) => g.genre)).toEqual([
      "Historical",
      "Seinen",
    ]);
    expect(mangaStats.topTitles.map((t) => t.mangaId)).toEqual(["vagabond"]);
  });
});
