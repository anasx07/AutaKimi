import { useUIStore } from '../model/ui.store'
import { getApi, callIpc } from './base'

// Domain-level concurrency lock for Cloudflare bypasses
const activeBypasses = new Map<string, Promise<unknown>>()

export const BypassService = {
  cfBypass: async (url: string, silent = false) => {
    const domain = new URL(url).hostname
    const existing = activeBypasses.get(domain)
    if (existing) return existing

    const { setIsCfBypassing } = useUIStore.getState()
    if (!silent) setIsCfBypassing(true, domain)

    const bypassPromise = (async () => {
      try {
        const result = await Promise.race([
          callIpc(() => getApi().cfBypass(url, silent)),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Bypass timed out after 30s')), 30000)
          )
        ])
        return result
      } finally {
        if (!silent) setIsCfBypassing(false)
        activeBypasses.delete(domain)
      }
    })()

    activeBypasses.set(domain, bypassPromise)
    return bypassPromise
  },
  cfFetchHtml: async (url: string, silent = false) => {
    const domain = new URL(url).hostname
    const existing = activeBypasses.get(domain)
    if (existing) return existing

    const { setIsCfBypassing } = useUIStore.getState()
    if (!silent) setIsCfBypassing(true, domain)

    const fetchPromise = (async () => {
      try {
        const result = (await Promise.race([
          callIpc(() => getApi().cfFetchHtml(url, silent)),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Bypass timed out after 30s')), 30000)
          )
        ])) as string
        return result
      } finally {
        if (!silent) setIsCfBypassing(false)
        activeBypasses.delete(domain)
      }
    })()

    activeBypasses.set(domain, fetchPromise)
    return fetchPromise
  }
}
