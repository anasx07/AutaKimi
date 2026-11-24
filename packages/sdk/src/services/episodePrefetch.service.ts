import {
  parseEpisodeNumber,
  type EpisodeSkipTimes,
  type SkipTimesRequest,
} from "./skipTimes.service";

export const PREFETCH_PLAYBACK_THRESHOLD = 0.8;
export const DEFAULT_EPISODE_PREFETCH_TTL_MS = 10 * 60 * 1000;
export const DEFAULT_EPISODE_PREFETCH_MAX_ENTRIES = 12;

export type VideoStreamType = "hls" | "mp4" | "embed";

export interface NormalizedStreamServer {
  name: string;
  url: string;
  type: VideoStreamType;
  headers?: Record<string, string>;
}

export interface ServerProbeResult {
  index: number;
  status: "alive" | "dead";
  pingMs?: number;
  error?: string;
}

export interface EpisodeStreamCacheEntry {
  servers: NormalizedStreamServer[];
  debug?: unknown;
  fetchedAt: number;
  probeResults?: ServerProbeResult[];
}

const AD_DOMAINS = [
  "a-ads.com",
  "doubleclick.net",
  "googlesyndication.com",
  "googleadservices.com",
  "popads.net",
  "propellerads.com",
  "adsterra.com",
  "exoclick.com",
  "juicyads.com",
  "trafficjunky.com",
  "adnxs.com",
  "adform.net",
  "wingsmob.com",
  "sleeklyyallaer.com",
  "luckypick.top",
  "bc.game",
  "1xbet",
  "melbet",
  "betway",
  "bet365",
];

/**
 * Infers playback transport type (hls, mp4, or embed) from server metadata or URL.
 */
export function detectVideoStreamType(server: unknown): VideoStreamType {
  if (!server) return "embed";
  if (
    typeof server === "object" &&
    server !== null &&
    "type" in server &&
    (server as any).type
  ) {
    const t = String((server as any).type).toLowerCase();
    if (t === "hls" || t === "m3u8") return "hls";
    if (t === "mp4" || t === "webm") return "mp4";
    if (t === "embed") return "embed";
  }
  const url =
    typeof server === "object" && server !== null
      ? String((server as any).url || "")
      : String(server || "");
  const cleanUrl = url.split("?")[0].toLowerCase();
  const lowerUrl = url.toLowerCase();
  if (
    cleanUrl.endsWith(".m3u8") ||
    lowerUrl.includes(".m3u8") ||
    lowerUrl.includes("hls_proxy") ||
    lowerUrl.includes("mode=m3u8")
  ) {
    return "hls";
  }
  if (
    cleanUrl.endsWith(".mp4") ||
    cleanUrl.endsWith(".webm") ||
    lowerUrl.includes(".mp4") ||
    lowerUrl.includes("stream_proxy")
  ) {
    return "mp4";
  }
  return "embed";
}

/**
 * Filters out known ad-network/banner redirect URLs while keeping direct media streams.
 */
export function isAdStreamUrl(url?: string): boolean {
  if (!url || typeof url !== "string") return false;
  const lower = url.toLowerCase().trim();
  if (
    !lower.startsWith("http://") &&
    !lower.startsWith("https://") &&
    !lower.startsWith("//")
  ) {
    return false;
  }
  for (const domain of AD_DOMAINS) {
    if (lower.includes(domain)) return true;
  }
  if (
    (lower.includes("/ad/") ||
      lower.includes("/ads/") ||
      lower.includes("/banner/")) &&
    !lower.includes(".mp4") &&
    !lower.includes(".m3u8")
  ) {
    return true;
  }
  return false;
}

/**
 * Extracts raw server candidate entries from various extension response shapes.
 */
export function extractRawStreamUrls(res: unknown): unknown[] {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (typeof res === "object") {
    const obj = res as Record<string, unknown>;
    if (Array.isArray(obj.pages)) return obj.pages;
    if (Array.isArray(obj.urls)) return obj.urls;
    if (Array.isArray(obj.data)) return obj.data;
  }
  return [];
}

