export interface DiscordPresenceMediaInput {
  kind: "anime" | "manga" | "idle";
  title?: string | null;
  chapterOrEpisode?: number | string | null;
  chapterTitle?: string | null;
  coverUrl?: string | null;
  page?: number;
  totalPages?: number;
  currentTimeSeconds?: number;
  durationSeconds?: number;
  isPaused?: boolean;
}

export interface DiscordRichPresenceActivity {
  type?: 0 | 2 | 3 | 5;
  details: string;
  state?: string;
  timestamps?: {
    start?: number;
    end?: number;
  };
  assets?: {
    large_image?: string;
    large_text?: string;
  };
  buttons?: Array<{ label: string; url: string }>;
}

export interface DiscordRpcStatus {
  enabled: boolean;
  connected: boolean;
  hasClientId: boolean;
  clientId: string;
  lastError: string | null;
  activeDetails: string | null;
}

export const DISCORD_MAX_TEXT_LENGTH = 128;
export const AUTAKIMI_HOMEPAGE_URL = "https://anasx07.github.io/AutaKimi/";

export function sanitizeDiscordText(
  text: string,
  maxLength = DISCORD_MAX_TEXT_LENGTH,
): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

export function formatDiscordDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "00:00";
  const rounded = Math.floor(totalSeconds);
  const hrs = Math.floor(rounded / 3600);
  const mins = Math.floor((rounded % 3600) / 60);
  const secs = rounded % 60;
  const mm = String(mins).padStart(2, "0");
  const ss = String(secs).padStart(2, "0");
  if (hrs > 0) {
    return `${hrs}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

function normalizeHttpCoverUrl(rawUrl?: string | null): string | undefined {
  const trimmed = rawUrl?.trim();
  if (!trimmed) return undefined;
  const normalized = trimmed.startsWith("//") ? `https:${trimmed}` : trimmed;
  if (normalized.startsWith("https://") || normalized.startsWith("http://")) {
    return normalized;
  }
  return undefined;
}

function formatUnitNumber(value?: number | string | null): string | null {
  if (value === undefined || value === null) return null;
  const str = String(value).trim();
  if (!str) return null;
  return str;
}

/**
 * Formats an anime/manga playback or reading state into a Discord Rich Presence activity payload.
 * Returns `null` when `kind === 'idle'` to clear the user's Discord status.
 */
export function buildDiscordActivity(
  input: DiscordPresenceMediaInput,
  nowMs = Date.now(),
): DiscordRichPresenceActivity | null {
  if (input.kind === "idle") {
    return null;
  }

  const title = input.title?.trim() || "AutaKimi";
  const unitNum = formatUnitNumber(input.chapterOrEpisode);
  const coverImage = normalizeHttpCoverUrl(input.coverUrl);

  const assets: DiscordRichPresenceActivity["assets"] | undefined = coverImage
    ? {
        large_image: coverImage,
        large_text: sanitizeDiscordText(title),
      }
    : undefined;

  const buttons = [{ label: "AutaKimi", url: AUTAKIMI_HOMEPAGE_URL }];

  if (input.kind === "anime") {
    const epLabel = unitNum ? `Ep ${unitNum}` : null;
    const details = sanitizeDiscordText(
      epLabel ? `Watching ${title} • ${epLabel}` : `Watching ${title}`,
    );

    const currentSec =
      typeof input.currentTimeSeconds === "number" &&
      input.currentTimeSeconds >= 0
        ? input.currentTimeSeconds
        : 0;
    const durationSec =
      typeof input.durationSeconds === "number" && input.durationSeconds > 0
        ? input.durationSeconds
        : 0;

    const timeLabel =
      durationSec > 0
        ? `${formatDiscordDuration(currentSec)} / ${formatDiscordDuration(durationSec)}`
        : null;

    let state = "Watching Anime";
    if (input.isPaused) {
      state = timeLabel ? `Paused • ${timeLabel}` : "Paused";
    } else if (timeLabel) {
      state = `AutaKimi • ${timeLabel}`;
    } else if (input.chapterTitle?.trim()) {
      state = sanitizeDiscordText(input.chapterTitle);
    }

    let timestamps: DiscordRichPresenceActivity["timestamps"] | undefined;
    if (!input.isPaused && durationSec > 0) {
      const startSec = Math.floor((nowMs - currentSec * 1000) / 1000);
      timestamps = {
        start: startSec,
        end: startSec + Math.floor(durationSec),
      };
    }

    return {
      type: 3, // Watching
      details,
      state: sanitizeDiscordText(state),
      ...(timestamps ? { timestamps } : {}),
      ...(assets ? { assets } : {}),
      buttons,
    };
  }

  // Manga / Webtoon reading presence
  const chLabel = unitNum ? `Ch ${unitNum}` : null;
  const details = sanitizeDiscordText(
    chLabel ? `Reading ${title} • ${chLabel}` : `Reading ${title}`,
  );

  let state = "Reading Manga";
  if (
    typeof input.page === "number" &&
    typeof input.totalPages === "number" &&
    input.page > 0 &&
    input.totalPages > 0
  ) {
    state = `Page ${Math.floor(input.page)} / ${Math.floor(input.totalPages)}`;
  } else if (input.chapterTitle?.trim()) {
    state = sanitizeDiscordText(input.chapterTitle);
  }

  return {
    type: 0,
    details,
    state: sanitizeDiscordText(state),
    timestamps: {
      start: Math.floor(nowMs / 1000),
    },
    ...(assets ? { assets } : {}),
    buttons,
  };
}
