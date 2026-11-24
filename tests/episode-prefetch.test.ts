import { describe, it, expect, vi } from "vitest";
import {
  PREFETCH_PLAYBACK_THRESHOLD,
  detectVideoStreamType,
  isAdStreamUrl,
  extractRawStreamUrls,
  normalizeStreamServers,
  selectPreferredServerIndex,
  makeEpisodePrefetchKey,
  shouldPrefetchNextEpisode,
  EpisodeStreamPrefetchCache,
  prefetchNextEpisodeSkipTimes,
} from "../packages/sdk/src/services/episodePrefetch.service";

describe("episodePrefetch.service helpers", () => {
  it("triggers next-episode prefetch only at >= 80% playback and deduplicates per transition", () => {
    const prefetched = new Set<string>();
    const pkg = "ma.autakimi.ext";
    const nextEpisodeUrl = "https://example.com/ep-2";
    const transitionKey = `${pkg}::ep-1->ep-2`;

    expect(
      shouldPrefetchNextEpisode({
        currentTime: 959,
        duration: 1200,
        pkg,
        nextEpisodeUrl,
        prefetchedKeys: prefetched,
        transitionKey,
      }),
    ).toBe(false);

    expect(960 / 1200).toBe(PREFETCH_PLAYBACK_THRESHOLD);
    expect(
      shouldPrefetchNextEpisode({
        currentTime: 960,
        duration: 1200,
        pkg,
        nextEpisodeUrl,
        prefetchedKeys: prefetched,
        transitionKey,
      }),
    ).toBe(true);

    prefetched.add(transitionKey);

    expect(
      shouldPrefetchNextEpisode({
        currentTime: 1050,
        duration: 1200,
        pkg,
        nextEpisodeUrl,
        prefetchedKeys: prefetched,
        transitionKey,
      }),
    ).toBe(false);

    expect(
      shouldPrefetchNextEpisode({
        currentTime: 1000,
        duration: 0,
        pkg,
        nextEpisodeUrl,
        prefetchedKeys: new Set(),
      }),
    ).toBe(false);
  });

  it("extracts, normalizes, filters ads, and selects preferred direct stream servers", () => {
    expect(
      detectVideoStreamType("https://cdn.example.com/master.m3u8?t=1"),
    ).toBe("hls");
    expect(detectVideoStreamType("https://cdn.example.com/video.mp4")).toBe(
      "mp4",
    );
    expect(detectVideoStreamType("https://player.example.com/embed/abc")).toBe(
      "embed",
    );

    expect(isAdStreamUrl("https://doubleclick.net/pixel")).toBe(true);
    expect(isAdStreamUrl("https://cdn.example.com/ads/promo.html")).toBe(true);
    expect(isAdStreamUrl("https://cdn.example.com/ads/video.mp4")).toBe(false);

    const raw = extractRawStreamUrls({
      urls: [
        "https://propellerads.com/pop",
        { name: "EmbedMirror", url: "https://player.example.com/e/1" },
        { name: "FastCDN", url: "https://cdn.example.com/stream.m3u8" },
        "https://cdn.example.com/ep2.mp4",
      ],
    });
    const servers = normalizeStreamServers(raw);

    expect(servers).toHaveLength(3);
    expect(servers[1]).toMatchObject({ name: "FastCDN", type: "hls" });
    expect(servers[2]).toMatchObject({ name: "Server 4", type: "mp4" });

    // Overrides embed preference when direct HLS/MP4 is available
    expect(selectPreferredServerIndex(servers, "EmbedMirror")).toBe(1);
    expect(selectPreferredServerIndex(servers, "Server 4")).toBe(2);
    expect(selectPreferredServerIndex(servers, null)).toBe(1);
  });
});