/**
 * Normalizes raw extension stream candidates and removes empty or advertisement entries.
 */
export function normalizeStreamServers(
  rawUrls: unknown[],
): NormalizedStreamServer[] {
  return rawUrls
    .map((srv, idx): NormalizedStreamServer | null => {
      if (typeof srv === "object" && srv !== null) {
        const obj = srv as Record<string, unknown>;
        const url =
          typeof obj.url === "string" ? obj.url : String(obj.url || "");
        return {
          name:
            typeof obj.name === "string" && obj.name
              ? obj.name
              : `Server ${idx + 1}`,
          url,
          type: detectVideoStreamType(obj),
          headers:
            obj.headers && typeof obj.headers === "object"
              ? (obj.headers as Record<string, string>)
              : undefined,
        };
      }
      const url = String(srv || "");
      return {
        name: `Server ${idx + 1}`,
        url,
        type: detectVideoStreamType(srv),
      };
    })
    .filter((srv): srv is NormalizedStreamServer =>
      Boolean(srv && srv.url && !isAdStreamUrl(srv.url)),
    );
}

/**
 * Selects the best initial server index, honoring the user's preferred server unless a direct
 * HLS/MP4 stream should take priority over an embed server.
 */
export function selectPreferredServerIndex(
  servers: NormalizedStreamServer[],
  preferredServerName?: string | null,
): number {
  if (!servers || servers.length === 0) return 0;

  const hasDirectServers = servers.some(
    (srv) => srv.type === "hls" || srv.type === "mp4",
  );
  let targetIdx = -1;

  if (preferredServerName) {
    targetIdx = servers.findIndex((srv) => srv.name === preferredServerName);
  }

  if (
    targetIdx === -1 ||
    (hasDirectServers && servers[targetIdx]?.type === "embed")
  ) {
    const directIdx = servers.findIndex(
      (srv) => srv.type === "hls" || srv.type === "mp4",
    );
    targetIdx = directIdx !== -1 ? directIdx : 0;
  }

  return targetIdx;
}

/**
 * Builds a deterministic cache key for a package + episode URL pair.
 */
export function makeEpisodePrefetchKey(
  pkg: string,
  episodeUrl: string,
): string {
  return `${pkg.trim()}::${episodeUrl.trim()}`;
}

/**
 * Returns true when playback has reached the prefetch threshold (default 80%) and this transition
 * has not been triggered yet.
 */
export function shouldPrefetchNextEpisode(params: {
  currentTime: number;
  duration: number;
  pkg?: string | null;
  nextEpisodeUrl?: string | null;
  prefetchedKeys: Set<string>;
  transitionKey?: string;
  threshold?: number;
}): boolean {
  const {
    currentTime,
    duration,
    pkg,
    nextEpisodeUrl,
    prefetchedKeys,
    transitionKey,
    threshold = PREFETCH_PLAYBACK_THRESHOLD,
  } = params;

  if (!pkg || !nextEpisodeUrl) return false;
  if (!Number.isFinite(duration) || duration <= 0) return false;
  if (!Number.isFinite(currentTime) || currentTime < 0) return false;
  if (currentTime / duration < threshold) return false;

  const key = transitionKey || makeEpisodePrefetchKey(pkg, nextEpisodeUrl);
  return !prefetchedKeys.has(key);
}

/**
 * Bounded in-memory cache with TTL expiration and in-flight request deduplication for
 * background-prefetched episode stream servers.
 */
export class EpisodeStreamPrefetchCache {
  private readonly cache = new Map<string, EpisodeStreamCacheEntry>();
  private readonly inFlight = new Map<
    string,
    Promise<EpisodeStreamCacheEntry>
  >();

  constructor(
    private readonly ttlMs: number = DEFAULT_EPISODE_PREFETCH_TTL_MS,
    private readonly maxEntries: number = DEFAULT_EPISODE_PREFETCH_MAX_ENTRIES,
  ) {}

