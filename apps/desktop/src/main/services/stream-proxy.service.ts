import { session } from 'electron'
import { AppService, ServicePriority } from './service.registry'

interface StreamHeaderRule {
  origin: string
  headers: Record<string, string>
  expiresAt: number
}

export class StreamProxyService implements AppService {
  public priority = ServicePriority.NETWORK
  private rules = new Map<string, StreamHeaderRule>()
  private isHooked = false

  async initialize(): Promise<void> {
    this.hookWebRequest()
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

  private findRule(requestUrl: string): StreamHeaderRule | null {
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

  private hookWebRequest(): void {
    if (this.isHooked) return
    const defaultSession = session.defaultSession
    if (!defaultSession) return

    this.isHooked = true

    defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
      const rule = this.findRule(details.url)
      if (rule) {
        const requestHeaders = { ...details.requestHeaders }
        for (const [k, v] of Object.entries(rule.headers)) {
          requestHeaders[k] = v
        }
        callback({ requestHeaders })
        return
      }
      callback({ requestHeaders: details.requestHeaders })
    })

    defaultSession.webRequest.onHeadersReceived((details, callback) => {
      const rule = this.findRule(details.url)
      if (rule) {
        const responseHeaders = { ...details.responseHeaders }
        responseHeaders['access-control-allow-origin'] = ['*']
        responseHeaders['access-control-allow-headers'] = ['*']
        responseHeaders['access-control-allow-methods'] = ['GET, HEAD, OPTIONS, POST']
        callback({ responseHeaders })
        return
      }
      callback({ responseHeaders: details.responseHeaders })
    })

    console.log('[StreamProxy] WebRequest headers and CORS interceptor active.')
  }
}

export const streamProxyService = new StreamProxyService()
