import { parentPort, workerData } from 'worker_threads'
import vm from 'vm'
import * as cheerio from 'cheerio'
import { NetworkService } from '../common/services/network'
import { NetworkConfig } from '../common/config/network'

/**
 * Worker thread script for executing extension code in an isolated VM.
 *
 * Security model
 * ──────────────
 * The extension code is passed into the sandbox as a plain DATA string
 * (__extensionCode). Our wrapper script never interpolates that string —
 * it is compiled at runtime using the vm-context's own AsyncFunction
 * constructor, so the resulting function only has access to the identifiers
 * explicitly present in the sandbox. Structural injection (e.g. breaking out
 * of an IIFE via `}); evil_code; //`) is not possible because user-supplied
 * text never appears inside our script template.
 */
async function run() {
  if (!parentPort || !workerData) return

  const { code, params } = workerData

  // Validate that code is a plain string before doing anything with it
  if (typeof code !== 'string') {
    parentPort.postMessage({ error: 'Invalid extension code: expected a string.' })
    return
  }

  const sandbox: Record<string, unknown> = {
    // Expose code as DATA — never as script text
    __extensionCode: code,

    console: {
      log: (...args: unknown[]) => console.log('[Worker-VM]:', ...args),
      error: (...args: unknown[]) => console.error('[Worker-VM Error]:', ...args),
    },

    fetch: async (url: string, init?: RequestInit) => {
      // Security: restrict fetch to the extension's registered baseUrl domain
      const baseUrl = params._baseUrl as string | undefined
      if (baseUrl) {
        let reqHost: string
        try {
          reqHost = new URL(url).hostname
        } catch {
          throw new Error(`Security Exception: invalid URL: ${url}`)
        }
        const allowedHost = new URL(baseUrl).hostname
        if (reqHost !== allowedHost) {
          throw new Error(
            `Security Exception: Extension tried to fetch "${reqHost}" but is only allowed to fetch from "${allowedHost}".`
          )
        }
      }

      const response = await NetworkService.fetchWithRetry(url, {
        ...init,
        headers: {
          'User-Agent': (params._userAgent as string) || NetworkConfig.DEFAULT_UA,
          ...((init as any)?.headers || {})
        }
      })

      const body = await response.text()
      return {
        ok: response.ok,
        status: response.status,
        text: async () => body,
        json: async () => JSON.parse(body)
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
   *
   * At runtime it reads __extensionCode (a string) from the sandbox and
   * compiles it using the vm-context's own AsyncFunction constructor. The
   * resulting async function receives the sandbox values as named parameters
   * and cannot reference anything outside the sandbox.
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
        Promise.resolve(fn(params, fetch, cheerio, console)).then(resolve).catch(function(e) {
          resolve({ error: e.message });
        });
      } catch (e) {
        resolve({ error: e.message });
      }
    })
  `)

  try {
    const result = await wrapperScript.runInContext(context, { timeout: 5000 })
    parentPort.postMessage(result)
  } catch (error: unknown) {
    parentPort.postMessage({ error: error instanceof Error ? error.message : String(error) })
  }
}

run()
