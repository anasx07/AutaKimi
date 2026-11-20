import { AppService, ServicePriority } from './service.registry'

interface StreamHeaderRule {
  origin: string
  headers: Record<string, string>
  expiresAt: number
}

export class StreamProxyService implements AppService {
  public priority = ServicePriority.NETWORK
  private rules = new Map<string, StreamHeaderRule>()

  async initialize(): Promise<void> {
    // WebRequest hooks are dispatched centrally from main/index.ts
    // to prevent Electron single-listener overwrite issues.
  }

  async shutdown(): Promise<void> {
    this.rules.clear()
  }

  public setStreamHeaders(url: string, headers: Record<string, string>): void {
    if (!url || !headers || typeof headers !== 'object') return
    try {
      const parsed = new URL(url)
      const origin = parsed.origin.toLowerCase()
      this.rules.set(origin, {
        origin,
        headers: { ...headers },
        expiresAt: Date.now() + 6 * 3600 * 1000 // 6 hours expiration
      })
      console.log(`[StreamProxy] Registered stream headers for origin: ${origin}`)
    } catch (e) {
      console.warn(`[StreamProxy] Failed to register stream headers for URL ${url}:`, e)
    }
  }

  public findRule(requestUrl: string): StreamHeaderRule | null {
    try {
      const parsed = new URL(requestUrl)
      const origin = parsed.origin.toLowerCase()
      const rule = this.rules.get(origin)
      if (rule) {
        if (Date.now() > rule.expiresAt) {
          this.rules.delete(origin)
          return null
        }
        return rule
      }
    } catch {}
    return null
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
