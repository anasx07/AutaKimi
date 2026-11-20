import { WebSocketServer, WebSocket } from 'ws'
import { Bonjour, Service } from 'bonjour-service'
import { AppService, ServicePriority } from './service.registry'
import { identityService } from './identity.service'
import { historyRepo, libraryRepo, progressRepo } from '../db'
import os from 'os'
import crypto from 'crypto'

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

      // Generate cryptographically random challenge for HMAC authentication
      const challenge = crypto.randomBytes(32).toString('hex')
      ;(ws as any).challenge = challenge
      try {
        ws.send(JSON.stringify({ type: 'auth_challenge', challenge }))
      } catch (e) {
        console.error('[SyncServer] Failed to send auth challenge:', e)
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
      case 'auth_response': {
        const challenge = (ws as any).challenge
        if (!challenge) {
          this.recordFailedAttempt(ip)
          ws.send(JSON.stringify({ type: 'auth_error', message: 'No challenge issued' }))
          ws.close()
          break
        }

        const expectedSecret = identityService.getSyncSecret() || ''
        const expectedHmac = crypto
          .createHmac('sha256', expectedSecret)
          .update(challenge)
          .digest('hex')

        const expectedHashFallback = crypto
          .createHash('sha256')
          .update(`${expectedSecret}:${challenge}`)
          .digest('hex')

        const providedResponse = typeof message.response === 'string' ? message.response : ''
        const providedBuf = Buffer.from(providedResponse, 'utf-8')

        let isMatch = false
        const hmacBuf = Buffer.from(expectedHmac, 'utf-8')
        if (providedBuf.length > 0 && providedBuf.length === hmacBuf.length) {
          isMatch = crypto.timingSafeEqual(providedBuf, hmacBuf)
        }
        if (!isMatch) {
          const fallbackBuf = Buffer.from(expectedHashFallback, 'utf-8')
          if (providedBuf.length > 0 && providedBuf.length === fallbackBuf.length) {
            isMatch = crypto.timingSafeEqual(providedBuf, fallbackBuf)
          }
        }

        // Clear challenge once verified
        delete (ws as any).challenge

        if (isMatch) {
          (ws as any).authenticated = true
          this.recordSuccessfulAuth(ip)
          ws.send(JSON.stringify({ type: 'auth_success', deviceId: identityService.getDeviceId() }))
          console.log('[SyncServer] Client authenticated via HMAC challenge-response:', message.id)
        } else {
          this.recordFailedAttempt(ip)
          ws.send(JSON.stringify({ type: 'auth_error', message: 'Invalid HMAC response' }))
          ws.close()
        }
        break
      }

      case 'auth': {
        delete (ws as any).challenge
        const expectedSecret = identityService.getSyncSecret() || ''
        const providedSecret = typeof message.secret === 'string' ? message.secret : ''
        const expectedBuf = Buffer.from(expectedSecret, 'utf-8')
        const providedBuf = Buffer.from(providedSecret, 'utf-8')

        const isMatch =
          expectedBuf.length > 0 &&
          expectedBuf.length === providedBuf.length &&
          crypto.timingSafeEqual(expectedBuf, providedBuf)

        if (isMatch) {
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
      }
      
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

      case 'pull_progress':
        if (!(ws as any).authenticated) return ws.close()
        try {
          const allProgress = await progressRepo.getAllProgress()
          const filtered = message.lastSynced
            ? allProgress.filter((p) => p.updatedAt && p.updatedAt > message.lastSynced)
            : allProgress
          ws.send(JSON.stringify({ type: 'progress_data', data: filtered }))
        } catch (e) {
          console.error('[SyncServer] Failed to fetch progress for sync:', e)
        }
        break

      case 'push_progress':
        if (!(ws as any).authenticated) return ws.close()
        try {
          const pushed = message.data || []
          for (const entry of pushed) {
            const mangaId = entry.mangaId || entry.manga_id
            const chapterId = entry.chapterId || entry.chapter_id
            if (mangaId && chapterId) {
              await progressRepo.updateProgress({
                mangaId,
                chapterId,
                isRead: Boolean(entry.isRead ?? entry.is_read),
                lastPage: Number(entry.lastPage ?? entry.last_page ?? 0),
                updatedAt: entry.updatedAt || entry.updated_at
              })
            }
          }
          console.log(`[SyncServer] Progress push merged successfully: ${pushed.length} items`)
        } catch (e) {
          console.error('[SyncServer] Failed to merge pushed progress:', e)
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
