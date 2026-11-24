const ANILIST_GRAPHQL_ENDPOINT = "https://graphql.anilist.co";
const ANISKIP_API_BASE = "https://api.aniskip.com/v2/skip-times";
const DEFAULT_REQUEST_TIMEOUT_MS = 3500;

export interface SkipInterval {
  startTime: number;
  endTime: number;
}

export interface EpisodeSkipTimes {
  op?: SkipInterval;
  ed?: SkipInterval;
  malId?: number;
}

export interface SkipTimesRequest {
  malId?: number;
  anilistId?: number;
  title?: string;
  episodeNumber: number;
  episodeLength?: number;
}

export interface SkipTimesQuery extends SkipTimesRequest {
  resolveAniListMedia?: (
    anilistId: number,
  ) => Promise<{ idMal?: number } | null | undefined>;
}

interface AniSkipRawResult {
  interval?: {
    startTime?: number;
    endTime?: number;
  };
  skipType?: string;
  episodeLength?: number;
}

interface AniSkipApiResponse {
  found?: boolean;
  results?: AniSkipRawResult[];
}

const ARABIC_ORDINALS: Record<string, number> = {
  الاول: 1,
  الأول: 1,
  الثاني: 2,
  الثانى: 2,
  التاني: 2,
  الثالث: 3,
  التالت: 3,
  الرابع: 4,
  الخامس: 5,
  السادس: 6,
  السابع: 7,
  الثامن: 8,
  التاسع: 9,
  العاشر: 10,
};

function extractSeasonNumber(rawTitle: string): number | null {
  const numMatch = rawTitle.match(
    /(?:الموسم|الجزء|season|part|cour)\s*(\d+)|\bS(\d{1,2})\b/i,
  );
  if (numMatch) {
    const val = parseInt(numMatch[1] || numMatch[2], 10);
    if (Number.isFinite(val) && val > 0) return val;
  }

  for (const [word, num] of Object.entries(ARABIC_ORDINALS)) {
    const ordinalRegex = new RegExp(`(?:الموسم|الجزء)\\s+${word}`, "i");
    if (ordinalRegex.test(rawTitle)) return num;
  }

  return null;
}

/**
 * Cleans common scraper release tags & Arabic wrapper prefixes/suffixes for AniList matching.
 */
