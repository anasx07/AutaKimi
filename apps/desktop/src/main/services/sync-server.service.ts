import { WebSocketServer, WebSocket } from 'ws'
import { Bonjour, Service } from 'bonjour-service'
import { AppService } from './service.registry'
import { identityService } from './identity.service'
import { historyRepo, libraryRepo } from '../db'
import os from 'os'

export class SyncServer implements AppService {
  private static instance: SyncServer
  private wss: WebSocketServer | null = null
  private bonjour: Bonjour | null = null
  private service: Service | null = null
  private port = 42069 // AutaKimi Sync Port
  private isRunning = false

  private constructor() {}

  public static getInstance(): SyncServer {
    if (!SyncServer.instance) {
      SyncServer.instance = new SyncServer()
    }
    return SyncServer.instance
  }

  setWebContents(_webContents: Electron.WebContents) {
    // webContents currently unused for sync server events
  }

  async initialize(): Promise<void> {
    // Identity should already be initialized by ServiceRegistry order
  }

  async start(): Promise<{ success: boolean; port: number; ip: string }> {
    if (this.isRunning) return { success: true, port: this.port, ip: this.getLocalIp() }

    try {
      this.wss = new WebSocketServer({ port: this.port })
      this.setupWss()

      this.bonjour = new Bonjour()
      this.service = this.bonjour.publish({
        name: `AutaKimi-${identityService.getDeviceId().substring(0, 8)}`,
        type: 'autakimi-sync',
        port: this.port,
        txt: {
          id: identityService.getDeviceId()
        }
      })

      this.isRunning = true
      console.log(`[SyncServer] Started on port ${this.port}`)
      return { success: true, port: this.port, ip: this.getLocalIp() }
    } catch (err) {
      console.error('[SyncServer] Failed to start:', err)
      return { success: false, port: 0, ip: '' }
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return

    if (this.service && 'stop' in this.service) {
      (this.service as any).stop()
    }
    this.bonjour?.destroy()
    this.wss?.close()
    
    this.isRunning = false
    console.log('[SyncServer] Stopped')
  }

  async shutdown(): Promise<void> {
    await this.stop()
  }

  private setupWss() {
    this.wss?.on('connection', (ws: WebSocket) => {
      console.log('[SyncServer] New connection attempt')
      
      ws.on('message', async (data: string) => {
        try {
          const message = JSON.parse(data)
          await this.handleMessage(ws, message)
        } catch (e) {
          console.error('[SyncServer] Failed to parse message:', e)
        }
      })

      ws.on('close', () => {
        console.log('[SyncServer] Connection closed')
      })
    })
  }

  private async handleMessage(ws: WebSocket, message: any) {
    switch (message.type) {
      case 'auth':
        if (message.secret === identityService.getSyncSecret()) {
          (ws as any).authenticated = true
          ws.send(JSON.stringify({ type: 'auth_success', deviceId: identityService.getDeviceId() }))
          console.log('[SyncServer] Client authenticated:', message.id)
        } else {
          ws.send(JSON.stringify({ type: 'auth_error', message: 'Invalid secret' }))
          ws.close()
        }
        break
      
      case 'pull_history':
        if (!(ws as any).authenticated) return ws.close()
        try {
          const history = await historyRepo.getHistory(100)
          ws.send(JSON.stringify({ type: 'history_data', data: history }))
        } catch (e) {
          console.error('[SyncServer] Failed to fetch history for sync:', e)
        }
        break

      case 'pull_library':
        if (!(ws as any).authenticated) return ws.close()
        try {
          const library = await libraryRepo.getAll()
          ws.send(JSON.stringify({ type: 'library_data', data: library }))
        } catch (e) {
          console.error('[SyncServer] Failed to fetch library for sync:', e)
        }
        break
      
      default:
        if (!(ws as any).authenticated) {
          ws.close()
          return
        }
        console.log('[SyncServer] Received authenticated message:', message.type)
    }
  }

  private getLocalIp(): string {
    const interfaces = os.networkInterfaces()
    for (const devName in interfaces) {
      const iface = interfaces[devName]
      if (!iface) continue
      for (let i = 0; i < iface.length; i++) {
        const alias = iface[i]
        if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
          return alias.address
        }
      }
    }
    return '0.0.0.0'
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      port: this.port,
      ip: this.getLocalIp(),
      deviceId: identityService.getDeviceId()
    }
  }
}

export const syncServer = SyncServer.getInstance()
