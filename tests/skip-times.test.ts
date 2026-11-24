import { describe, it, expect, vi } from "vitest";
import {
  SkipTimesService,
  normalizeAnimeSearchTitle,
  buildAnimeTitleCandidates,
  parseEpisodeNumber,
  evaluateSkipUIState,
} from "../packages/sdk/src/services/skipTimes.service";

describe("skipTimes.service utilities", () => {
  it("normalizes anime titles by stripping release and Arabic scraper tags", () => {
    expect(normalizeAnimeSearchTitle("Jujutsu Kaisen (TV) [Sub]")).toBe(
      "Jujutsu Kaisen",
    );
    expect(normalizeAnimeSearchTitle("Attack on Titan (Dub)")).toBe(
      "Attack on Titan",
    );
    expect(normalizeAnimeSearchTitle("One Piece")).toBe("One Piece");
    expect(
      normalizeAnimeSearchTitle("انمي Black Clover الموسم 2 مترجم اون لاين"),
    ).toBe("Black Clover");
    expect(normalizeAnimeSearchTitle("فيلم Jujutsu Kaisen 0 مترجم")).toBe(
      "Jujutsu Kaisen 0",
    );
  });

  it("builds season + base title fallback candidates for Arabic/English season titles", () => {
    expect(buildAnimeTitleCandidates("انمي Black Clover الموسم 2")).toEqual([
      "Black Clover Season 2",
      "Black Clover",
    ]);
    expect(buildAnimeTitleCandidates("Attack on Titan الموسم الثالث")).toEqual([
      "Attack on Titan Season 3",
      "Attack on Titan",
    ]);
    expect(buildAnimeTitleCandidates("Naruto Shippuden")).toEqual([
      "Naruto Shippuden",
    ]);
  });

  it("parses episode numbers from numbers and titles", () => {
    expect(parseEpisodeNumber(5)).toBe(5);
    expect(parseEpisodeNumber("12")).toBe(12);
    expect(parseEpisodeNumber(undefined, "Episode 24: Finale")).toBe(24);
    expect(parseEpisodeNumber(undefined, "EP 3.5 Special")).toBe(3.5);
    expect(parseEpisodeNumber(undefined, "الحلقة 9 مترجمة")).toBe(9);
    expect(parseEpisodeNumber(0, "Prologue")).toBeNull();
  });
});

