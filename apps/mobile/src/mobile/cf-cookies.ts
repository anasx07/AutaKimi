import { MobileDB } from './db.native'

const cfCookies: Record<string, string> = {}
let isInitialized = false
let initPromise: Promise<void> | null = null
const pendingResolvers = new Map<string, Array<(cookie: string | null) => void>>()
let pendingUrls: string[] = []

export const DEFAULT_MOBILE_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'

export const CfCookieStore = {
  async init(): Promise<void> {
    if (isInitialized) return
    if (initPromise) return initPromise
    initPromise = (async () => {
      try {
        const res = await MobileDB.getSetting('cf_cookies')
        if (res.ok && res.value) {
          const stored = JSON.parse(res.value)
          if (stored && typeof stored === 'object') {
            for (const [k, v] of Object.entries(stored)) {
              if (typeof v === 'string') {
                cfCookies[k] = v
              }
            }
          }
        }
      } catch (e) {
        console.warn('[CfCookieStore] Failed to load stored cookies:', e)
      } finally {
        isInitialized = true
      }
    })()
    return initPromise
  },

  get(domain: string): string | null {
    if (!isInitialized) {
      this.init().catch(() => {})
    }
    return cfCookies[domain] || null
  },

  set(domain: string, cookie: string) {
    cfCookies[domain] = cookie
    this.persist()
  },

  remove(domain: string) {
    delete cfCookies[domain]
    this.persist()
  },

  clear() {
    Object.keys(cfCookies).forEach(k => delete cfCookies[k])
    this.persist()
  },

  getAll(): Record<string, string> {
    if (!isInitialized) {
      this.init().catch(() => {})
    }
    return { ...cfCookies }
  },

  persist() {
    MobileDB.setSetting('cf_cookies', JSON.stringify(cfCookies)).catch(err => {
      console.warn('[CfCookieStore] Failed to persist cookies to MobileDB:', err)
    })
  }
}

export const CfBypassFlow = {
  get pendingUrl(): string | null {
    return pendingUrls.length > 0 ? pendingUrls[0] : null
  },

  get isPending(): boolean {
    return pendingResolvers.size > 0
  },

  start(url: string): Promise<string | null> {
    try {
      const domain = new URL(url).hostname
      const cached = CfCookieStore.get(domain)
      if (cached) {
        return Promise.resolve(cached)
      }

      return new Promise(resolve => {
        const queue = pendingResolvers.get(domain) || []
        queue.push(resolve)
        pendingResolvers.set(domain, queue)

        if (!pendingUrls.includes(url)) {
          pendingUrls.push(url)
        }
      })
    } catch {
      return Promise.resolve(null)
    }
  },

  complete(cookie: string | null, targetUrl?: string) {
    if (cookie) {
      let domain: string | null = null
      try {
        if (targetUrl) {
          domain = new URL(targetUrl).hostname
        } else if (pendingUrls.length > 0) {
          domain = new URL(pendingUrls[0]).hostname
        }
      } catch (_) {}

      if (domain) {
        CfCookieStore.set(domain, cookie)
        const resolvers = pendingResolvers.get(domain) || []
        pendingResolvers.delete(domain)
        pendingUrls = pendingUrls.filter(u => {
          try {
            return new URL(u).hostname !== domain
          } catch {
            return true
          }
        })
        resolvers.forEach(r => {
          try { r(cookie) } catch (_) {}
        })
      } else {
        // Fallback: resolve all currently pending
        for (const resolvers of pendingResolvers.values()) {
          resolvers.forEach(r => {
            try { r(cookie) } catch (_) {}
          })
        }
        pendingResolvers.clear()
        pendingUrls = []
      }
    } else {
      // Cancel
      if (targetUrl) {
        try {
          const domain = new URL(targetUrl).hostname
          const resolvers = pendingResolvers.get(domain) || []
          pendingResolvers.delete(domain)
          pendingUrls = pendingUrls.filter(u => u !== targetUrl)
          resolvers.forEach(r => {
            try { r(null) } catch (_) {}
          })
          return
        } catch (_) {}
      }

      // If no specific URL or domain, settle all pending with null
      for (const resolvers of pendingResolvers.values()) {
        resolvers.forEach(r => {
          try { r(null) } catch (_) {}
        })
      }
      pendingResolvers.clear()
      pendingUrls = []
    }
  },

  cancel(targetUrl?: string) {
    this.complete(null, targetUrl)
  }
}

export function getImageHeaders(imageUrl: string, refererUrl?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': DEFAULT_MOBILE_USER_AGENT,
    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
  }

  // 1. Referer Header for anti-hotlinking
  if (refererUrl && (refererUrl.startsWith('http://') || refererUrl.startsWith('https://'))) {
    headers['Referer'] = refererUrl
  } else if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    try {
      const u = new URL(imageUrl)
      headers['Referer'] = u.origin
    } catch {}
  }

  // 2. Cookie Header from CfCookieStore
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    try {
      const imgDomain = new URL(imageUrl).hostname
      let cfCookie = CfCookieStore.get(imgDomain)

      if (!cfCookie && refererUrl) {
        try {
          const refDomain = new URL(refererUrl).hostname
          cfCookie = CfCookieStore.get(refDomain)
        } catch {}
      }

      if (!cfCookie) {
        const allCookies = CfCookieStore.getAll()
        for (const [storedDomain, cookieVal] of Object.entries(allCookies)) {
          if (
            imgDomain === storedDomain ||
            imgDomain.endsWith('.' + storedDomain) ||
            storedDomain.endsWith('.' + imgDomain)
          ) {
            cfCookie = cookieVal
            break
          }
        }
      }

      if (cfCookie) {
        headers['Cookie'] = cfCookie.startsWith('cf_clearance=') ? cfCookie : `cf_clearance=${cfCookie}`
      }
    } catch {}
  }

  return headers
}

export function getVideoHeaders(videoUrl: string, refererUrl?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': DEFAULT_MOBILE_USER_AGENT,
    'Accept': '*/*'
  }

  // 1. Referer Header for anti-hotlinking
  if (refererUrl && (refererUrl.startsWith('http://') || refererUrl.startsWith('https://'))) {
    headers['Referer'] = refererUrl
  } else if (videoUrl.startsWith('http://') || videoUrl.startsWith('https://')) {
    try {
      const u = new URL(videoUrl)
      headers['Referer'] = u.origin
    } catch {}
  }

  // 2. Cookie Header from CfCookieStore
  if (videoUrl.startsWith('http://') || videoUrl.startsWith('https://')) {
    try {
      const vidDomain = new URL(videoUrl).hostname
      let cfCookie = CfCookieStore.get(vidDomain)

      if (!cfCookie && refererUrl) {
        try {
          const refDomain = new URL(refererUrl).hostname
          cfCookie = CfCookieStore.get(refDomain)
        } catch {}
      }

      if (!cfCookie) {
        const allCookies = CfCookieStore.getAll()
        for (const [storedDomain, cookieVal] of Object.entries(allCookies)) {
          if (
            vidDomain === storedDomain ||
            vidDomain.endsWith('.' + storedDomain) ||
            storedDomain.endsWith('.' + vidDomain)
          ) {
            cfCookie = cookieVal
            break
          }
        }
      }

      if (cfCookie) {
        headers['Cookie'] = cfCookie.startsWith('cf_clearance=') ? cfCookie : `cf_clearance=${cfCookie}`
      }
    } catch {}
  }

  return headers
}

