export interface RepoVisualMeta {
  repoUrl: string;
  repoKey: string;
  repoName: string;
  repoColor: string;
  repoHash: string;
  isLocal: boolean;
  isKeiyoushi: boolean;
}

const CUSTOM_REPO_PALETTE = [
  "#3b82f6", // Blue
  "#ec4899", // Pink
  "#06b6d4", // Cyan
  "#f97316", // Orange
  "#84cc16", // Lime
  "#6366f1", // Indigo
];

/**
 * Normalizes a repository URL into a stable key for cross-comparing repo ownership.
 * Strips manifest/index filenames and trailing slashes so equivalents match.
 */
export function normalizeRepoKey(repoUrl?: string | null): string {
  const raw = (repoUrl || "").trim();
  if (!raw || raw === "local" || raw === "remote") return "";

  let key = raw
    .replace(/\/?(manifest\.json|index\.min\.json|index\.json|index\.pb)$/i, "")
    .replace(/\/+$/, "");

  try {
    const parsed = new URL(key);
    key =
      `${parsed.protocol.toLowerCase()}//${parsed.host.toLowerCase()}${parsed.pathname}`.replace(
        /\/+$/,
        "",
      );
  } catch {
    key = key.toLowerCase();
  }

  return key;
}

/**
 * Returns a deterministic short 6-char hex hash for a repository URL.
 */
export function shortRepoHash(repoUrl?: string | null): string {
  const key = normalizeRepoKey(repoUrl) || (repoUrl || "").trim().toLowerCase();
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0").slice(0, 6);
}

/**
 * Computes consistent visual metadata (name, accent color, hash) for any repository URL.
 * Used identically across Repositories cards and Extension cards.
 */
export function getRepoMeta(
  repoUrl?: string | null,
  explicitName?: string | null,
): RepoVisualMeta {
  const raw = (repoUrl || "").trim();
  const lower = raw.toLowerCase();
  const repoKey = normalizeRepoKey(raw);
  const repoHash = shortRepoHash(raw);

  const isLocal =
    raw.startsWith("autakimi-local://") ||
    raw.startsWith("file://") ||
    (!!raw &&
      raw !== "remote" &&
      !raw.startsWith("http://") &&
      !raw.startsWith("https://"));

  const isKeiyoushi =
    lower.includes("keiyoushi") ||
    lower.endsWith("index.min.json") ||
    lower.endsWith("index.json") ||
    lower.endsWith("index.pb");

  if (isLocal) {
    return {
      repoUrl: raw,
      repoKey,
      repoName: explicitName?.trim() || "Local Dev",
      repoColor: "#f59e0b",
      repoHash,
      isLocal: true,
      isKeiyoushi: false,
    };
  }

  if (isKeiyoushi) {
    return {
      repoUrl: raw,
      repoKey,
      repoName: explicitName?.trim() || "Keiyoushi",
      repoColor: "#a855f7",
      repoHash,
      isLocal: false,
      isKeiyoushi: true,
    };
  }

  if (lower.includes("autakimi")) {
    return {
      repoUrl: raw,
      repoKey,
      repoName: explicitName?.trim() || "AutaKimi",
      repoColor: "#10b981",
      repoHash,
      isLocal: false,
      isKeiyoushi: false,
    };
  }

  let fallbackName = explicitName?.trim() || "";
  if (!fallbackName && raw) {
    try {
      const parsed = new URL(raw);
      if (
        parsed.hostname === "raw.githubusercontent.com" ||
        parsed.hostname === "github.com"
      ) {
        const parts = parsed.pathname.split("/").filter(Boolean);
        fallbackName =
          parts.length >= 2 ? `${parts[0]}/${parts[1]}` : parsed.hostname;
      } else {
        fallbackName = parsed.hostname;
      }
    } catch {
      fallbackName = raw;
    }
  }

  let paletteIdx = 0;
  if (repoHash) {
    paletteIdx = parseInt(repoHash, 16) % CUSTOM_REPO_PALETTE.length;
  }

  return {
    repoUrl: raw,
    repoKey,
    repoName: fallbackName || "Custom Repo",
    repoColor: CUSTOM_REPO_PALETTE[paletteIdx],
    repoHash,
    isLocal: false,
    isKeiyoushi: false,
  };
}

/**
 * Extracts the un-scoped package identifier from an optionally repo-scoped `pkg::hash` key.
 */
export function extractBasePkg(pkg?: string | null): string {
  const raw = (pkg || "").trim();
  const sep = raw.indexOf("::");
  return sep === -1 ? raw : raw.slice(0, sep);
}

/**
 * Builds a collision-free scoped package identifier when installing the same `pkg` from a second repo.
 */
export function buildScopedPkg(basePkg: string, repoUrl: string): string {
  return `${extractBasePkg(basePkg)}::${shortRepoHash(repoUrl)}`;
}

/**
 * Builds a unique catalog map key combining repository identity and extension package id.
 */
export function buildCatalogKey(pkg: string, repoUrl?: string | null): string {
  const repoKey = normalizeRepoKey(repoUrl) || "default";
  return `${repoKey}::${extractBasePkg(pkg)}`;
}

export interface ExtensionBadgeInfo {
  name: string;
  color?: string;
}

function formatFallbackPkgName(pkg: string): string {
  const clean = extractBasePkg(pkg)
    .replace(/^ma\.autakimi\.extension\./i, "")
    .replace(/^eu\.kanade\.tachiyomi\.extension\./i, "")
    .replace(
      /^(all|ar|bg|ca|cs|de|en|es|fr|hi|id|it|ja|ko|nl|pl|pt|pt-br|ru|th|tr|uk|vi|zh)\./i,
      "",
    );

  const lastSeg = clean.split(".").filter(Boolean).pop() || clean;
  const words = lastSeg.split(/[-_]+/).filter(Boolean);
  if (words.length === 0) return pkg;
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

/**
 * Resolves a human-friendly extension display name and optional repo accent color from `pkg`.
 * Matches against installed extensions first (preserving scoped `pkg::hash` or base `pkg`),
 * falling back to a readable name derived from `pkg` when uninstalled.
 */
export function resolveExtensionBadge(
  pkg?: string | null,
  installedExtensions?: Array<{
    pkg?: string;
    name?: string;
    repoUrl?: string;
    repoName?: string;
    repoColor?: string;
  }>,
): ExtensionBadgeInfo | null {
  const raw = (pkg || "").trim();
  if (!raw) return null;

  const base = extractBasePkg(raw);
  const list = Array.isArray(installedExtensions) ? installedExtensions : [];
  const match =
    list.find((e) => e?.pkg === raw) ||
    list.find((e) => e?.pkg && extractBasePkg(e.pkg) === base);

  if (match) {
    const hasRealRepo =
      !!match.repoUrl &&
      match.repoUrl !== "remote" &&
      match.repoUrl !== "local";
    const color =
      match.repoColor ||
      (hasRealRepo
        ? getRepoMeta(match.repoUrl, match.repoName).repoColor
        : undefined);
    return {
      name: match.name?.trim() || formatFallbackPkgName(raw),
      color,
    };
  }

  return {
    name: formatFallbackPkgName(raw),
    color: undefined,
  };
}
