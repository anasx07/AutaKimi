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
          this.handleMessage(message, resolve)
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

  private handleMessage(message: any, resolve: (val: boolean) => void) {
    switch (message.type) {
      case 'auth_success':
        console.log('[SyncClient] Authenticated successfully')
        this.isConnected = true
        // Automatically request data after pairing
        this.ws?.send(JSON.stringify({ type: 'pull_history' }))
        this.ws?.send(JSON.stringify({ type: 'pull_library' }))
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

  private async syncHistory(data: any[]) {
    if (!data || !Array.isArray(data)) return
    for (const entry of data) {
      await MobileDB.addHistory(entry)
    }
  }

  private async syncLibrary(data: any[]) {
    if (!data || !Array.isArray(data)) return
    for (const manga of data) {
      // Check if already in library to avoid duplicates or unnecessary toggles
      const lib = await MobileDB.getLibrary()
      if (lib.ok && !lib.value.find(m => m.id === manga.id)) {
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
