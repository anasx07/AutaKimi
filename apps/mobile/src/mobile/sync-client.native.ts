import { identityService } from './identity.native'
import { MobileDB } from './db.native'
import * as Crypto from 'expo-crypto'

export interface SyncConnectionInfo {
  ip: string
  port: number
  secret: string
  deviceId: string
}

async function computeHmacResponse(secret: string, challenge: string): Promise<string> {
  if (typeof globalThis.crypto?.subtle?.importKey === 'function') {
    try {
      const enc = new TextEncoder()
      const key = await globalThis.crypto.subtle.importKey(
        'raw',
        enc.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      )
      const signature = await globalThis.crypto.subtle.sign('HMAC', key, enc.encode(challenge))
      return Array.from(new Uint8Array(signature))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
    } catch (e) {
      console.warn('[SyncClient] crypto.subtle HMAC failed, falling back:', e)
    }
  }

  try {
    return await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `${secret}:${challenge}`
    )
  } catch {
    return secret
  }
}

export class SyncClient {
  private static instance: SyncClient
  private ws: WebSocket | null = null
  private connectionInfo: SyncConnectionInfo | null = null
  private isConnected = false

  private constructor() {}

  public static getInstance(): SyncClient {
    if (!SyncClient.instance) {
      SyncClient.instance = new SyncClient()
    }
    return SyncClient.instance
  }

  async connect(info: SyncConnectionInfo): Promise<boolean> {
    this.connectionInfo = info
    return new Promise((resolve) => {
      try {
        const url = `ws://${info.ip}:${info.port}`
        console.log(`[SyncClient] Connecting to ${url}`)
        this.ws = new WebSocket(url)

        let authFallbackTimer: any = null

        this.ws.onopen = () => {
          console.log('[SyncClient] WebSocket opened, waiting for auth challenge...')
          // Legacy fallback: if server doesn't send challenge within 1s, send legacy auth
          authFallbackTimer = setTimeout(() => {
            if (!this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
              console.log('[SyncClient] No challenge received, falling back to legacy auth...')
              this.ws?.send(JSON.stringify({
                type: 'auth',
                id: identityService.getDeviceId(),
                secret: info.secret
              }))
            }
          }, 1000)
        }

        this.ws.onmessage = async (e) => {
          try {
            const message = JSON.parse(e.data)

            if (message.type === 'auth_challenge' && message.challenge) {
              if (authFallbackTimer) clearTimeout(authFallbackTimer)
              console.log('[SyncClient] Received challenge, replying with HMAC response...')
              const response = await computeHmacResponse(info.secret, message.challenge)
              this.ws?.send(JSON.stringify({
                type: 'auth_response',
                id: identityService.getDeviceId(),
                response
              }))
              return
            }

            this.handleMessage(message, async (success) => {
              if (success) {
                try {
                  await MobileDB.setSetting('last_paired_device', JSON.stringify(info))
                  console.log('[SyncClient] Connection info saved for background sync')
                } catch (err) {
                  console.error('[SyncClient] Failed to save connection info:', err)
                }
              }
              resolve(success)
            })
          } catch (err) {
            console.error('[SyncClient] Failed to parse message:', err)
          }
        }

        this.ws.onerror = (e) => {
          if (authFallbackTimer) clearTimeout(authFallbackTimer)
          console.error('[SyncClient] WebSocket error:', e)
          this.isConnected = false
          resolve(false)
        }

        this.ws.onclose = () => {
          if (authFallbackTimer) clearTimeout(authFallbackTimer)
          console.log('[SyncClient] WebSocket closed')
          this.isConnected = false
        }
      } catch (err) {
        console.error('[SyncClient] Connection failed:', err)
        resolve(false)
      }
    })
  }

  async autoSyncBackground(): Promise<void> {
    try {
      const savedDevice = await MobileDB.getSetting('last_paired_device')
      if (!savedDevice.ok || !savedDevice.value) {
        console.log('[SyncClient] No paired device found for background sync.')
        return
      }

      const info: SyncConnectionInfo = JSON.parse(savedDevice.value)
      console.log('[SyncClient] Found paired device, starting silent background sync...')
      
      const success = await this.connect(info)
      if (success) {
        console.log('[SyncClient] Silent background sync completed successfully!')
        setTimeout(() => {
          this.disconnect()
        }, 5000)
      } else {
        console.log('[SyncClient] Background sync failed to connect (device offline/different Wi-Fi).')
      }
    } catch (e) {
      console.error('[SyncClient] Silent background sync error:', e)
    }
  }