describe("EpisodeStreamPrefetchCache", () => {
  it("deduplicates concurrent in-flight requests and caches valid results with TTL", async () => {
    const cache = new EpisodeStreamPrefetchCache(5000, 3);
    const key = makeEpisodePrefetchKey("ext.pkg", "https://example.com/ep-2");

    let resolveFetch!: (val: any) => void;
    const fetcher = vi.fn(
      () =>
        new Promise<any>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    // Start background prefetch at 80%
    const bgPromise = cache.prefetchInBackground(key, fetcher);
    // User clicks "Next Episode" before prefetch completes -> shares same in-flight promise
    const fgPromise = cache.getOrLoad(key, fetcher);

    expect(cache.hasValidOrInFlight(key)).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);

    resolveFetch({
      servers: [
        { name: "Main", url: "https://cdn.example.com/2.m3u8", type: "hls" },
      ],
      fetchedAt: Date.now(),
    });

    const [bgRes, fgRes] = await Promise.all([bgPromise, fgPromise]);
    expect(bgRes?.servers[0].url).toBe("https://cdn.example.com/2.m3u8");
    expect(fgRes.servers[0].url).toBe("https://cdn.example.com/2.m3u8");

    // Subsequent call reads directly from cache without calling fetcher
    const cached = cache.getCached(key);
    expect(cached?.servers).toHaveLength(1);

    // Expired entries are evicted automatically
    expect(cache.getCached(key, Date.now() + 6000)).toBeNull();
  });

  it("swallows background prefetch failures without poisoning retry attempts", async () => {
    const cache = new EpisodeStreamPrefetchCache(60_000, 5);
    const key = makeEpisodePrefetchKey("ext.pkg", "https://example.com/ep-3");

    const failingFetcher = vi
      .fn()
      .mockRejectedValue(new Error("Temporary 503"));
    const bgResult = await cache.prefetchInBackground(key, failingFetcher);

    expect(bgResult).toBeNull();
    expect(cache.getCached(key)).toBeNull();
    expect(cache.hasValidOrInFlight(key)).toBe(false);

    const retryFetcher = vi.fn().mockResolvedValue({
      servers: [
        { name: "Retry", url: "https://cdn.example.com/3.mp4", type: "mp4" },
      ],
      fetchedAt: Date.now(),
    });
    const entry = await cache.getOrLoad(key, retryFetcher);
    expect(entry.servers[0].url).toBe("https://cdn.example.com/3.mp4");
  });

  it("bounds cache size by evicting oldest entries", () => {
    const cache = new EpisodeStreamPrefetchCache(60_000, 2);
    const now = Date.now();
    cache.setCached("k1", {
      servers: [{ name: "S1", url: "u1", type: "hls" }],
      fetchedAt: now,
    });
    cache.setCached("k2", {
      servers: [{ name: "S2", url: "u2", type: "hls" }],
      fetchedAt: now,
    });
    cache.setCached("k3", {
      servers: [{ name: "S3", url: "u3", type: "hls" }],
      fetchedAt: now,
    });

    expect(cache.getCached("k1", now)).toBeNull();
    expect(cache.getCached("k2", now)).not.toBeNull();
    expect(cache.getCached("k3", now)).not.toBeNull();
  });

  it("warms next-episode AniSkip timestamps silently using resolved tracker IDs", async () => {
    const getTrackers = vi.fn().mockResolvedValue([
      { provider: "mal", remoteId: 21 },
      { provider: "anilist", remoteId: 21 },
    ]);
    const getSkipTimes = vi.fn().mockResolvedValue({
      malId: 21,
      op: { startTime: 85, endTime: 175 },
    });

    const result = await prefetchNextEpisodeSkipTimes({
      animeId: "one-piece",
      animeTitle: "One Piece",
      nextEpisode: { number: 1072, title: "Episode 1072" },
      episodeLength: 1420.7,
      getTrackers,
      getSkipTimes,
    });

    expect(result?.op).toEqual({ startTime: 85, endTime: 175 });
    expect(getSkipTimes).toHaveBeenCalledWith({
      malId: 21,
      anilistId: 21,
      title: "One Piece",
      episodeNumber: 1072,
      episodeLength: 1420,
    });
  });
});
