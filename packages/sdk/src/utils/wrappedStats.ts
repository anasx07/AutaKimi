export interface NormalizedHistoryItem {
  mangaId: string;
  mangaTitle: string;
  mangaCover?: string;
  chapterId: string;
  startedAt: string;
  startedAtMs: number;
  durationSeconds: number;
  mediaType: "manga" | "anime";
}

export interface DailyWrappedStat {
  dateKey: string;
  label: string;
  totalSeconds: number;
  animeSeconds: number;
  mangaSeconds: number;
  sessions: number;
}

export interface GenreWrappedStat {
  genre: string;
  durationSeconds: number;
  sessions: number;
  titlesCount: number;
  percentage: number;
}

export interface TitleWrappedStat {
  mangaId: string;
  title: string;
  coverUrl?: string;
  mediaType: "manga" | "anime";
  durationSeconds: number;
  sessions: number;
}

export type ReaderTimePersona =
  | "Night Owl"
  | "Early Bird"
  | "Daytime Reader"
  | "Evening Binger"
  | "Getting Started";

export interface WrappedStatsSummary {
  hasData: boolean;
  weeklyTotalSeconds: number;
  weeklyAnimeSeconds: number;
  weeklyMangaSeconds: number;
  weeklySessions: number;
  allTimeTotalSeconds: number;
  allTimeAnimeSeconds: number;
  allTimeMangaSeconds: number;
  allTimeSessions: number;
  uniqueTitlesCount: number;
  currentStreakDays: number;
  longestStreakDays: number;
  totalActiveDays: number;
  dailyActivity: DailyWrappedStat[];
  topGenres: GenreWrappedStat[];
  topTitles: TitleWrappedStat[];
  persona: ReaderTimePersona;
}

const SHORT_WEEKDAYS = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
] as const;

export function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addLocalDays(date: Date, deltaDays: number): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + deltaDays,
  );
}

/**
 * Normalizes a history record from either Drizzle camelCase (Desktop)
 * or raw SQLite snake_case rows (Mobile) into a consistent shape.
 */
export function normalizeHistoryRecord(raw: any): NormalizedHistoryItem | null {
  if (!raw || typeof raw !== "object") return null;

  const mangaId = String(raw.mangaId ?? raw.manga_id ?? "").trim();
  const chapterId = String(raw.chapterId ?? raw.chapter_id ?? "").trim();
  const startedAt = String(raw.startedAt ?? raw.started_at ?? "").trim();
  if (!mangaId || !startedAt) return null;

  const parsedMs = Date.parse(startedAt);
  if (Number.isNaN(parsedMs)) return null;

  const rawDuration = Number(raw.durationSeconds ?? raw.duration_seconds ?? 0);
  const durationSeconds =
    Number.isFinite(rawDuration) && rawDuration > 0
      ? Math.round(rawDuration)
      : 0;

  const rawType = raw.mediaType ?? raw.type;
  const mediaType: "manga" | "anime" = rawType === "anime" ? "anime" : "manga";
  const mangaTitle =
    String(raw.mangaTitle ?? raw.manga_title ?? "").trim() || mangaId;
  const mangaCover =
    String(raw.mangaCover ?? raw.manga_cover ?? "").trim() || undefined;

  return {
    mangaId,
    mangaTitle,
    ...(mangaCover ? { mangaCover } : {}),
    chapterId: chapterId || `${mangaId}:${startedAt}`,
    startedAt,
    startedAtMs: parsedMs,
    durationSeconds,
    mediaType,
  };
}

export function formatWrappedDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return "0m";
  const rounded = Math.round(totalSeconds);
  const hours = Math.floor(rounded / 3600);
  const mins = Math.floor((rounded % 3600) / 60);
  if (hours > 0) {
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  if (mins > 0) return `${mins}m`;
  return "<1m";
}

export function formatWrappedHours(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return "0.0h";
  const hours = totalSeconds / 3600;
  return hours >= 10 ? `${Math.round(hours)}h` : `${hours.toFixed(1)}h`;
}

function parseGenresList(rawGenres: unknown): string[] {
  if (Array.isArray(rawGenres)) {
    return rawGenres
      .map((g) => String(g || "").trim())
      .filter((g) => g.length > 0);
  }
  if (typeof rawGenres === "string" && rawGenres.trim().startsWith("[")) {
    try {
      const parsed = JSON.parse(rawGenres);
      if (Array.isArray(parsed)) {
        return parsed
          .map((g) => String(g || "").trim())
          .filter((g) => g.length > 0);
      }
    } catch {
      return [];
    }
  }
  return [];
}

