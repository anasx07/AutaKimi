import { IpcResult, FetchOptions, FetchResult } from '../common/types'
import { CfCookieStore, CfBypassFlow } from './cf-cookies'
import { router } from 'expo-router'

function getDomain(url: string): string {
  try { return new URL(url).hostname } catch { return '' }
}

function buildHeaders(url: string, extra?: Record<string, string>): Record<string, string> {
  const domain = getDomain(url)
  const cfCookie = CfCookieStore.get(domain)
  const headers: Record<string, string> = {
    'User-Agent':
      'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    ...(extra || {})
  }
  if (cfCookie) {
    headers['Cookie'] = `cf_clearance=${cfCookie}`
    headers['Sec-Fetch-Dest'] = 'document'
    headers['Sec-Fetch-Mode'] = 'navigate'
    headers['Sec-Fetch-Site'] = 'none'
  }
  return headers
}

export const MobileNetwork = {
  async fetchRepo(url: string): Promise<IpcResult<any>> {
    try {
      const response = await fetch(url, { headers: buildHeaders(url) })
      if (response.ok) {
        const data = await response.json()
        return { ok: true, value: data }
      }
      return { ok: false, error: `Failed to fetch repo: ${response.status}` }
    } catch (err: any) {
      return { ok: false, error: err.message || String(err) }
    }
  },

  async fetchText(url: string, options?: FetchOptions): Promise<IpcResult<FetchResult>> {
    try {
      const response = await fetch(url, {
        method: options?.method || 'GET',
        headers: buildHeaders(url, options?.headers as Record<string, string> | undefined),
        body: options?.body
          ? typeof options.body === 'string'
            ? options.body
            : JSON.stringify(options.body)
          : undefined
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
    } catch (err: any) {
      return { ok: false, error: err.message || String(err) }
    }
  },

  async cfBypass(url: string): Promise<IpcResult<boolean>> {
    try {
      const domain = getDomain(url)
      const existing = CfCookieStore.get(domain)
      if (existing) {
        return { ok: true, value: true }
      }

      // Navigate to the CF bypass screen and wait for the user to solve
      router.push('/cf-bypass')
      const cookie = await CfBypassFlow.start(url)

      if (cookie) {
        return { ok: true, value: true }
      }
      return { ok: false, error: 'Challenge was not completed' }
    } catch (err: any) {
      return { ok: false, error: err.message || String(err) }
    }
  },

  async clearCookies(): Promise<IpcResult<{ success?: boolean; error?: string }>> {
    CfCookieStore.clear()
    return { ok: true, value: { success: true } }
  }
}
