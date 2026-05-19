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
  resolveChallenge(url: string, silent?: boolean): Promise<Result<{ userAgent: string; cookies: string }>>
  
  /**
   * Retrieves currently stored cookies/UA for a domain without triggering UI.
   */
  getCredentials(url: string): Promise<{ userAgent: string; cookies: string }>

  /**
   * Reports that a domain was successfully used for a fetch.
   */
  reportPulse(url: string): void
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
   * Now includes built-in retry logic.
   */
  async fetch(
    url: string,
    options: {
      attempts?: number
      delay?: number
      fetchFn?: any
      silent?: boolean
    } & RequestInit = {}
  ): Promise<Result<Response>> {
    // Intercept local filesystem paths when running in Node/Electron environment
    const isNode = typeof process !== 'undefined' && process.versions && process.versions.node
    if (isNode && !url.startsWith('http://') && !url.startsWith('https://')) {
      try {
        const fs = await import('fs')
        const path = await import('path')
        
        let targetPath = url
        if (url.startsWith('file:///')) {
          const { fileURLToPath } = await import('url')
          targetPath = fileURLToPath(url)
        } else {
          targetPath = path.resolve(url)
        }
        
        if (fs.existsSync(targetPath) && !fs.statSync(targetPath).isDirectory()) {
          const fileContent = fs.readFileSync(targetPath, 'utf8')
          const mockResponse = {
            ok: true,
            status: 200,
            text: async () => fileContent,
            json: async () => JSON.parse(fileContent),
            clone() { return this }
          } as unknown as Response
          return { ok: true, value: mockResponse }
        }
      } catch (e: any) {
        return { ok: false, error: `Local filesystem error: ${e.message}`, status: 500 }
      }
    }

    const { attempts = 1, delay = 1000, fetchFn = fetch, ...init } = options

    return NetworkClient.executeWithRetry(
      async () => {
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
          let response = await fetchFn(url, init)

          // 3. Detect Cloudflare challenge (403 Forbidden or specific headers)
          if (response.status === 403 || response.status === 503) {
            const text = await response.clone().text()
            if (
              text.includes('cloudflare') ||
              text.includes('Challenge_eb') ||
              text.includes('cf-browser-verification')
            ) {
              console.warn(`[NetworkClient] Cloudflare detected for ${url}. Requesting bypass...`)

              if (this.provider) {
                const bypassRes = await this.provider.resolveChallenge(url, options.silent)
                if (bypassRes.ok) {
                  // Update headers for retry (this specific attempt's retry)
                  init.headers = {
                    ...init.headers,
                    'User-Agent': bypassRes.value.userAgent,
                    'Cookie': bypassRes.value.cookies
                  }
                  response = await fetchFn(url, init)
                } else {
                  return {
                    ok: false,
                    error: 'Cloudflare bypass failed or was cancelled',
                    status: response.status
                  }
                }
              }
            }
          }

          // 4. Report pulse on success if we have a provider
          if (response.ok && this.provider) {
            this.provider.reportPulse(url)
          }

          return { ok: true, value: response }
        } catch (err: any) {
          return { ok: false, error: err.message || String(err) }
        }
      },
      (res: Result<Response>) => {
        // Retry logic: retry if not OK AND (it's a 5xx error OR rate limited)
        if (!res.ok) return true // Generic error (network level)
        const response = res.value
        return !response.ok && (response.status >= 500 || response.status === 429)
      },
      attempts,
      delay
    )
  }

  /**
   * Static helper for retrying logic
   */
  static async executeWithRetry<T>(
    fn: () => Promise<T>,
    shouldRetry: (res: T) => boolean,
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
 * @deprecated Use `networkClient.fetch()` instead.
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
    const res = await networkClient.fetch(url, { ...init, attempts, delay, fetchFn })
    if (res.ok) return res.value
    // Legacy return was just the response object, even if it failed
    // (the caller would check res.ok). If it threw a network error, we should re-throw.
    throw new Error(res.error)
  }
}
