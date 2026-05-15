import * as cheerio from 'cheerio'
import { MobileNetwork } from './network.native'
import { IpcResult } from '@common/types'

export const MobileExtension = {
  async execute(args: { pkg: string; code: string; contextArgs?: any }): Promise<IpcResult<any>> {
    const { code, contextArgs: params } = args

    const sandbox = {
      cheerio: {
        load: (html: string) => cheerio.load(html)
      },
      fetch: async (url: string, init?: { method?: string; headers?: any; body?: any }) => {
        const res = await MobileNetwork.fetchText(url, {
          method: (init?.method as any) || 'GET',
          headers: init?.headers,
          body: init?.body
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
        log: (...args: any[]) => console.log('[Native-Sandbox]:', ...args),
        error: (...args: any[]) => console.error('[Native-Sandbox Error]:', ...args)
      },
      params: params || {}
    }

    try {
      // In React Native, Function / AsyncFunction constructor works if eval is allowed
      // If using Hermes, this is generally supported in recent versions
      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
      const fn = new AsyncFunction('params', 'fetch', 'cheerio', 'console', code)

      const result = await fn(sandbox.params, sandbox.fetch, sandbox.cheerio, sandbox.console)

      return { ok: true, value: result }
    } catch (err: any) {
      console.error(`[Native-Sandbox] Execution failed for ${args.pkg}:`, err)
      return { ok: false, error: err.message || String(err) }
    }
  }
}
