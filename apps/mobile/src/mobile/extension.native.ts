import { NativeModules, Platform } from 'react-native'
import * as cheerio from 'cheerio'
import { MobileNetwork } from './network.native'
import { IpcResult } from '@common/types'

const { KeiyoushiBridge } = NativeModules

export const MobileExtension = {
  async loadKeiyoushiApk(apkUrl: string, className: string, pkg: string): Promise<IpcResult<any>> {
    if (Platform.OS !== 'android' || !KeiyoushiBridge) {
      return { ok: false, error: 'Keiyoushi native DEX loading is only supported on Android' }
    }
    try {
      const res = await KeiyoushiBridge.loadKeiyoushiApk(apkUrl, className, pkg)
      return { ok: true, value: res }
    } catch (e: any) {
      return { ok: false, error: e.message || String(e) }
    }
  },
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

    const sanitizedCode = code ? code.replace(/\r/g, '') : ''
    console.log('[Native-Sandbox] Executing code (first 100 chars):', JSON.stringify(sanitizedCode.slice(0, 100)))
    console.log('[Native-Sandbox] Full code length:', sanitizedCode.length)

    try {
      // Hermes does NOT support the AsyncFunction constructor (await keyword is rejected
      // at parse time with "';' expected"). Instead, wrap the extension code inside an
      // async IIFE within a regular Function constructor. Hermes can parse `async function`
      // syntax in eval'd code — it just can't handle the AsyncFunction constructor itself.
      const wrappedCode = `return (async function(__params, __fetch, __cheerio, __console) {
  var params = __params;
  var fetch = __fetch;
  var cheerio = __cheerio;
  var console = __console;
  var require = function(m) {
    if (m === 'cheerio') return __cheerio;
    throw new Error('Module not found in mobile sandbox: ' + m);
  };
  ${sanitizedCode}
})(__params, __fetch, __cheerio, __console);`

      const fn = new Function('__params', '__fetch', '__cheerio', '__console', wrappedCode)

      let timer: ReturnType<typeof setTimeout> | null = null
      const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`Extension execution timed out after 15000ms for ${args.pkg}`))
        }, 15000)
      })

      try {
        const executionPromise = Promise.resolve().then(() =>
          fn(sandbox.params, sandbox.fetch, sandbox.cheerio, sandbox.console)
        )
        const result = await Promise.race([executionPromise, timeoutPromise])
        return { ok: true, value: result }
      } finally {
        if (timer) clearTimeout(timer)
      }
    } catch (err: any) {
      console.error(`[Native-Sandbox] Execution failed for ${args.pkg}:`, err)
      return { ok: false, error: err.message || String(err) }
    }
  }
}
