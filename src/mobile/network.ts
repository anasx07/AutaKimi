
import { IpcResult, FetchOptions, FetchResult } from '@common/types'

export const MobileNetwork = {
  async fetchRepo(url: string): Promise<IpcResult<any>> {
    try {
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        return { ok: true, value: data }
      }
      return { ok: false, error: `Failed to fetch repo: ${response.status}` }
    } catch (err: unknown) {
      const error = err as Error
      return { ok: false, error: error.message || String(err) }
    }
  },

  async fetchText(url: string, options?: FetchOptions): Promise<IpcResult<FetchResult>> {
    try {
      const response = await fetch(url, {
        method: options?.method || 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          ...(options?.headers || {})
        },
        body: options?.body
      })

      const data = await response.text()
      return {
        ok: true,
        value: {
          data,
          status: response.status,
          ok: response.ok
        }
      }
    } catch (err: unknown) {
      const error = err as Error
      return { ok: false, error: error.message || String(err) }
    }
  },

  async cfBypass(url: string): Promise<IpcResult<boolean>> {
    try {
      window.open(url, '_blank')
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
