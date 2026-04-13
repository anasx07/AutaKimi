import * as cheerio from 'cheerio'
import { MobileNetwork } from './network'
import { IpcResult } from '@common/types'
import { ExtensionEngine, IExtensionPlatform } from '../common/engines/extension.engine'
import { MobileDB } from './db'

class MobileExtensionPlatform implements IExtensionPlatform {
  async fetch(url: string, init?: any, bypassCf = false): Promise<any> {
    const res = await MobileNetwork.fetchText(url, {
      method: init?.method || 'GET',
      headers: init?.headers,
      body: init?.body,
      bypassCf
    })

    if (!res.ok) {
      throw new Error(res.error)
    }

    const data = res.value.data
    return {
      get ok() { return res.value.ok },
      get status() { return res.value.status },
      text: async () => data,
      json: async () => JSON.parse(data)
    }
  }

  async runSandbox(code: string, params: Record<string, any>): Promise<any> {
    const sandbox = {
      cheerio: {
        load: (html: string) => cheerio.load(html)
      },
      fetch: async (url: string, init?: any) => {
        const res = await this.fetch(url, init, params?._bypassCloudflare)
        return res
      },
      console: {
        log: (...args: any[]) => console.log('[Mobile-Sandbox]:', ...args),
        error: (...args: any[]) => console.error('[Mobile-Sandbox Error]:', ...args)
      },
      params: params || {}
    }

    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
    const fn = new AsyncFunction('params', 'fetch', 'cheerio', 'console', code)
    return fn(sandbox.params, sandbox.fetch, sandbox.cheerio, sandbox.console)
  }

  async getSetting(key: string): Promise<string | null> {
    const res = await MobileDB.getSetting(key)
    return res.ok ? res.value : null
  }

  async upsertExtension(ext: any): Promise<void> {
    await MobileDB.addExtension(ext)
  }
}

const engine = new ExtensionEngine(new MobileExtensionPlatform())

export const MobileExtension = {
  async execute(args: { pkg: string; code: string; contextArgs?: any }): Promise<IpcResult<any>> {
    try {
      const result = await engine.execute(args.pkg, args.code, args.contextArgs)
      return { ok: true, value: result }
    } catch (err: any) {
      return { ok: false, error: err.message || String(err) }
    }
  },

  async install(ext: any, repoUrl: string): Promise<IpcResult<{ success: boolean }>> {
    try {
      const result = await engine.install(ext, repoUrl)
      return { ok: true, value: result }
    } catch (err: any) {
      return { ok: false, error: err.message || String(err) }
    }
  },

  async detectTheme(url: string, bypassCf = true): Promise<IpcResult<string>> {
      try {
          const theme = await engine.detectTheme(url, bypassCf)
          return { ok: true, value: theme }
      } catch (err: any) {
          return { ok: false, error: err.message || String(err) }
      }
  }
}
