import { session } from 'electron'
import { IpcChannel } from '../types/ipc'
import { extensionOrchestrator } from '../services/extension.service'
import { NetworkConfig } from '@common/config/network'
import { registerHandler, wrapIpc, isValidUrl } from './utils'
import { cacheManager, CacheGroup } from '../services/cache.service'
import { streamProxyService } from '../services/stream-proxy.service'

export function registerNetworkHandlers() {
  registerHandler(
    IpcChannel.FETCH_REPO,
    wrapIpc(async (_, url: string) => {
      if (typeof url !== 'string' || !isValidUrl(url)) throw new Error('Invalid URL')
      const headers = { 'User-Agent': NetworkConfig.DEFAULT_UA }
      const response = await extensionOrchestrator.fetch(url, { headers })
      if (!response.ok)
        throw new Error(`Failed to fetch repo: ${response.status} ${response.statusText}`)
      return response.json()
    })
  )

  registerHandler(
    IpcChannel.FETCH_TEXT,
    wrapIpc(async (_, url: string, options?: any) => {
      if (typeof url !== 'string' || !isValidUrl(url)) throw new Error('Invalid URL')
      if (options !== undefined && typeof options !== 'object') throw new Error('Invalid options')
      console.log(`[FetchText] → ${url}`)
      try {
        const response = await extensionOrchestrator.fetch(url, options || {})
        const data = await response.text()
        console.log(`[FetchText] ← ${url} status=${response.status} bodyLen=${data.length}`)

        // Ensure only serializable data is returned
        return {
          data,
          status: Number(response.status),
          ok: Boolean(response.ok)
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error(`[FetchText] ✗ ${url}:`, msg)
        throw e
      }
    })
  )

  registerHandler(
    IpcChannel.CLEAR_CACHE,
    wrapIpc(async () => {
      const cfSession = session.fromPartition('persist:cloudflare')
      await Promise.all([
        session.defaultSession.clearCache(),
        cfSession.clearCache()
      ])
      await cacheManager.invalidate(CacheGroup.IMAGES)
      await cacheManager.cleanup() // Trigger global cleanup
      return { success: true }
    })
  )

  registerHandler(
    IpcChannel.CLEAR_COOKIES,
    wrapIpc(async () => {
      const cfSession = session.fromPartition('persist:cloudflare')
      await Promise.all([
        session.defaultSession.clearStorageData({ storages: ['cookies'] }),
        cfSession.clearStorageData({ storages: ['cookies'] })
      ])
      return { success: true }
    })
  )

  registerHandler(
    IpcChannel.SET_STREAM_HEADERS,
    wrapIpc(async (_, args: { url: string; headers: Record<string, string> }) => {
      if (!args || typeof args !== 'object') throw new Error('Invalid arguments')
      const { url, headers } = args
      if (typeof url !== 'string' || !headers || typeof headers !== 'object') {
        throw new Error('Invalid stream headers payload')
      }
      streamProxyService.setStreamHeaders(url, headers)
      return true
    })
  )

  registerHandler(
    IpcChannel.PROBE_STREAM,
    wrapIpc(
      async (
        _,
        args: { url: string; headers?: Record<string, string>; timeoutMs?: number }
      ) => {
        if (!args || typeof args !== 'object') throw new Error('Invalid arguments')
        const { url, headers = {}, timeoutMs = 2500 } = args
        if (typeof url !== 'string' || !isValidUrl(url)) {
          return { alive: false, status: 0, pingMs: 0, error: 'Invalid URL' }
        }

        const startTime = Date.now()
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), timeoutMs)

        try {
          const lowerUrl = url.toLowerCase()
          const isHls =
            lowerUrl.includes('.m3u8') ||
            lowerUrl.includes('hls_proxy') ||
            lowerUrl.includes('mode=m3u8')
          const reqHeaders: Record<string, string> = {
            'User-Agent': NetworkConfig.DEFAULT_UA,
            Accept: '*/*',
            ...headers
          }

          // For video chunks / mp4, use Range to probe without downloading the full file
          if (!isHls && !reqHeaders['Range']) {
            reqHeaders['Range'] = 'bytes=0-1024'
          }

          if (!reqHeaders['Referer']) {
            if (lowerUrl.includes('vidmoly') || lowerUrl.includes('staticmoly') || lowerUrl.includes('moly')) {
              reqHeaders['Referer'] = 'https://vidmoly.to/'
            } else if (lowerUrl.includes('uqload')) {
              reqHeaders['Referer'] = 'https://uqload.vc/'
            } else if (lowerUrl.includes('mp4upload')) {
              reqHeaders['Referer'] = 'https://www.mp4upload.com/'
            } else if (lowerUrl.includes('anime4up')) {
              reqHeaders['Referer'] = 'https://anime4up.quest/'
            } else {
              try {
                const parsed = new URL(url)
                reqHeaders['Referer'] = `${parsed.protocol}//${parsed.host}/`
              } catch {}
            }
          }

          let response: Response | null = null

          try {
            response = await fetch(url, {
              method: isHls ? 'GET' : 'HEAD',
              headers: reqHeaders,
              signal: controller.signal,
              redirect: 'follow'
            })
          } catch {
            response = await fetch(url, {
              method: 'GET',
              headers: reqHeaders,
              signal: controller.signal,
              redirect: 'follow'
            })
          } finally {
            clearTimeout(timer)
          }

          const pingMs = Date.now() - startTime
          const status = response.status
          let alive = response.ok || status === 206 || status === 416 || (status >= 200 && status < 400)

          if (alive && status === 200) {
            try {
              const contentType = (response.headers.get('content-type') || '').toLowerCase()
              if (contentType.includes('text/html')) {
                const text = await response.text()
                const lower = text.toLowerCase()
                if (
                  lower.includes('the embed could not be loaded') ||
                  lower.includes('file was deleted') ||
                  lower.includes('video not found') ||
                  lower.includes('video has been removed') ||
                  lower.includes('404 not found') ||
                  lower.includes('eblock.php') ||
                  lower.includes('هذا السيرفر غير متاح') ||
                  lower.includes('تم حذف الملف من المصدر') ||
                  lower.includes('anime4up_server_dead') ||
                  lower.includes('no longer here') ||
                  lower.includes('expired or been removed') ||
                  lower.includes('domain protected') ||
                  lower.includes('we are sorry') ||
                  lower.includes('file was removed') ||
                  lower.includes('file not found') ||
                  lower.includes('video is unavailable') ||
                  lower.includes('verify you\'re a human') ||
                  lower.includes('we\'re sorry')
                ) {
                  alive = false
                }
              }
            } catch {}
          }

          return {
            alive,
            status,
            pingMs,
            error: alive ? undefined : `HTTP ${status}`
          }
        } catch (err: any) {
          clearTimeout(timer)
          const pingMs = Date.now() - startTime
          return {
            alive: false,
            status: 0,
            pingMs,
            error:
              err.name === 'AbortError'
                ? 'Timeout (server stalled)'
                : err.message || 'Connection error'
          }
        }
      }
    )
  )
}

