import { WebSocketServer, WebSocket } from 'ws'
import { Bonjour, Service } from 'bonjour-service'
import { AppService, ServicePriority } from './service.registry'
import { identityService } from './identity.service'
import { historyRepo, libraryRepo } from '../db'
import os from 'os'

export class SyncServer implements AppService {
  public priority = ServicePriority.FEATURE
  private wss: WebSocketServer | null = null
  private bonjour: Bonjour | null = null
  private service: Service | null = null
  private port = 42069 // AutaKimi Sync Port
  private isRunning = false

  constructor() {}

  async initialize(): Promise<void> {
    // Identity should already be initialized by ServiceRegistry order
  }

  private startServer(startPort: number, endPort: number): Promise<number> {
    return new Promise((resolve, reject) => {
      let currentPort = startPort

      const tryNext = () => {
        let options: any = { port: currentPort }
        if (currentPort > endPort) {
          console.warn(`[SyncServer] Ports ${startPort}-${endPort} in use, falling back to OS-assigned port...`)
          options = { port: 0 }
        }

        const server = new WebSocketServer(options)

        const onListening = () => {
          server.off('error', onError)
          this.wss = server
          const address = server.address()
          const boundPort = typeof address === 'object' && address !== null ? address.port : currentPort
          this.port = boundPort
          resolve(boundPort)
        }

        const onError = (err: any) => {
          server.off('listening', onListening)
          server.close()
          if (err.code === 'EADDRINUSE' && currentPort <= endPort) {
            console.warn(`[SyncServer] Port ${currentPort} in use, trying next...`)
            currentPort++
            tryNext()
          } else {
            reject(err)
          }
        }

        server.once('listening', onListening)
        server.once('error', onError)
      }

      tryNext()
    })
  }

  async start(): Promise<{ success: boolean; port: number; ip: string }> {
    if (this.isRunning) return { success: true, port: this.port, ip: this.getLocalIp() }

    try {
      await this.startServer(42069, 42079)
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

  private failedAttempts = new Map<string, { count: number; lockedUntil?: number }>()

  private isIpLocked(ip: string): boolean {
    const record = this.failedAttempts.get(ip)
    if (!record) return false
    if (record.lockedUntil && record.lockedUntil > Date.now()) {
      return true
    }
    if (record.lockedUntil && record.lockedUntil <= Date.now()) {
      this.failedAttempts.delete(ip)
    }
    return false
  }

  private recordFailedAttempt(ip: string) {
    const record = this.failedAttempts.get(ip) || { count: 0 }
    record.count += 1
    if (record.count >= 5) {
      record.lockedUntil = Date.now() + 60 * 1000 // Lock for 60 seconds
      console.warn(`[SyncServer] IP ${ip} has been locked out for 60 seconds due to too many failed auth attempts.`)
    }
    this.failedAttempts.set(ip, record)
  }

  private recordSuccessfulAuth(ip: string) {
    this.failedAttempts.delete(ip)
  }

  private setupWss() {
    this.wss?.on('connection', (ws: WebSocket, req: any) => {
      const ip = req?.socket?.remoteAddress || 'unknown'
      console.log(`[SyncServer] New connection attempt from ${ip}`)

      if (this.isIpLocked(ip)) {
        console.warn(`[SyncServer] Connection rejected: IP ${ip} is locked out`)
        ws.close()
        return
      }
      
      ws.on('message', async (data: string) => {
        if (this.isIpLocked(ip)) {
          ws.close()
          return
        }

        if (data && data.length > 64000) {
          console.warn(`[SyncServer] Message from ${ip} rejected: size exceeds 64,000 limit (${data.length} chars)`)
          ws.close()
          return
        }

        try {
          const message = JSON.parse(data)
          await this.handleMessage(ws, message, ip)
        } catch (e) {
          console.error('[SyncServer] Failed to parse message:', e)
        }
      })

      ws.on('close', () => {
        console.log(`[SyncServer] Connection closed from ${ip}`)
      })
    })
  }

  private async handleMessage(ws: WebSocket, message: any, ip: string) {
    switch (message.type) {
      case 'auth':
        if (message.secret === identityService.getSyncSecret()) {
          (ws as any).authenticated = true
          this.recordSuccessfulAuth(ip)
          ws.send(JSON.stringify({ type: 'auth_success', deviceId: identityService.getDeviceId() }))
          console.log('[SyncServer] Client authenticated:', message.id)
        } else {
          this.recordFailedAttempt(ip)
          ws.send(JSON.stringify({ type: 'auth_error', message: 'Invalid secret' }))
          ws.close()
        }
        break
      
      case 'pull_history':
        if (!(ws as any).authenticated) return ws.close()
        try {
          const history = await historyRepo.getHistory(500)
          const filteredHistory = message.lastSynced
            ? history.filter((h) => h.startedAt > message.lastSynced)
            : history
          ws.send(JSON.stringify({ type: 'history_data', data: filteredHistory }))
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

      case 'push_library':
        if (!(ws as any).authenticated) return ws.close()
        try {
          const library = await libraryRepo.getAll()
          const existingIds = new Set(library.map((m) => m.id))
          const pushed = message.data || []
          for (const item of pushed) {
            if (item && !existingIds.has(item.id)) {
              const mangaObj = item.metadata ? JSON.parse(item.metadata) : item
              await libraryRepo.add(mangaObj)
            }
          }
          console.log('[SyncServer] Library push merged successfully')
        } catch (e) {
          console.error('[SyncServer] Failed to merge pushed library:', e)
        }
        break

      case 'push_history':
        if (!(ws as any).authenticated) return ws.close()
        try {
          const desktopHistory = await historyRepo.getHistory(500)
          const existingKeys = new Set(desktopHistory.map((h) => `${h.mangaId}_${h.chapterId}_${h.startedAt}`))
          const pushed = message.data || []
          for (const entry of pushed) {
            const mangaId = entry.mangaId || entry.manga_id
            const chapterId = entry.chapterId || entry.chapter_id
            const startedAt = entry.startedAt || entry.started_at
            if (mangaId && chapterId && startedAt) {
              const key = `${mangaId}_${chapterId}_${startedAt}`
              if (!existingKeys.has(key)) {
                await historyRepo.addEntry({
                  mangaId,
                  mangaTitle: entry.mangaTitle || entry.manga_title,
                  mangaCover: entry.mangaCover || entry.manga_cover,
                  mangaUrl: entry.mangaUrl || entry.manga_url,
                  chapterId,
                  chapterTitle: entry.chapterTitle || entry.chapter_title,
                  startedAt,
                  durationSeconds: entry.durationSeconds || entry.duration_seconds,
                  pkg: entry.pkg,
                  type: entry.type || entry.mediaType
                })
              }
            }
          }
          console.log('[SyncServer] History push merged successfully')
        } catch (e) {
          console.error('[SyncServer] Failed to merge pushed history:', e)
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
      deviceId: identityService.getDeviceId(),
      secret: identityService.getSyncSecret()
    }
  }
}

export const syncServer = new SyncServer()