function computeStreaks(
  activeDateKeys: ReadonlySet<string>,
  now: Date,
): { currentStreakDays: number; longestStreakDays: number } {
  if (activeDateKeys.size === 0) {
    return { currentStreakDays: 0, longestStreakDays: 0 };
  }

  // Current streak: starts from today if active today, else from yesterday (grace before today's session)
  const todayKey = toLocalDateKey(now);
  const yesterdayKey = toLocalDateKey(addLocalDays(now, -1));
  let currentStreakDays = 0;

  if (activeDateKeys.has(todayKey) || activeDateKeys.has(yesterdayKey)) {
    let cursor = activeDateKeys.has(todayKey)
      ? addLocalDays(now, 0)
      : addLocalDays(now, -1);
    while (activeDateKeys.has(toLocalDateKey(cursor))) {
      currentStreakDays += 1;
      cursor = addLocalDays(cursor, -1);
    }
  }

  // Longest streak across all recorded local date keys
  const sortedEpochDays = Array.from(activeDateKeys)
    .map((key) => {
      const [y, m, d] = key.split("-").map(Number);
      return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
    })
    .sort((a, b) => a - b);

  let longestStreakDays = 0;
  let run = 0;
  let prevDay: number | null = null;
  for (const dayNum of sortedEpochDays) {
    if (prevDay !== null && dayNum === prevDay + 1) {
      run += 1;
    } else {
      run = 1;
    }
    if (run > longestStreakDays) longestStreakDays = run;
    prevDay = dayNum;
  }

  return { currentStreakDays, longestStreakDays };
}

function resolveTimePersona(
  items: readonly NormalizedHistoryItem[],
): ReaderTimePersona {
  if (items.length === 0) return "Getting Started";
  const buckets = { night: 0, morning: 0, day: 0, evening: 0 };
  for (const item of items) {
    const hour = new Date(item.startedAtMs).getHours();
    const weight = item.durationSeconds > 0 ? item.durationSeconds : 60;
    if (hour < 6) buckets.night += weight;
    else if (hour < 12) buckets.morning += weight;
    else if (hour < 18) buckets.day += weight;
    else buckets.evening += weight;
  }

  const best = (
    Object.entries(buckets) as Array<[keyof typeof buckets, number]>
  ).sort((a, b) => b[1] - a[1])[0]?.[0];

  switch (best) {
    case "night":
      return "Night Owl";
    case "morning":
      return "Early Bird";
    case "day":
      return "Daytime Reader";
    case "evening":
    default:
      return "Evening Binger";
  }
}

export interface ComputeWrappedStatsInput {
  historyEntries: readonly any[];
  genresByMangaId?: Readonly<Record<string, unknown>>;
  now?: Date;
}

/**
 * Aggregates local reading & watching history into weekly time, reading streak,
 * top genres, top titles, and reading persona metrics — 100% locally.
 */