  private async handleMessage(message: any, resolve: (val: boolean) => void) {
    switch (message.type) {
      case 'auth_success':
        console.log('[SyncClient] Authenticated successfully')
        this.isConnected = true
        
        try {
          // Get the last synced timestamp from settings
          const lastSyncedResult = await MobileDB.getSetting('last_sync_timestamp')
          const lastSynced = lastSyncedResult.ok ? lastSyncedResult.value : null
          
          // Automatically request data after pairing (only delta for history and progress)
          this.ws?.send(JSON.stringify({ 
            type: 'pull_history', 
            lastSynced: lastSynced 
          }))
          this.ws?.send(JSON.stringify({ type: 'pull_library' }))
          this.ws?.send(JSON.stringify({ 
            type: 'pull_progress', 
            lastSynced: lastSynced 
          }))
          
          // Push local library, history, and reading progress to desktop for bidirectional syncing!
          await this.pushLocalData(lastSynced)
          
          // After sending the requests, update the last sync timestamp to NOW
          await MobileDB.setSetting('last_sync_timestamp', new Date().toISOString())
        } catch (err) {
          console.error('[SyncClient] Error during sync start:', err)
          // Fallback to full sync if settings retrieval fails
          this.ws?.send(JSON.stringify({ type: 'pull_history' }))
          this.ws?.send(JSON.stringify({ type: 'pull_library' }))
          this.ws?.send(JSON.stringify({ type: 'pull_progress' }))
          await this.pushLocalData(null)
        }
        
        resolve(true)
        break
      
      case 'history_data':
        console.log('[SyncClient] Received history data:', message.data?.length)
        this.syncHistory(message.data)
        break
      
      case 'library_data':
        console.log('[SyncClient] Received library data:', message.data?.length)
        this.syncLibrary(message.data)
        break

      case 'progress_data':
        console.log('[SyncClient] Received progress data:', message.data?.length)
        this.syncProgress(message.data)
        break

      case 'auth_error':
        console.error('[SyncClient] Auth failed:', message.message)
        this.isConnected = false
        resolve(false)
        break
      default:
        console.log('[SyncClient] Received message:', message.type)
    }
  }

  private async pushLocalData(lastSynced: string | null) {
    try {
      const historyResult = await MobileDB.getHistory()
      if (historyResult.ok && historyResult.value.length > 0) {
        // Filter local history to only push items newer than lastSynced
        const filteredHistory = lastSynced
          ? historyResult.value.filter(h => {
              const start = (h as any).started_at || h.startedAt
              return start && start > lastSynced
            })
          : historyResult.value

        if (filteredHistory.length > 0) {
          console.log(`[SyncClient] Pushing local history: ${filteredHistory.length} items (after ${lastSynced})`)
          this.ws?.send(JSON.stringify({ type: 'push_history', data: filteredHistory }))
        }
      }
      
      const libraryResult = await MobileDB.getLibrary()
      if (libraryResult.ok && libraryResult.value.length > 0) {
        console.log(`[SyncClient] Pushing local library: ${libraryResult.value.length} items`)
        this.ws?.send(JSON.stringify({ type: 'push_library', data: libraryResult.value }))
      }

      const progressResult = await MobileDB.getAllProgress()
      if (progressResult.ok && progressResult.value.length > 0) {
        const filteredProgress = lastSynced
          ? progressResult.value.filter((p: any) => {
              const updated = p.updated_at || p.updatedAt
              return updated && updated > lastSynced
            })
          : progressResult.value

        if (filteredProgress.length > 0) {
          console.log(`[SyncClient] Pushing local progress: ${filteredProgress.length} items`)
          this.ws?.send(JSON.stringify({ type: 'push_progress', data: filteredProgress }))
        }
      }
    } catch (e) {
      console.error('[SyncClient] Failed to push local data:', e)
    }
  }

  private async syncProgress(data: any[]) {
    if (!data || !Array.isArray(data)) return
    for (const entry of data) {
      await MobileDB.updateProgress({
        mangaId: entry.mangaId || entry.manga_id,
        chapterId: entry.chapterId || entry.chapter_id,
        isRead: Boolean(entry.isRead ?? entry.is_read),
        lastPage: Number(entry.lastPage ?? entry.last_page ?? 0)
      })
    }
  }

  private async syncHistory(data: any[]) {
    if (!data || !Array.isArray(data)) return
    for (const entry of data) {
      await MobileDB.addHistory(entry)
    }
  }

  private async syncLibrary(data: any[]) {
    if (!data || !Array.isArray(data)) return
    const libResult = await MobileDB.getLibrary()
    if (!libResult.ok) return

    const existingIds = new Set(libResult.value.map(m => m.id))
    for (const manga of data) {
      // Check if already in library to avoid duplicates or unnecessary toggles
      if (!existingIds.has(manga.id)) {
        await MobileDB.toggleLibrary(manga)
      }
    }
  }

  disconnect() {
    this.ws?.close()
    this.isConnected = false
  }

  getIsConnected() {
    return this.isConnected
  }
}

export const syncClient = SyncClient.getInstance()
