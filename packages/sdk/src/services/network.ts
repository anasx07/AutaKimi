/**
 * Unified Result type for robust error handling
 */
export type Result<T, E = string> =
  | { ok: true; value: T }
  | { ok: false; error: E; status?: number }

/**
 * Interface for platform-specific bypass handling (Electron, WebView, etc.)
 */
export interface IBypassProvider {
  /**
   * Triggers a user-solved bypass flow (e.g. opens a hidden browser window).
   * Should return the valid User-Agent and Cookies after successful solving.
   */
  resolveChallenge(url: string): Promise<Result<{ userAgent: string; cookies: string }>>
  
  /**
   * Retrieves currently stored cookies/UA for a domain without triggering UI.
   */
  getCredentials(url: string): Promise<{ userAgent: string; cookies: string }>
}

/**
 * Shared Network Utilities for both Main and Renderer processes.
 */
export class NetworkClient {
  private provider: IBypassProvider | null = null

  constructor(provider?: IBypassProvider) {
    if (provider) this.provider = provider
  }

  setProvider(provider: IBypassProvider) {
    this.provider = provider
  }

  /**
   * High-level fetch that automatically detects Cloudflare challenges
   * and requests a bypass from the platform if needed.
   */
  async fetch(url: string, init: RequestInit = {}): Promise<Result<Response>> {
    try {
      // 1. Get existing credentials if provider is available
      if (this.provider) {
        const { userAgent, cookies } = await this.provider.getCredentials(url)
        init.headers = {
          ...init.headers,
          'User-Agent': userAgent,
          'Cookie': cookies
        }
      }

      // 2. Perform initial request
      let response = await fetch(url, init)

      // 3. Detect Cloudflare challenge (403 Forbidden or specific headers)
      if (response.status === 403 || response.status === 503) {
        const text = await response.clone().text()
        if (text.includes('cloudflare') || text.includes('Challenge_eb') || text.includes('cf-browser-verification')) {
          console.warn(`[NetworkClient] Cloudflare detected for ${url}. Requesting bypass...`)
          
          if (this.provider) {
            const bypassRes = await this.provider.resolveChallenge(url)
            if (bypassRes.ok) {
              // Retry with new credentials
              init.headers = {
                ...init.headers,
                'User-Agent': bypassRes.value.userAgent,
                'Cookie': bypassRes.value.cookies
              }
              response = await fetch(url, init)
            } else {
              return { ok: false, error: 'Cloudflare bypass failed or was cancelled', status: response.status }
            }
          }
        }
      }

      return { ok: true, value: response }
    } catch (err: any) {
      return { ok: false, error: err.message || String(err) }
    }
  }

  /**
   * Static helper for retrying logic
   */
  static async executeWithRetry<T>(
    fn: () => Promise<T>,
    shouldRetry: (res: any) => boolean,
    attempts = 3,
    delay = 1000
  ): Promise<T> {
    let lastResult: T
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        lastResult = await fn()
        if (!shouldRetry(lastResult)) return lastResult
      } catch (error: any) {
        if (attempt === attempts) throw error
        lastResult = { ok: false, error: error.message } as any
      }

      if (attempt < attempts) {
        const wait = delay * Math.pow(2, attempt - 1)
        await new Promise((resolve) => setTimeout(resolve, wait))
      }
    }
    return lastResult!
  }
}

export const networkClient = new NetworkClient()

/**
 * Backward compatibility alias for NetworkService
 */
export const NetworkService = {
  executeWithRetry: NetworkClient.executeWithRetry,
  fetchWithRetry: async (
    url: string,
    init?: any,
    attempts = 3,
    delay = 1000,
    fetchFn: any = fetch
  ): Promise<any> => {
    return NetworkClient.executeWithRetry(
      () => fetchFn(url, init),
      (res) => !res.ok && (res.status >= 500 || res.status === 429),
      attempts,
      delay
    )
  }
}
