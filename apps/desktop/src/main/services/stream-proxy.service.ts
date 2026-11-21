import { AppService, ServicePriority } from './service.registry'

interface StreamHeaderRule {
  origin: string
  rootDomain: string | null
  headers: Record<string, string>
  expiresAt: number
}

const KNOWN_SLDS = new Set([
  'co', 'com', 'org', 'net', 'edu', 'gov', 'mil', 'ac', 'ne', 'or', 'gen', 'firm', 'ind', 'nom'
])

export function getRegistrableDomain(hostname: string): string | null {
  if (!hostname || typeof hostname !== 'string') return null
  const host = hostname.trim().toLowerCase()
  if (!host || host === 'localhost' || host.includes(':') || host.startsWith('[')) return null
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host)) return null

  const parts = host.split('.')
  if (parts.length < 2) return null
  if (parts.length === 2) return host

  const tld = parts[parts.length - 1]
  const sld = parts[parts.length - 2]

  if (tld.length === 2 && KNOWN_SLDS.has(sld)) {
    return parts.slice(-3).join('.')
  }
  return parts.slice(-2).join('.')
}

export class StreamProxyService implements AppService {
  public priority = ServicePriority.NETWORK
  private rules = new Map<string, StreamHeaderRule>()
  private domainRules = new Map<string, StreamHeaderRule>()

  async initialize(): Promise<void> {
    // WebRequest hooks are dispatched centrally from main/index.ts
    // to prevent Electron single-listener overwrite issues.
  }

  async shutdown(): Promise<void> {
    this.rules.clear()
    this.domainRules.clear()
  }

  public setStreamHeaders(url: string, headers: Record<string, string>): void {
    if (!url || !headers || typeof headers !== 'object') return
    try {
      const parsed = new URL(url)
      const origin = parsed.origin.toLowerCase()
      const rootDomain = getRegistrableDomain(parsed.hostname)
      const rule: StreamHeaderRule = {
        origin,
        rootDomain,
        headers: { ...headers },
        expiresAt: Date.now() + 6 * 3600 * 1000 // 6 hours expiration
      }
      this.rules.set(origin, rule)
      if (rootDomain) {
        this.domainRules.set(rootDomain, rule)
      }
      console.log(
        `[StreamProxy] Registered stream headers for origin: ${origin}${
          rootDomain ? ` (root domain: ${rootDomain})` : ''
        }`
      )
    } catch (e) {
      console.warn(`[StreamProxy] Failed to register stream headers for URL ${url}:`, e)
    }
  }

  public findRule(requestUrl: string): StreamHeaderRule | null {
    try {
      const parsed = new URL(requestUrl)
      const origin = parsed.origin.toLowerCase()
      const now = Date.now()

      // 1. Exact origin match
      const exactRule = this.rules.get(origin)
      if (exactRule) {
        if (now > exactRule.expiresAt) {
          this.rules.delete(origin)
          this.pruneDomainRule(exactRule.rootDomain)
        } else {
          return exactRule
        }
      }

      // 2. Registrable root domain fallback (e.g. for sibling HLS CDN subdomains)
      const rootDomain = getRegistrableDomain(parsed.hostname)
      if (rootDomain) {
        const domainRule = this.domainRules.get(rootDomain)
        if (domainRule) {
          if (now > domainRule.expiresAt) {
            this.rules.delete(domainRule.origin)
            this.pruneDomainRule(rootDomain)
          } else {
            return domainRule
          }
        }
      }
    } catch {}
    return null
  }

  private pruneDomainRule(rootDomain: string | null): void {
    if (!rootDomain) return
    const now = Date.now()
    let replacement: StreamHeaderRule | null = null
    for (const rule of this.rules.values()) {
      if (rule.rootDomain === rootDomain && now <= rule.expiresAt) {
        if (!replacement || rule.expiresAt > replacement.expiresAt) {
          replacement = rule
        }
      }
    }
    if (replacement) {
      this.domainRules.set(rootDomain, replacement)
    } else {
      this.domainRules.delete(rootDomain)
    }
  }

  public applyRequestHeaders(
    url: string,
    requestHeaders: Record<string, string>
  ): Record<string, string> {
    const rule = this.findRule(url)
    if (!rule) return requestHeaders

    const modified = { ...requestHeaders }
    for (const [k, v] of Object.entries(rule.headers)) {
      const lowerKey = k.toLowerCase()
      for (const existingKey of Object.keys(modified)) {
        if (existingKey.toLowerCase() === lowerKey && existingKey !== k) {
          delete modified[existingKey]
        }
      }
      modified[k] = v
    }
    return modified
  }

  public applyResponseHeaders(
    url: string,
    responseHeaders: Record<string, string[]>
  ): Record<string, string[]> {
    const rule = this.findRule(url)
    if (!rule) return responseHeaders

    const modified = { ...responseHeaders }
    for (const key of Object.keys(modified)) {
      const lower = key.toLowerCase()
      if (
        lower === 'access-control-allow-origin' ||
        lower === 'access-control-allow-headers' ||
        lower === 'access-control-allow-methods'
      ) {
        delete modified[key]
      }
    }
    modified['Access-Control-Allow-Origin'] = ['*']
    modified['Access-Control-Allow-Headers'] = ['*']
    modified['Access-Control-Allow-Methods'] = ['GET, HEAD, OPTIONS, POST']
    return modified
  }
}

export const streamProxyService = new StreamProxyService()
