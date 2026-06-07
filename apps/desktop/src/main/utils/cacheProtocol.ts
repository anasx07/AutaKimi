import net from 'net'
import path from 'path'

/**
 * URL validation and safety helpers for the privileged `autakimi-cache://`
 * protocol handler. Because the protocol is registered with
 * `bypassCSP: true, secure: true, supportFetchAPI: true`, any path under it
 * can be requested by the renderer — so a malicious extension's UI, a
 * compromised renderer, or a malicious remote page could otherwise pivot
 * it into an SSRF or local-file-read proxy. Every request is therefore
 * funneled through these checks before any network or filesystem I/O.
 */

const ALLOWED_IMAGE_CONTENT_TYPES = new Set<string>([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/svg+xml',
  'image/x-icon',
  'image/vnd.microsoft.icon',
  'image/bmp',
  'image/heic',
  'image/heif'
])

const MAX_GENERIC_CACHE_BYTES = 25 * 1024 * 1024
const ICON_REMOTE_BYTE_LIMIT = 5 * 1024 * 1024

export type UrlValidationResult =
  | { ok: true; url: URL; origin: string }
  | { ok: false; status: number; reason: string }

export interface OriginAllowlist {
  has(origin: string): boolean
  size: number
}

function normalizeOrigin(u: URL): string {
  const isDefaultPort =
    (u.protocol === 'https:' && (u.port === '' || u.port === '443')) ||
    (u.protocol === 'http:' && (u.port === '' || u.port === '80'))
  const host = isDefaultPort ? u.hostname : u.host
  return `${u.protocol}//${host}`.toLowerCase()
}

export function buildOriginAllowlist(repos: unknown): OriginAllowlist {
  const origins = new Set<string>()
  if (Array.isArray(repos)) {
    for (const repo of repos) {
      if (typeof repo !== 'string') continue
      let url = repo
      if (url.endsWith('templates.json')) {
        url = url.replace(/templates\.json$/, '')
      }
      try {
        const u = new URL(url)
        if (u.protocol === 'https:' || u.protocol === 'http:') {
          origins.add(normalizeOrigin(u))
        }
      } catch {
        // Ignore invalid repo URLs
      }
    }
  }
  let size = origins.size
  return {
    has: (origin: string) => origins.has(origin.toLowerCase()),
    get size() {
      return size
    }
  }
}

export function isPrivateOrLoopbackHost(hostname: string): boolean {
  if (!hostname) return true
  const lc = hostname.toLowerCase()

  if (lc === 'localhost' || lc === 'ip6-localhost' || lc === 'ip6-loopback') return true

  if (net.isIP(lc)) {
    if (net.isIPv4(lc)) {
      const parts = lc.split('.').map(Number)
      if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true
      if (parts[0] === 0) return true
      if (parts[0] === 10) return true
      if (parts[0] === 127) return true
      if (parts[0] === 169 && parts[1] === 254) return true
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true
      if (parts[0] === 192 && parts[1] === 168) return true
      if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true
      if (parts[0] === 198 && (parts[1] === 18 || parts[1] === 19)) return true
      if (parts[0] === 255) return true
      return false
    }
    if (lc === '::' || lc === '::1') return true
    if (lc.length >= 2 && lc[0] === 'f' && (lc[1] === 'c' || lc[1] === 'd')) return true
    if (lc.length >= 4) {
      const prefix4 = lc.slice(0, 4)
      if (prefix4 >= 'fe80' && prefix4 <= 'febf') return true
    }
    if (lc.startsWith('::ffff:')) {
      return isPrivateOrLoopbackHost(lc.slice(7))
    }
    return false
  }

  if (
    lc.endsWith('.local') ||
    lc.endsWith('.internal') ||
    lc.endsWith('.lan') ||
    lc.endsWith('.localhost')
  ) {
    return true
  }
  return false
}

export function isPathSafe(pathname: string): boolean {
  if (!pathname) return true
  for (const seg of pathname.split('/')) {
    if (seg === '..') return false
  }
  if (pathname.includes('\\')) return false
  if (pathname.includes('\0')) return false
  return true
}

function baseValidate(rawUrl: string): { ok: true; url: URL } | { ok: false; status: number; reason: string } {
  const httpsUrl = rawUrl.replace(/^autakimi-cache:\/\//i, 'https://')
  let parsed: URL
  try {
    parsed = new URL(httpsUrl)
  } catch {
    return { ok: false, status: 400, reason: 'Invalid URL' }
  }
  if (parsed.protocol !== 'https:') {
    return { ok: false, status: 400, reason: 'Only https URLs are allowed' }
  }
  if (parsed.username || parsed.password) {
    return { ok: false, status: 400, reason: 'URLs with userinfo are not allowed' }
  }
  if (!isPathSafe(parsed.pathname)) {
    return { ok: false, status: 400, reason: 'Path traversal sequences are not allowed' }
  }
  return { ok: true, url: parsed }
}

/**
 * Validate a URL destined for the icon branch. The icon branch only does
 * local file reads (basename + fixed dir) and remote fetches from registered
 * repositories, so we do not enforce the host allowlist here. We do still
 * block private/loopback hosts and obviously malformed paths as defense in
 * depth.
 */
export function validateIconUrl(rawUrl: string): UrlValidationResult {
  const base = baseValidate(rawUrl)
  if (!base.ok) return base
  if (isPrivateOrLoopbackHost(base.url.hostname)) {
    return { ok: false, status: 403, reason: 'Private or loopback hosts are not allowed' }
  }
  return { ok: true, url: base.url, origin: '' }
}

/**
 * Validate a URL for the generic cache branch. This is the strict path:
 * the host must be in the registered-repository allowlist, the URL must be
 * HTTPS, and private/loopback targets are always rejected to prevent SSRF.
 */
export function validateGenericCacheUrl(
  rawUrl: string,
  allowlist: OriginAllowlist
): UrlValidationResult {
  const base = baseValidate(rawUrl)
  if (!base.ok) return base
  if (isPrivateOrLoopbackHost(base.url.hostname)) {
    return { ok: false, status: 403, reason: 'Private or loopback hosts are not allowed' }
  }
  if (allowlist.size === 0) {
    return { ok: false, status: 403, reason: 'No repositories are registered' }
  }
  const origin = normalizeOrigin(base.url)
  if (!allowlist.has(origin)) {
    return { ok: false, status: 403, reason: 'Host is not in the repository allowlist' }
  }
  return { ok: true, url: base.url, origin }
}

export function isPathInside(child: string, parent: string): boolean {
  const resolvedChild = path.resolve(child)
  const resolvedParent = path.resolve(parent)
  if (resolvedChild === resolvedParent) return true
  const parentWithSep = resolvedParent.endsWith(path.sep)
    ? resolvedParent
    : resolvedParent + path.sep
  return resolvedChild.startsWith(parentWithSep)
}

export function isIconUrl(url: string): boolean {
  return (
    (url.includes('/icons/') || url.includes('/icon/') || url.includes('/local-icon/')) &&
    url.endsWith('.png')
  )
}

export function isAllowedImageContentType(contentType: string | null): boolean {
  if (!contentType) return false
  const base = contentType.split(';')[0].trim().toLowerCase()
  return ALLOWED_IMAGE_CONTENT_TYPES.has(base)
}

export const MAX_GENERIC_CACHE_RESPONSE_BYTES = MAX_GENERIC_CACHE_BYTES
export const MAX_ICON_REMOTE_BYTES = ICON_REMOTE_BYTE_LIMIT