export function computeWrappedStats(
  input: ComputeWrappedStatsInput,
): WrappedStatsSummary {
  const now = input.now ?? new Date();
  const genresMap = input.genresByMangaId ?? {};

  const items: NormalizedHistoryItem[] = [];
  for (const raw of input.historyEntries) {
    const normalized = normalizeHistoryRecord(raw);
    if (normalized) items.push(normalized);
  }

  // Prepare last 7 calendar days ending today [now - 6 days .. now]
  const dailyActivity: DailyWrappedStat[] = [];
  const dailyMap = new Map<string, DailyWrappedStat>();
  for (let offset = -6; offset <= 0; offset++) {
    const d = addLocalDays(now, offset);
    const key = toLocalDateKey(d);
    const stat: DailyWrappedStat = {
      dateKey: key,
      label: SHORT_WEEKDAYS[d.getDay()],
      totalSeconds: 0,
      animeSeconds: 0,
      mangaSeconds: 0,
      sessions: 0,
    };
    dailyActivity.push(stat);
    dailyMap.set(key, stat);
  }

  const activeDateKeys = new Set<string>();
  const titleMap = new Map<string, TitleWrappedStat>();
  const genreAgg = new Map<
    string,
    {
      durationSeconds: number;
      sessions: number;
      weight: number;
      titles: Set<string>;
    }
  >();

  let allTimeTotalSeconds = 0;
  let allTimeAnimeSeconds = 0;
  let allTimeMangaSeconds = 0;
  let weeklyTotalSeconds = 0;
  let weeklyAnimeSeconds = 0;
  let weeklyMangaSeconds = 0;
  let weeklySessions = 0;

  for (const item of items) {
    const localDate = new Date(item.startedAtMs);
    const dateKey = toLocalDateKey(localDate);
    activeDateKeys.add(dateKey);

    allTimeTotalSeconds += item.durationSeconds;
    if (item.mediaType === "anime") allTimeAnimeSeconds += item.durationSeconds;
    else allTimeMangaSeconds += item.durationSeconds;

    const dayStat = dailyMap.get(dateKey);
    if (dayStat) {
      weeklyTotalSeconds += item.durationSeconds;
      weeklySessions += 1;
      dayStat.totalSeconds += item.durationSeconds;
      dayStat.sessions += 1;
      if (item.mediaType === "anime") {
        weeklyAnimeSeconds += item.durationSeconds;
        dayStat.animeSeconds += item.durationSeconds;
      } else {
        weeklyMangaSeconds += item.durationSeconds;
        dayStat.mangaSeconds += item.durationSeconds;
      }
    }

    const existingTitle = titleMap.get(item.mangaId);
    if (existingTitle) {
      existingTitle.durationSeconds += item.durationSeconds;
      existingTitle.sessions += 1;
      if (!existingTitle.coverUrl && item.mangaCover) {
        existingTitle.coverUrl = item.mangaCover;
      }
    } else {
      titleMap.set(item.mangaId, {
        mangaId: item.mangaId,
        title: item.mangaTitle,
        ...(item.mangaCover ? { coverUrl: item.mangaCover } : {}),
        mediaType: item.mediaType,
        durationSeconds: item.durationSeconds,
        sessions: 1,
      });
    }

    const genres = parseGenresList(genresMap[item.mangaId]);
    const sessionWeight = item.durationSeconds > 0 ? item.durationSeconds : 60;
    for (const genre of genres) {
      const existingGenre = genreAgg.get(genre);
      if (existingGenre) {
        existingGenre.durationSeconds += item.durationSeconds;
        existingGenre.sessions += 1;
        existingGenre.weight += sessionWeight;
        existingGenre.titles.add(item.mangaId);
      } else {
        genreAgg.set(genre, {
          durationSeconds: item.durationSeconds,
          sessions: 1,
          weight: sessionWeight,
          titles: new Set([item.mangaId]),
        });
      }
    }
  }

  const { currentStreakDays, longestStreakDays } = computeStreaks(
    activeDateKeys,
    now,
  );

  const sortedGenres = Array.from(genreAgg.entries())
    .sort((a, b) => b[1].weight - a[1].weight || b[1].sessions - a[1].sessions)
    .slice(0, 6);

  const totalTopWeight = sortedGenres.reduce((acc, [, v]) => acc + v.weight, 0);
  const topGenres: GenreWrappedStat[] = sortedGenres.map(([genre, stat]) => ({
    genre,
    durationSeconds: stat.durationSeconds,
    sessions: stat.sessions,
    titlesCount: stat.titles.size,
    percentage:
      totalTopWeight > 0 ? Math.round((stat.weight / totalTopWeight) * 100) : 0,
  }));

  const topTitles = Array.from(titleMap.values())
    .sort(
      (a, b) =>
        b.durationSeconds - a.durationSeconds || b.sessions - a.sessions,
    )
    .slice(0, 5);

  return {
    hasData: items.length > 0,
    weeklyTotalSeconds,
    weeklyAnimeSeconds,
    weeklyMangaSeconds,
    weeklySessions,
    allTimeTotalSeconds,
    allTimeAnimeSeconds,
    allTimeMangaSeconds,
    allTimeSessions: items.length,
    uniqueTitlesCount: titleMap.size,
    currentStreakDays,
    longestStreakDays,
    totalActiveDays: activeDateKeys.size,
    dailyActivity,
    topGenres,
    topTitles,
    persona: resolveTimePersona(items),
  };
}
