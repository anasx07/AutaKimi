import { CapacitorHttp, HttpResponse } from '@capacitor/core'
import { Browser } from '@capacitor/browser'
import { IpcResult, FetchOptions, FetchResult } from '@common/types'

export const MobileNetwork = {
  async fetchRepo(url: string): Promise<IpcResult<any>> {
    try {
      const response: HttpResponse = await CapacitorHttp.get({ url })
      if (response.status >= 200 && response.status < 300) {
        return { ok: true, value: response.data }
      }
      return { ok: false, error: `Failed to fetch repo: ${response.status}` }
    } catch (err: unknown) {
      const error = err as Error
      return { ok: false, error: error.message || String(err) }
    }
  },

  async fetchText(url: string, options?: FetchOptions): Promise<IpcResult<FetchResult>> {
    try {
      const response: HttpResponse = await CapacitorHttp.request({
        url,
        method: options?.method || 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          ...(options?.headers || {})
        },
        data: options?.body,
        connectTimeout: 15000,
        readTimeout: 15000
      })

      return {
        ok: true,
        value: {
          data: typeof response.data === 'string' ? response.data : JSON.stringify(response.data),
          status: response.status,
          ok: response.status >= 200 && response.status < 300
        }
      }
    } catch (err: unknown) {
      const error = err as Error
      return { ok: false, error: error.message || String(err) }
    }
  },

  async cfBypass(url: string): Promise<IpcResult<boolean>> {
    try {
      await Browser.open({ url })
      return { ok: true, value: true }
    } catch (err: unknown) {
      const error = err as Error
      return { ok: false, error: error.message || String(err) }
    }
  },

  async clearCookies(): Promise<IpcResult<boolean>> {
    return { ok: true, value: true }
  }
}
