import * as cheerio from 'cheerio'
import { MobileNetwork } from './network'
import { IpcResult } from '@common/types'

export const MobileExtension = {
  async execute(args: { pkg: string; code: string; contextArgs?: any }): Promise<IpcResult<any>> {
    const { code, contextArgs: params } = args

    const sandbox = {
      cheerio: {
        load: (html: string) => cheerio.load(html)
      },
      fetch: async (url: string, init?: { method?: string; headers?: any; body?: any }) => {
        const bypassCf = params?._bypassCloudflare || false
        console.log(`[Mobile-Sandbox] Fetching: ${url} (bypassCf=${bypassCf})`)

        const res = await MobileNetwork.fetchText(url, {
          method: (init?.method as any) || 'GET',
          headers: init?.headers,
          body: init?.body,
          bypassCf
        })

        if (!res.ok) {
          throw new Error(res.error)
        }

        const data = res.value.data
        return {
          ok: res.value.ok,
          status: res.value.status,
          text: async () => data,
          json: async () => JSON.parse(data)
        }
      },
      console: {
        log: (...args: any[]) => console.log('[Mobile-Sandbox]:', ...args),
        error: (...args: any[]) => console.error('[Mobile-Sandbox Error]:', ...args)
      },
      params: params || {}
    }

    try {
      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
      const fn = new AsyncFunction('params', 'fetch', 'cheerio', 'console', code)

      const result = await fn(sandbox.params, sandbox.fetch, sandbox.cheerio, sandbox.console)

      console.log(`[Mobile-Sandbox] Execution success for ${args.pkg}`)
      return { ok: true, value: result }
    } catch (err: unknown) {
      const error = err as Error
      console.error(`[Mobile-Sandbox] Execution failed for ${args.pkg}:`, error)
      return { ok: false, error: error.message || String(err) }
    }
  }
}