describe("SkipTimesService AniSkip & AniList resolution", () => {
  it("prioritizes exact op/ed over mixed-op/mixed-ed and caches response", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          found: true,
          results: [
            {
              skipType: "mixed-ed",
              interval: { startTime: 220, endTime: 310 },
              episodeLength: 1490,
            },
            {
              skipType: "op",
              interval: { startTime: 54.7, endTime: 145.1 },
              episodeLength: 1435,
            },
            {
              skipType: "ed",
              interval: { startTime: 1338.2, endTime: 1428.2 },
              episodeLength: 1435,
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    const service = new SkipTimesService(
      fetchMock as unknown as typeof fetch,
      2000,
    );

    const first = await service.getSkipTimes({
      malId: 40748,
      episodeNumber: 1,
      episodeLength: 1435,
    });
    const second = await service.getSkipTimes({
      malId: 40748,
      episodeNumber: 1,
      episodeLength: 1435,
    });

    expect(first).toEqual({
      malId: 40748,
      op: { startTime: 54.7, endTime: 145.1 },
      ed: { startTime: 1338.2, endTime: 1428.2 },
    });
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("resolves MAL ID from AniList ID and fetches AniSkip", async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      const target = String(url);
      if (target.includes("graphql.anilist.co")) {
        return new Response(
          JSON.stringify({ data: { Media: { id: 113415, idMal: 40748 } } }),
          {
            status: 200,
          },
        );
      }
      return new Response(
        JSON.stringify({
          found: true,
          results: [
            { skipType: "mixed-op", interval: { startTime: 80, endTime: 170 } },
          ],
        }),
        { status: 200 },
      );
    });

    const service = new SkipTimesService(
      fetchMock as unknown as typeof fetch,
      2000,
    );
    const res = await service.getSkipTimes({
      anilistId: 113415,
      episodeNumber: 2,
    });

    expect(res).toEqual({
      malId: 40748,
      op: { startTime: 80, endTime: 170 },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("resolves MAL ID via AniList title search when no tracker is linked", async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      const target = String(url);
      if (target.includes("graphql.anilist.co")) {
        return new Response(
          JSON.stringify({
            data: {
              Page: {
                media: [
                  {
                    id: 16498,
                    idMal: 16498,
                    title: { romaji: "Shingeki no Kyojin" },
                  },
                ],
              },
            },
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ found: false, results: [] }), {
        status: 404,
      });
    });

    const service = new SkipTimesService(
      fetchMock as unknown as typeof fetch,
      2000,
    );
    const res = await service.getSkipTimes({
      title: "Attack on Titan (Sub)",
      episodeNumber: 1,
    });

    expect(res).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("falls back to base title when season candidate has no AniSkip data (e.g. Black Clover الموسم 2)", async () => {
    const fetchMock = vi.fn(
      async (url: RequestInfo | URL, init?: RequestInit) => {
        const target = String(url);
        if (target.includes("graphql.anilist.co")) {
          const body = JSON.parse(String(init?.body || "{}"));
          const search = body.variables?.search;
          if (search === "Black Clover Season 2") {
            return new Response(
              JSON.stringify({
                data: { Page: { media: [{ id: 195604, idMal: 61967 }] } },
              }),
              { status: 200 },
            );
          }
          if (search === "Black Clover") {
            return new Response(
              JSON.stringify({
                data: { Page: { media: [{ id: 97940, idMal: 34572 }] } },
              }),
              { status: 200 },
            );
          }
        }
        if (target.includes("/61967/")) {
          return new Response(JSON.stringify({ found: false, results: [] }), {
            status: 404,
          });
        }
        if (target.includes("/34572/")) {
          return new Response(
            JSON.stringify({
              found: true,
              results: [
                {
                  skipType: "op",
                  interval: { startTime: 180.683, endTime: 270.683 },
                },
              ],
            }),
            { status: 200 },
          );
        }
        return new Response(null, { status: 404 });
      },
    );

    const service = new SkipTimesService(
      fetchMock as unknown as typeof fetch,
      2000,
    );
    const res = await service.getSkipTimes({
      title: "انمي Black Clover الموسم 2",
      episodeNumber: 1,
    });

    expect(res).toEqual({
      malId: 34572,
      op: { startTime: 180.683, endTime: 270.683 },
    });
  });

  it("returns null silently on network errors", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("Network offline");
    });

    const service = new SkipTimesService(
      fetchMock as unknown as typeof fetch,
      2000,
    );
    const res = await service.getSkipTimes({ malId: 21, episodeNumber: 1 });

    expect(res).toBeNull();
  });
});

describe("evaluateSkipUIState hybrid logic", () => {
  const skipData = {
    op: { startTime: 60, endTime: 150 },
    ed: { startTime: 1320, endTime: 1410 },
  };

  it("shows Skip Intro inside [op.startTime, op.endTime)", () => {
    expect(
      evaluateSkipUIState({
        skipTimes: skipData,
        currentTime: 59,
        duration: 1440,
        hasNextEpisode: true,
        outroDismissed: false,
      }).isInIntro,
    ).toBe(false);

    expect(
      evaluateSkipUIState({
        skipTimes: skipData,
        currentTime: 90,
        duration: 1440,
        hasNextEpisode: true,
        outroDismissed: false,
      }).isInIntro,
    ).toBe(true);

    expect(
      evaluateSkipUIState({
        skipTimes: skipData,
        currentTime: 150,
        duration: 1440,
        hasNextEpisode: true,
        outroDismissed: false,
      }).isInIntro,
    ).toBe(false);
  });

  it("shows exact Next Episode trigger when ed interval is reached", () => {
    const res = evaluateSkipUIState({
      skipTimes: skipData,
      currentTime: 1330,
      duration: 1440,
      hasNextEpisode: true,
      outroDismissed: false,
    });
    expect(res.isExactOutro).toBe(true);
    expect(res.isFallbackOutro).toBe(false);
    expect(res.showNextEpisode).toBe(true);
  });

  it("triggers smart 95s fallback when AniSkip ed is unavailable on >= 10m videos", () => {
    // Under 10 mins (600s) -> no fallback
    expect(
      evaluateSkipUIState({
        skipTimes: null,
        currentTime: 520,
        duration: 580,
        hasNextEpisode: true,
        outroDismissed: false,
      }).showNextEpisode,
    ).toBe(false);

    // 24m video with 90s remaining -> shows fallback
    const fallback = evaluateSkipUIState({
      skipTimes: null,
      currentTime: 1350,
      duration: 1440,
      hasNextEpisode: true,
      outroDismissed: false,
    });
    expect(fallback.isExactOutro).toBe(false);
    expect(fallback.isFallbackOutro).toBe(true);
    expect(fallback.showNextEpisode).toBe(true);
  });

  it("respects outroDismissed and missing nextEpisode", () => {
    expect(
      evaluateSkipUIState({
        skipTimes: skipData,
        currentTime: 1350,
        duration: 1440,
        hasNextEpisode: true,
        outroDismissed: true,
      }).showNextEpisode,
    ).toBe(false);

    expect(
      evaluateSkipUIState({
        skipTimes: skipData,
        currentTime: 1350,
        duration: 1440,
        hasNextEpisode: false,
        outroDismissed: false,
      }).showNextEpisode,
    ).toBe(false);
  });
});
