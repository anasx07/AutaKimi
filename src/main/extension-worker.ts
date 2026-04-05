import { parentPort } from 'worker_threads'
import vm from 'vm'
import * as cheerio from 'cheerio'
import { NetworkService } from '../common/services/network'
import { NetworkConfig } from '../common/config/network'

/**
 * Worker thread script for executing extension code in an isolated VM.
 * This worker is persistent and processes jobs via IPC messages.
 *
 * Two fetch strategies are available:
 *  1. _cfCookies  — CF clearance cookies are injected as request headers (fast path)
 *  2. WORKER_FETCH — for scripts that need the full main-process bypass session,
 *                    the worker delegates the request over IPC and waits for FETCH_REPLY.
 */
if (!parentPort) {
  throw new Error('This file must be run inside a Worker thread.')
}

// Tracks in-flight delegated fetches: fetchId → resolver
const pendingFetches = new Map<
  string,
  (res: {
    ok: boolean
    status: number
    text: () => Promise<string>
    json: () => Promise<unknown>
  }) => void
>()

// ─── Main task handler ────────────────────────────────────────────────────────
parentPort.on(
  'message',
  async (message: { id: string; code: string; params: Record<string, any>; type?: string }) => {
    // Skip non-task messages (e.g. FETCH_REPLY) — handled by the second listener
    if (message.type) return

    const { id, code, params } = message

    // Validate that code is a plain string before doing anything with it
    if (typeof code !== 'string') {
      parentPort!.postMessage({ id, error: 'Invalid extension code: expected a string.' })
      return
    }

    const sandbox: Record<string, unknown> = {
      __extensionCode: code,

      console: {
        log: (...args: unknown[]) => console.log('[Worker-VM]:', ...args),
        error: (...args: unknown[]) => console.error('[Worker-VM Error]:', ...args)
      },

      fetch: async (url: string, init?: RequestInit) => {
        // ── Security: restrict to the extension's registered domain ──────────
        const baseUrl = params._baseUrl as string | undefined
        if (baseUrl) {
          let reqHost: string
          try {
            reqHost = new URL(url).hostname
          } catch {
            throw new Error(`Security Exception: invalid URL: ${url}`)
          }
          const allowedHost = new URL(baseUrl).hostname
          const baseRootHost = allowedHost.split('.').slice(-2).join('.')
          if (!reqHost.endsWith(baseRootHost) && reqHost !== allowedHost) {
            throw new Error(
              `Security Exception: fetch "${reqHost}" not allowed for extension "${allowedHost}"`
            )
          }
        }

        const bypassCf = params._bypassCloudflare as boolean
        const cfCookies = params._cfCookies as string | undefined

        // ── Strategy 1: delegate to main process for full CF session bypass ──
        if (bypassCf) {
          const fetchId = Math.random().toString(36).slice(2)
          console.log(`[Worker-VM] Delegating fetch to main (CF bypass): ${url}`)
          return new Promise<{
            ok: boolean
            status: number
            text: () => Promise<string>
            json: () => Promise<unknown>
          }>((resolve) => {
            pendingFetches.set(fetchId, resolve)
            parentPort!.postMessage({ type: 'WORKER_FETCH', fetchId, url, init })
          })
        }

        // ── Strategy 2: direct fetch with injected CF cookies ─────────────
        const extraHeaders: Record<string, string> = {
          'User-Agent': (params._userAgent as string) || NetworkConfig.DEFAULT_UA,
          ...((init as any)?.headers || {})
        }
        if (cfCookies) {
          extraHeaders['Cookie'] = cfCookies
          console.log(`[Worker-VM] Fetching with injected CF cookies: ${url}`)
        } else {
          console.log(`[Worker-VM] Fetching (no CF): ${url}`)
        }

        try {
          const response = await NetworkService.fetchWithRetry(url, {
            ...init,
            headers: extraHeaders
          })
          const body = await response.text()
          console.log(
            `[Worker-VM] Response: status=${response.status} bodyLen=${body.length} url=${url}`
          )
          return {
            ok: response.ok,
            status: response.status,
            text: async () => body,
            json: async () => JSON.parse(body)
          }
        } catch (e: unknown) {
          console.error(`[Worker-VM] Fetch error for ${url}:`, e)
          throw e
        }
      },

      cheerio: {
        load: (html: string) => cheerio.load(html)
      },

      params
    }

    const context = vm.createContext(sandbox)

    /**
     * Wrapper script — contains zero user-supplied text.
     * Reads __extensionCode from the sandbox and compiles it as an AsyncFunction.
     */
    const wrapperScript = new vm.Script(`
      new Promise(function __runExtension(resolve) {
        try {
          var AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
          var fn = new AsyncFunction(
            'params',
            'fetch',
            'cheerio',
            'console',
            __extensionCode
          );
          Promise.resolve(fn(params, fetch, cheerio, console))
            .then(function(res) { resolve({ result: res }); })
            .catch(function(e)  { resolve({ error: e.message }); });
        } catch (e) {
          resolve({ error: e.message });
        }
      })
    `)

    try {
      const output: any = await wrapperScript.runInContext(context, { timeout: 30000 })
      if (output.error) {
        console.error(`[Worker-VM] Extension error for ${id}: ${output.error}`)
        parentPort!.postMessage({ id, error: output.error })
      } else {
        console.log(
          `[Worker-VM] Extension success for ${id}: items=${output.result?.data?.length ?? 'N/A'}`
        )
        parentPort!.postMessage({ id, result: output.result })
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error(`[Worker-VM] VM threw for ${id}: ${msg}`)
      parentPort!.postMessage({ id, error: msg })
    }
  }
)

// ─── FETCH_REPLY handler ──────────────────────────────────────────────────────
// Receives serializable data from the main process and reconstructs
// a response-like object with working text()/json() methods.
parentPort.on(
  'message',
  (msg: { type?: string; fetchId?: string; body?: string; ok?: boolean; status?: number }) => {
    if (msg.type === 'FETCH_REPLY' && msg.fetchId) {
      const resolver = pendingFetches.get(msg.fetchId)
      if (resolver) {
        pendingFetches.delete(msg.fetchId)
        const body = msg.body ?? ''
        resolver({
          ok: msg.ok ?? false,
          status: msg.status ?? 500,
          text: async () => body,
          json: async () => JSON.parse(body)
        })
      }
    }
  }
)