  getCached(
    key: string,
    now: number = Date.now(),
  ): EpisodeStreamCacheEntry | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (now - entry.fetchedAt > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }
    return entry;
  }

  setCached(key: string, entry: EpisodeStreamCacheEntry): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(key, entry);
  }

  updateProbeResults(key: string, probeResults: ServerProbeResult[]): void {
    const existing = this.getCached(key);
    if (!existing) return;
    this.cache.set(key, {
      ...existing,
      probeResults,
    });
  }

  hasValidOrInFlight(key: string, now: number = Date.now()): boolean {
    return this.getCached(key, now) !== null || this.inFlight.has(key);
  }

  /**
   * Returns a cached entry immediately, awaits an ongoing in-flight request if one exists, or
   * runs `fetcher` once. Errors propagate to foreground callers without poisoning the cache.
   */
  async getOrLoad(
    key: string,
    fetcher: () => Promise<EpisodeStreamCacheEntry>,
  ): Promise<EpisodeStreamCacheEntry> {
    const cached = this.getCached(key);
    if (cached) return cached;

    const existingPromise = this.inFlight.get(key);
    if (existingPromise) {
      return existingPromise;
    }

    const promise = fetcher()
      .then((entry) => {
        if (entry.servers.length > 0) {
          this.setCached(key, entry);
        }
        return entry;
      })
      .finally(() => {
        this.inFlight.delete(key);
      });

    this.inFlight.set(key, promise);
    return promise;
  }

  /**
   * Preloads an episode stream entry in the background. Never throws on network/scraper failure.
   */
  async prefetchInBackground(
    key: string,
    fetcher: () => Promise<EpisodeStreamCacheEntry>,
  ): Promise<EpisodeStreamCacheEntry | null> {
    try {
      return await this.getOrLoad(key, fetcher);
    } catch {
      return null;
    }
  }

  clear(): void {
    this.cache.clear();
    this.inFlight.clear();
  }
}

export const sharedEpisodeStreamCache = new EpisodeStreamPrefetchCache();

/**
 * Resolves tracker IDs (MAL/AniList) and warms the in-memory SkipTimesService cache for the next episode.
 */
export async function prefetchNextEpisodeSkipTimes(params: {
  animeId?: string;
  animeTitle?: string;
  nextEpisode?: { number?: number | string | null; title?: string } | null;
  episodeLength?: number;
  getTrackers: (animeId: string) => Promise<any[]>;
  getSkipTimes: (
    req: SkipTimesRequest,
  ) => Promise<EpisodeSkipTimes | null | undefined>;
}): Promise<EpisodeSkipTimes | null> {
  const {
    animeId,
    animeTitle,
    nextEpisode,
    episodeLength,
    getTrackers,
    getSkipTimes,
  } = params;
  if (!nextEpisode || (!animeId && !animeTitle)) return null;

  const episodeNumber = parseEpisodeNumber(
    nextEpisode.number,
    nextEpisode.title,
  );
  if (!episodeNumber) return null;

  try {
    let malId: number | undefined;
    let anilistId: number | undefined;

    if (animeId) {
      const trackers = await getTrackers(animeId).catch(() => []);
      if (Array.isArray(trackers)) {
        const malTracker = trackers.find((t: any) => t?.provider === "mal");
        const aniTracker = trackers.find((t: any) => t?.provider === "anilist");
        const rawMal = malTracker
          ? Number(malTracker.remoteId ?? malTracker.remote_id)
          : 0;
        const rawAni = aniTracker
          ? Number(aniTracker.remoteId ?? aniTracker.remote_id)
          : 0;
        if (Number.isFinite(rawMal) && rawMal > 0) malId = rawMal;
        if (Number.isFinite(rawAni) && rawAni > 0) anilistId = rawAni;
      }
    }

    const result = await getSkipTimes({
      malId,
      anilistId,
      title: animeTitle,
      episodeNumber,
      episodeLength:
        episodeLength && episodeLength > 60 ? Math.floor(episodeLength) : 0,
    });

    return result ?? null;
  } catch {
    return null;
  }
}
