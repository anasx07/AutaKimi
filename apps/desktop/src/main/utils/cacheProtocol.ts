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

const COMMON_IMAGE_CDNS = [
  'wp.com',
  'googleusercontent.com',
  'blogspot.com',
  'cloudinary.com',
  'imgur.com',
  'akamaized.net',
  'cloudfront.net',
  'statically.io',
  'cdninstagram.com'
]

export function buildOriginAllowlist(repos: unknown, extensions?: unknown): OriginAllowlist {
  const origins = new Set<string>()

  const addUrl = (urlStr: string) => {
    if (typeof urlStr !== 'string' || !urlStr.trim()) return
    let url = urlStr.trim()
    if (url.endsWith('templates.json')) {
      url = url.replace(/templates\.json$/, '')
    }
    try {
      const u = new URL(url)
      if (u.protocol === 'https:' || u.protocol === 'http:') {
        origins.add(normalizeOrigin(u))
      }
    } catch {
      // Ignore invalid URLs
    }
  }

  if (Array.isArray(repos)) {
    for (const repo of repos) {
      if (typeof repo === 'string') addUrl(repo)
    }
  }

  if (Array.isArray(extensions)) {
    for (const ext of extensions) {
      if (typeof ext === 'string') {
        addUrl(ext)
      } else if (ext && typeof ext === 'object') {
        if ('baseUrl' in ext && typeof (ext as any).baseUrl === 'string') {
          addUrl((ext as any).baseUrl)
        }
        if ('icon' in ext && typeof (ext as any).icon === 'string') {
          addUrl((ext as any).icon)
        }
      }
    }
  }

  return {
    has: (origin: string) => {
      const lc = origin.toLowerCase()
      if (origins.has(lc)) return true

      try {
        const u = new URL(lc)
        // Check if origin matches any registered origin or its subdomains
        for (const allowed of origins) {
          try {
            const allowedUrl = new URL(allowed)
            if (
              u.protocol === allowedUrl.protocol &&
              (u.hostname === allowedUrl.hostname || u.hostname.endsWith('.' + allowedUrl.hostname))
            ) {
              return true
            }
          } catch {}
        }

        // Check if origin matches common trusted image CDNs
        for (const cdn of COMMON_IMAGE_CDNS) {
          if (u.hostname === cdn || u.hostname.endsWith('.' + cdn)) {
            return true
          }
        }
      } catch {}

      return false
    },
    get size() {
      return origins.size
    }
  }
}

export function detectImageMimeType(buffer: Buffer | Uint8Array, url?: string): string {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg'
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png'
  }
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp'
  }
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38
  ) {
    return 'image/gif'
  }
  if (buffer.length >= 12) {
    // AVIF check: bytes 4-7 = "ftyp", bytes 8-11 = "avif" or "mif1"
    const isFtyp =
      buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70
    if (isFtyp) {
      const brand = String.fromCharCode(buffer[8], buffer[9], buffer[10], buffer[11])
      if (brand === 'avif' || brand === 'mif1') return 'image/avif'
    }
  }
  if (buffer.length >= 2 && buffer[0] === 0x42 && buffer[1] === 0x4d) {
    return 'image/bmp'
  }

  // Fallback to URL extension
  if (url) {
    try {
      const pathname = new URL(url).pathname.toLowerCase()
      if (pathname.endsWith('.webp')) return 'image/webp'
      if (pathname.endsWith('.png')) return 'image/png'
      if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) return 'image/jpeg'
      if (pathname.endsWith('.gif')) return 'image/gif'
      if (pathname.endsWith('.avif')) return 'image/avif'
      if (pathname.endsWith('.svg')) return 'image/svg+xml'
    } catch {}
  }

  return 'image/jpeg'
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
    lc.endsWith('.localhost') ||
    lc.endsWith('.nip.io') ||
    lc.endsWith('.sslip.io') ||
    lc.endsWith('.localtest.me')
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
  const isWin = process.platform === 'win32'
  const resolvedChild = path.resolve(child)
  const resolvedParent = path.resolve(parent)
  const checkChild = isWin ? resolvedChild.toLowerCase() : resolvedChild
  const checkParent = isWin ? resolvedParent.toLowerCase() : resolvedParent
  if (checkChild === checkParent) return true
  const parentWithSep = checkParent.endsWith(path.sep)
    ? checkParent
    : checkParent + path.sep
  return checkChild.startsWith(parentWithSep)
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
