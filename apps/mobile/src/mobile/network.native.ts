import { IpcResult, FetchOptions, FetchResult, networkClient } from '@autakimi/sdk'
import { mobileBypassProvider } from './bypass.native'
import { CfCookieStore } from './cf-cookies'

let cfStatusCallback: ((data: { status: 'started' | 'completed' | 'failed'; domain?: string }) => void) | null = null

export function setCfStatusCallback(cb: typeof cfStatusCallback): void {
  cfStatusCallback = cb
}

function emitCfStatus(status: 'started' | 'completed' | 'failed', domain?: string): void {
  if (cfStatusCallback) cfStatusCallback({ status, domain })
}

export const MobileNetwork = {
  async fetchRepo(url: string): Promise<IpcResult<any>> {
    try {
      const response = await networkClient.fetch(url)
      if (response.ok) {
        const data = await response.value.json()
        return { ok: true, value: data }
      }
      return { ok: false, error: response.error }
    } catch (err: any) {
      return { ok: false, error: err.message || String(err) }
    }
  },

  async fetchText(url: string, options?: FetchOptions): Promise<IpcResult<FetchResult>> {
    try {
      const response = await networkClient.fetch(url, {
        method: options?.method || 'GET',
        headers: options?.headers as any,
        body: options?.body
          ? typeof options.body === 'string'
            ? options.body
            : JSON.stringify(options.body)
          : undefined
      })

      if (response.ok) {
        const data = await response.value.text()
        return {
          ok: true,
          value: {
            data,
            status: response.value.status,
            ok: response.value.ok
          }
        }
      }
      return { ok: false, error: response.error }
    } catch (err: any) {
      return { ok: false, error: err.message || String(err) }
    }
  },

  async cfBypass(url: string): Promise<IpcResult<boolean>> {
    try {
      const domain = new URL(url).hostname
      emitCfStatus('started', domain)
      const res = await mobileBypassProvider.resolveChallenge(url)
      if (res.ok) {
        emitCfStatus('completed', domain)
        return { ok: true, value: true }
      }
      emitCfStatus('failed', domain)
      return { ok: false, error: res.error }
    } catch (err: any) {
      emitCfStatus('failed')
      return { ok: false, error: err.message || String(err) }
    }
  },

  async clearCookies(): Promise<IpcResult<{ success?: boolean; error?: string }>> {
    CfCookieStore.clear()
    return { ok: true, value: { success: true } }
  }
}
