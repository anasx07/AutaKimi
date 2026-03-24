import { parentPort, workerData } from 'worker_threads'
import vm from 'vm'
import * as cheerio from 'cheerio'
import { NetworkService } from '../common/services/network'
import { NetworkConfig } from '../common/config/network'

/**
 * Worker thread script for executing extension code in an isolated VM.
 */
async function run() {
  if (!parentPort || !workerData) return

  const { code, params } = workerData

  const sandbox = {
    console: {
      log: (...args: any[]) => console.log('[Worker-VM]:', ...args),
      error: (...args: any[]) => console.error('[Worker-VM Error]:', ...args),
    },
    fetch: async (url: string, init?: any) => {
      // Security: Restrict fetch to extension's baseUrl domain
      const baseUrl = params._baseUrl
      if (baseUrl && !url.startsWith(baseUrl)) {
        throw new Error(`Security Exception: Extension tried to fetch unauthorized URL: ${url}. Fetch is restricted to ${baseUrl}.`)
      }

      // Use robust fetch with retry
      const response = await NetworkService.fetchWithRetry(url, {
        ...init,
        headers: {
          'User-Agent': params._userAgent || NetworkConfig.DEFAULT_UA,
          ...(init?.headers || {})
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

  try {
    const script = new vm.Script(`
      (async () => {
        try {
          ${code}
        } catch (e) {
          return { error: e.message }
        }
      })()
    `)
    
    const result = await script.runInContext(context, { timeout: 30000 })
    parentPort.postMessage(result)
  } catch (error: any) {
    parentPort.postMessage({ error: error.message })
  }
}

run()