export function normalizeAnimeSearchTitle(title: string): string {
  let cleaned = title
    .replace(
      /\s*[([](?:sub|dub|subbed|dubbed|uncensored|censored|tv|bd|hd|fhd|4k|ova|ona|special|raw|arabic|english|multi|مترجم|مترجمة|مدبلج|مدبلجة|اون\s*لاين|أون\s*لاين|كامل|كاملة)[^\])]*[\])]/gi,
      "",
    )
    .replace(
      /(?:الموسم|الجزء)\s+(?:\d+|الأول|الاول|الثاني|الثانى|التاني|الثالث|التالت|الرابع|الخامس|السادس|السابع|الثامن|التاسع|العاشر)/gi,
      "",
    )
    .replace(/(?:الحلقة|حلقة)\s*\d+/gi, "")
    .replace(
      /(?:^|\s)(?:انمي|أنمي|مشاهدة|تحميل|اون\s*لاين|أون\s*لاين|اونلاين|مترجم|مترجمة|مدبلج|مدبلجة|كامل|كاملة|جميع\s*الحلقات|فيلم|مسلسل)(?=\s|$)/gi,
      " ",
    );

  // If Latin characters are present (e.g. "انمي Black Clover ..."), strip leftover Arabic script
  if (/[A-Za-z]/.test(cleaned)) {
    cleaned = cleaned.replace(/[\u0600-\u06FF]+/g, " ");
  }

  return cleaned
    .replace(/^[\s\-:|–—]+|[\s\-:|–—]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Generates ordered search title candidates (e.g. "Black Clover Season 2", "Black Clover")
 * so season splits on scraper sites still resolve AniSkip data cleanly.
 */
export function buildAnimeTitleCandidates(rawTitle: string): string[] {
  const candidates: string[] = [];
  const seasonNum = extractSeasonNumber(rawTitle);
  const baseTitle = normalizeAnimeSearchTitle(rawTitle);

  if (!baseTitle) return candidates;

  const alreadyHasSeason =
    /\b(?:season\s*\d+|\d+(?:st|nd|rd|th)\s+season)\b/i.test(baseTitle);
  if (seasonNum && seasonNum > 1 && !alreadyHasSeason) {
    candidates.push(`${baseTitle} Season ${seasonNum}`);
  }

  candidates.push(baseTitle);

  const strippedTrailingSeason = baseTitle
    .replace(
      /\s+(?:season\s*\d+|\d+(?:st|nd|rd|th)\s+season|part\s*\d+|s\d+)$/i,
      "",
    )
    .trim();
  if (strippedTrailingSeason && strippedTrailingSeason !== baseTitle) {
    candidates.push(strippedTrailingSeason);
  }

  return [...new Set(candidates.filter(Boolean))];
}

/**
 * Extracts a valid episode number from numeric or title strings (e.g. "Episode 12").
 */
export function parseEpisodeNumber(
  numberValue?: number | string | null,
  title?: string,
): number | null {
  if (
    typeof numberValue === "number" &&
    Number.isFinite(numberValue) &&
    numberValue > 0
  ) {
    return numberValue;
  }
  if (typeof numberValue === "string") {
    const parsed = parseFloat(numberValue);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  if (title) {
    const match = title.match(
      /(?:episode|ep\.?|e|الحلقة|حلقة)?\s*(\d+(?:\.\d+)?)/i,
    );
    if (match) {
      const parsed = parseFloat(match[1]);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
  }
  return null;
}

/**
 * Shared evaluation for OP/ED floating buttons across Desktop and Mobile players.
 */
export function evaluateSkipUIState(params: {
  skipTimes: EpisodeSkipTimes | null;
  currentTime: number;
  duration: number;
  hasNextEpisode: boolean;
  outroDismissed: boolean;
  fallbackOutroSeconds?: number;
  minDurationForFallback?: number;
}): {
  isInIntro: boolean;
  isExactOutro: boolean;
  isFallbackOutro: boolean;
  showNextEpisode: boolean;
} {
  const {
    skipTimes,
    currentTime,
    duration,
    hasNextEpisode,
    outroDismissed,
    fallbackOutroSeconds = 95,
    minDurationForFallback = 600,
  } = params;

  const op = skipTimes?.op;
  const ed = skipTimes?.ed;

  const isInIntro = Boolean(
    op && currentTime >= op.startTime && currentTime < op.endTime,
  );

  const isExactOutro = Boolean(
    hasNextEpisode &&
    !outroDismissed &&
    ed &&
    currentTime >= ed.startTime &&
    (duration <= 0 || ed.startTime < duration),
  );

  const isFallbackOutro = Boolean(
    hasNextEpisode &&
    !outroDismissed &&
    !ed &&
    duration >= minDurationForFallback &&
    currentTime > 0 &&
    duration - currentTime <= fallbackOutroSeconds &&
    duration - currentTime > 0,
  );

  return {
    isInIntro,
    isExactOutro,
    isFallbackOutro,
    showNextEpisode: isExactOutro || isFallbackOutro,
  };
}

export class SkipTimesService {
  private malIdByAnilistCache = new Map<number, number | null>();
  private malIdByTitleCache = new Map<string, number | null>();
  private skipTimesCache = new Map<string, EpisodeSkipTimes | null>();
  private inFlightRequests = new Map<
    string,
    Promise<EpisodeSkipTimes | null>
  >();

  constructor(
    private readonly fetchFn: typeof fetch = globalThis.fetch.bind(globalThis),
    private readonly timeoutMs: number = DEFAULT_REQUEST_TIMEOUT_MS,
  ) {}

  clearCache(): void {
    this.malIdByAnilistCache.clear();
    this.malIdByTitleCache.clear();
    this.skipTimesCache.clear();
    this.inFlightRequests.clear();
  }

  private async fetchJsonWithTimeout<T>(
    url: string,
    init?: RequestInit,
  ): Promise<T | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchFn(url, {
        ...init,
        signal: controller.signal,
      });
      if (!response.ok) return null;
      return (await response.json()) as T;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  async resolveMalIdFromAniList(anilistId: number): Promise<number | null> {
    if (!Number.isFinite(anilistId) || anilistId <= 0) return null;
    if (this.malIdByAnilistCache.has(anilistId)) {
      return this.malIdByAnilistCache.get(anilistId) ?? null;
    }

    const query = `
      query ($mediaId: Int) {
        Media(id: $mediaId, type: ANIME) {
          id
          idMal
        }
      }
    `;
    const json = await this.fetchJsonWithTimeout<{
      data?: { Media?: { idMal?: number | null } };
    }>(ANILIST_GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query, variables: { mediaId: anilistId } }),
    });

    const idMal = json?.data?.Media?.idMal;
    const resolved = typeof idMal === "number" && idMal > 0 ? idMal : null;
    this.malIdByAnilistCache.set(anilistId, resolved);
    return resolved;
  }

  async resolveMalIdByTitle(title: string): Promise<number | null> {
    const candidates = buildAnimeTitleCandidates(title);
    for (const candidate of candidates) {
      const resolved = await this.lookupMalIdSingleTitle(candidate);
      if (resolved) return resolved;
    }
    return null;
  }

  private async lookupMalIdSingleTitle(
    cleanedTitle: string,
  ): Promise<number | null> {
    if (!cleanedTitle) return null;
    const cacheKey = cleanedTitle.toLowerCase();
    if (this.malIdByTitleCache.has(cacheKey)) {
      return this.malIdByTitleCache.get(cacheKey) ?? null;
    }

    const query = `
      query ($search: String) {
        Page(page: 1, perPage: 3) {
          media(search: $search, type: ANIME) {
            id
            idMal
            title {
              romaji
              english
              native
            }
          }
        }
      }
    `;
    const json = await this.fetchJsonWithTimeout<{
      data?: {
        Page?: {
          media?: Array<{
            id?: number;
            idMal?: number | null;
            title?: { romaji?: string };
          }>;
        };
      };
    }>(ANILIST_GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query, variables: { search: cleanedTitle } }),
    });

    const candidates = json?.data?.Page?.media || [];
    const match = candidates.find(
      (m) => typeof m?.idMal === "number" && m.idMal > 0,
    );
    const resolved = match?.idMal ?? null;
    this.malIdByTitleCache.set(cacheKey, resolved);
    return resolved;
  }

  private pickBestInterval(
    results: AniSkipRawResult[],
    primaryType: string,
    fallbackType: string,
    episodeLength: number,
  ): SkipInterval | undefined {
    const pickFrom = (skipType: string): SkipInterval | undefined => {
      const matching = results.filter(
        (r) =>
          r.skipType === skipType &&
          typeof r.interval?.startTime === "number" &&
          typeof r.interval?.endTime === "number" &&
          r.interval.startTime >= 0 &&
          r.interval.endTime > r.interval.startTime &&
          (episodeLength <= 0 || r.interval.startTime < episodeLength),
      );
      if (matching.length === 0) return undefined;
      if (episodeLength > 0 && matching.length > 1) {
        matching.sort(
          (a, b) =>
            Math.abs((a.episodeLength || episodeLength) - episodeLength) -
            Math.abs((b.episodeLength || episodeLength) - episodeLength),
        );
      }
      const chosen = matching[0].interval!;
      return {
        startTime: chosen.startTime!,
        endTime: chosen.endTime!,
      };
    };

    return pickFrom(primaryType) || pickFrom(fallbackType);
  }

  private async fetchAniSkipForMalId(
    malId: number,
    epParam: number,
    lengthParam: number,
  ): Promise<EpisodeSkipTimes | null> {
    const cacheKey = `${malId}:${epParam}:${lengthParam}`;
    if (this.skipTimesCache.has(cacheKey)) {
      return this.skipTimesCache.get(cacheKey) ?? null;
    }

    const existingPromise = this.inFlightRequests.get(cacheKey);
    if (existingPromise) return existingPromise;

    const requestPromise = (async (): Promise<EpisodeSkipTimes | null> => {
      try {
        const url = `${ANISKIP_API_BASE}/${malId}/${epParam}?types=op&types=ed&types=mixed-op&types=mixed-ed&episodeLength=${lengthParam}`;
        const data = await this.fetchJsonWithTimeout<AniSkipApiResponse>(url);
        if (
          !data?.found ||
          !Array.isArray(data.results) ||
          data.results.length === 0
        ) {
          this.skipTimesCache.set(cacheKey, null);
          return null;
        }

        const op = this.pickBestInterval(
          data.results,
          "op",
          "mixed-op",
          lengthParam,
        );
        const ed = this.pickBestInterval(
          data.results,
          "ed",
          "mixed-ed",
          lengthParam,
        );

        if (!op && !ed) {
          this.skipTimesCache.set(cacheKey, null);
          return null;
        }

        const result: EpisodeSkipTimes = {
          ...(op ? { op } : {}),
          ...(ed ? { ed } : {}),
          malId,
        };
        this.skipTimesCache.set(cacheKey, result);
        return result;
      } catch {
        return null;
      } finally {
        this.inFlightRequests.delete(cacheKey);
      }
    })();

    this.inFlightRequests.set(cacheKey, requestPromise);
    return requestPromise;
  }

  async getSkipTimes(query: SkipTimesQuery): Promise<EpisodeSkipTimes | null> {
    if (!Number.isFinite(query.episodeNumber) || query.episodeNumber <= 0) {
      return null;
    }

    const epParam = Math.floor(query.episodeNumber);
    const lengthParam =
      query.episodeLength &&
      Number.isFinite(query.episodeLength) &&
      query.episodeLength > 0
        ? Math.floor(query.episodeLength)
        : 0;

    // 1. Explicit MAL ID or linked AniList ID
    let resolvedMalId =
      typeof query.malId === "number" && query.malId > 0
        ? Math.floor(query.malId)
        : null;

    if (
      !resolvedMalId &&
      typeof query.anilistId === "number" &&
      query.anilistId > 0
    ) {
      if (query.resolveAniListMedia) {
        try {
          const media = await query.resolveAniListMedia(query.anilistId);
          if (media?.idMal && media.idMal > 0) {
            resolvedMalId = media.idMal;
            this.malIdByAnilistCache.set(query.anilistId, resolvedMalId);
          }
        } catch {
          // Fall back cleanly to public AniList lookup
        }
      }
      if (!resolvedMalId) {
        resolvedMalId = await this.resolveMalIdFromAniList(query.anilistId);
      }
    }

    if (resolvedMalId) {
      const hit = await this.fetchAniSkipForMalId(
        resolvedMalId,
        epParam,
        lengthParam,
      );
      if (hit) return hit;
    }

    // 2. Title candidates fallback (tries season-specific first, then base anime title)
    if (query.title) {
      const titleCandidates = buildAnimeTitleCandidates(query.title);
      const triedMalIds = new Set<number>(resolvedMalId ? [resolvedMalId] : []);
      for (const candidate of titleCandidates) {
        const malId = await this.lookupMalIdSingleTitle(candidate);
        if (!malId || triedMalIds.has(malId)) continue;
        triedMalIds.add(malId);
        const hit = await this.fetchAniSkipForMalId(
          malId,
          epParam,
          lengthParam,
        );
        if (hit) return hit;
      }
    }

    return null;
  }
}

export const skipTimesService = new SkipTimesService();
