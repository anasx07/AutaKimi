import { identityService } from './identity.native'
import { MobileDB } from './db.native'

export interface SyncConnectionInfo {
  ip: string
  port: number
  secret: string
  deviceId: string
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

        this.ws.onopen = () => {
          console.log('[SyncClient] WebSocket opened, authenticating...')
          this.ws?.send(JSON.stringify({
            type: 'auth',
            id: identityService.getDeviceId(),
            secret: info.secret
          }))
        }

        this.ws.onmessage = (e) => {
          const message = JSON.parse(e.data)
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
        }

        this.ws.onerror = (e) => {
          console.error('[SyncClient] WebSocket error:', e)
          this.isConnected = false
          resolve(false)
        }

        this.ws.onclose = () => {
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
          
          // Automatically request data after pairing (only delta for history)
          this.ws?.send(JSON.stringify({ 
            type: 'pull_history', 
            lastSynced: lastSynced 
          }))
          this.ws?.send(JSON.stringify({ type: 'pull_library' }))
          
          // Push local library and history to desktop for bidirectional syncing!
          await this.pushLocalData(lastSynced)
          
          // After sending the requests, update the last sync timestamp to NOW
          await MobileDB.setSetting('last_sync_timestamp', new Date().toISOString())
        } catch (err) {
          console.error('[SyncClient] Error during sync start:', err)
          // Fallback to full sync if settings retrieval fails
          this.ws?.send(JSON.stringify({ type: 'pull_history' }))
          this.ws?.send(JSON.stringify({ type: 'pull_library' }))
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
    } catch (e) {
      console.error('[SyncClient] Failed to push local data:', e)
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
