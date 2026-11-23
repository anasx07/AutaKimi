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

  private syncState = {
    inProgress: false,
    startTime: null as string | null,
    receivedHistory: false,
    receivedLibrary: false,
    receivedProgress: false,
    expectedAcks: 0,
    receivedAcks: 0,
    onCompleteCallbacks: [] as (() => void)[],
    graceTimer: null as any
  }

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

        let challengeTimer: ReturnType<typeof setTimeout> | null = null
        let challengeReceived = false

        const cleanupChallengeTimer = () => {
          if (challengeTimer) {
            clearTimeout(challengeTimer)
            challengeTimer = null
          }
        }

        this.ws.onopen = () => {
          console.log('[SyncClient] WebSocket opened, waiting for auth challenge...')
          // Reject connection if server does not issue an HMAC auth challenge within 3s
          challengeTimer = setTimeout(() => {
            if (!this.isConnected) {
              console.warn('[SyncClient] No auth challenge received within timeout. Rejecting connection (HMAC required).')
              cleanupChallengeTimer()
              this.ws?.close()
              this.isConnected = false
              this.abortSync()
              resolve(false)
            }
          }, 3000)
        }

        this.ws.onmessage = async (e) => {
          try {
            const message = JSON.parse(e.data)

            if (message.type === 'auth_challenge' && message.challenge) {
              challengeReceived = true
              cleanupChallengeTimer()
              console.log('[SyncClient] Received challenge, replying with HMAC response...')
              const response = await computeHmacResponse(info.secret, message.challenge)
              this.ws?.send(
                JSON.stringify({
                  type: 'auth_response',
                  id: identityService.getDeviceId(),
                  response
                })
              )
              return
            }

            if (!challengeReceived) {
              console.warn('[SyncClient] Unexpected message before auth_challenge, rejecting connection:', message.type)
              cleanupChallengeTimer()
              this.ws?.close()
              this.isConnected = false
              this.abortSync()
              resolve(false)
              return
            }

            await this.handleMessage(message, async (success) => {
              cleanupChallengeTimer()
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
          cleanupChallengeTimer()
          console.error('[SyncClient] WebSocket error:', e)
          this.isConnected = false
          this.abortSync()
          resolve(false)
        }

        this.ws.onclose = () => {
          cleanupChallengeTimer()
          console.log('[SyncClient] WebSocket closed')
          this.isConnected = false
          this.abortSync()
        }
      } catch (err) {
        console.error('[SyncClient] Connection failed:', err)
        resolve(false)
      }
    })
  }

  private abortSync() {
    if (this.syncState.inProgress) {
      console.warn('[SyncClient] Sync aborted due to socket close/error - last_sync_timestamp will not be updated')
      this.syncState.inProgress = false
      if (this.syncState.graceTimer) {
        clearTimeout(this.syncState.graceTimer)
        this.syncState.graceTimer = null
      }
      const cbs = [...this.syncState.onCompleteCallbacks]
      this.syncState.onCompleteCallbacks = []
      cbs.forEach((cb) => cb())
    }
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
        console.log('[SyncClient] Silent background sync connected, waiting for complete data exchange...')
        await this.waitForSyncComplete(25000)
        this.disconnect()
        console.log('[SyncClient] Silent background sync finished cleanly')
      } else {
        console.log('[SyncClient] Background sync failed to connect (device offline/different Wi-Fi).')
      }
    } catch (e) {
      console.error('[SyncClient] Silent background sync error:', e)
    }
  }

  async waitForSyncComplete(timeoutMs = 25000): Promise<boolean> {
    if (!this.syncState.inProgress) {
      return true
    }

    return new Promise((resolve) => {
      let resolved = false
      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true
          console.warn(`[SyncClient] Sync completion wait timed out after ${timeoutMs}ms`)
          resolve(false)
        }
      }, timeoutMs)

      this.syncState.onCompleteCallbacks.push(() => {
        if (!resolved) {
          resolved = true
          clearTimeout(timer)
          resolve(true)
        }
      })
    })
  }

  private async handleMessage(message: any, resolve: (val: boolean) => void) {
    switch (message.type) {
      case 'auth_success':
        console.log('[SyncClient] Authenticated successfully')
        this.isConnected = true

        this.syncState.inProgress = true
        this.syncState.startTime = new Date().toISOString()
        this.syncState.receivedHistory = false
        this.syncState.receivedLibrary = false
        this.syncState.receivedProgress = false
        this.syncState.expectedAcks = 0
        this.syncState.receivedAcks = 0
        if (this.syncState.graceTimer) {
          clearTimeout(this.syncState.graceTimer)
          this.syncState.graceTimer = null
        }

        try {
          const lastSyncedResult = await MobileDB.getSetting('last_sync_timestamp')
          const lastSynced = lastSyncedResult.ok ? lastSyncedResult.value : null

          // Automatically request data after pairing (only delta for history and progress)
          this.ws?.send(
            JSON.stringify({
              type: 'pull_history',
              lastSynced: lastSynced
            })
          )
          this.ws?.send(JSON.stringify({ type: 'pull_library' }))
          this.ws?.send(
            JSON.stringify({
              type: 'pull_progress',
              lastSynced: lastSynced
            })
          )

          // Push local library, history, and reading progress to desktop in chunks
          await this.pushLocalData(lastSynced)
        } catch (err) {
          console.error('[SyncClient] Error during sync start:', err)
          this.ws?.send(JSON.stringify({ type: 'pull_history' }))
          this.ws?.send(JSON.stringify({ type: 'pull_library' }))
          this.ws?.send(JSON.stringify({ type: 'pull_progress' }))
          await this.pushLocalData(null)
        }

        resolve(true)
        await this.checkSyncComplete()
        break

      case 'history_data':
        console.log('[SyncClient] Received history data:', message.data?.length)
        await this.syncHistory(message.data)
        this.syncState.receivedHistory = true
        await this.checkSyncComplete()
        break

      case 'library_data':
        console.log('[SyncClient] Received library data:', message.data?.length)
        await this.syncLibrary(message.data)
        this.syncState.receivedLibrary = true
        await this.checkSyncComplete()
        break

      case 'progress_data':
        console.log('[SyncClient] Received progress data:', message.data?.length)
        await this.syncProgress(message.data)
        this.syncState.receivedProgress = true
        await this.checkSyncComplete()
        break

      case 'push_ack':
        this.syncState.receivedAcks++
        console.log(`[SyncClient] Received push_ack (${this.syncState.receivedAcks}/${this.syncState.expectedAcks})`)
        await this.checkSyncComplete()
        break

      case 'push_error':
        this.syncState.receivedAcks++
        console.warn(`[SyncClient] Push error from server for ${message.target}:`, message.error)
        await this.checkSyncComplete()
        break

      case 'auth_error':
        console.error('[SyncClient] Auth failed:', message.message)
        this.isConnected = false
        this.abortSync()
        resolve(false)
        break

      default:
        console.log('[SyncClient] Received message:', message.type)
    }
  }

  private async checkSyncComplete() {
    if (!this.syncState.inProgress) return

    const pullsDone =
      this.syncState.receivedHistory &&
      this.syncState.receivedLibrary &&
      this.syncState.receivedProgress

    const acksDone = this.syncState.receivedAcks >= this.syncState.expectedAcks

    if (pullsDone && acksDone) {
      await this.finalizeSync()
      return
    }

    // Grace timer: if all pulls arrived, allow up to 3s for remaining push acks (or for older servers that don't send push_ack)
    if (pullsDone && !this.syncState.graceTimer) {
      this.syncState.graceTimer = setTimeout(async () => {
        if (this.syncState.inProgress) {
          console.log('[SyncClient] Pulls completed and push ack grace window elapsed. Finalizing sync...')
          await this.finalizeSync()
        }
      }, 3000)
    }
  }

  private async finalizeSync() {
    if (!this.syncState.inProgress) return
    this.syncState.inProgress = false
    if (this.syncState.graceTimer) {
      clearTimeout(this.syncState.graceTimer)
      this.syncState.graceTimer = null
    }

    if (this.syncState.startTime) {
      await MobileDB.setSetting('last_sync_timestamp', this.syncState.startTime)
      console.log(`[SyncClient] Updated last_sync_timestamp to ${this.syncState.startTime}`)
    }

    const cbs = [...this.syncState.onCompleteCallbacks]
    this.syncState.onCompleteCallbacks = []
    cbs.forEach((cb) => cb())
  }

  private chunkArray<T>(items: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < items.length; i += size) {
      chunks.push(items.slice(i, i + size))
    }
    return chunks
  }

  private async pushLocalData(lastSynced: string | null) {
    try {
      // 1. History (chunk size: 50)
      const historyResult = await MobileDB.getHistory()
      if (historyResult.ok && historyResult.value.length > 0) {
        const filteredHistory = lastSynced
          ? historyResult.value.filter((h) => {
              const start = (h as any).started_at || h.startedAt
              return start && start > lastSynced
            })
          : historyResult.value

        if (filteredHistory.length > 0) {
          const chunks = this.chunkArray(filteredHistory, 50)
          for (let i = 0; i < chunks.length; i++) {
            this.syncState.expectedAcks++
            this.ws?.send(
              JSON.stringify({
                type: 'push_history',
                data: chunks[i],
                batchId: `hist_${i}_${chunks.length}`,
                chunkIndex: i,
                totalChunks: chunks.length
              })
            )
          }
          console.log(`[SyncClient] Pushed ${filteredHistory.length} history items in ${chunks.length} chunks`)
        }
      }

      // 2. Library (chunk size: 25, since metadata JSON per item can be large)
      const libraryResult = await MobileDB.getLibrary()
      if (libraryResult.ok && libraryResult.value.length > 0) {
        const chunks = this.chunkArray(libraryResult.value, 25)
        for (let i = 0; i < chunks.length; i++) {
          this.syncState.expectedAcks++
          this.ws?.send(
            JSON.stringify({
              type: 'push_library',
              data: chunks[i],
              batchId: `lib_${i}_${chunks.length}`,
              chunkIndex: i,
              totalChunks: chunks.length
            })
          )
        }
        console.log(`[SyncClient] Pushed ${libraryResult.value.length} library items in ${chunks.length} chunks`)
      }

      // 3. Progress (chunk size: 50)
      const progressResult = await MobileDB.getAllProgress()
      if (progressResult.ok && progressResult.value.length > 0) {
        const filteredProgress = lastSynced
          ? progressResult.value.filter((p: any) => {
              const updated = p.updated_at || p.updatedAt
              return updated && updated > lastSynced
            })
          : progressResult.value

        if (filteredProgress.length > 0) {
          const chunks = this.chunkArray(filteredProgress, 50)
          for (let i = 0; i < chunks.length; i++) {
            this.syncState.expectedAcks++
            this.ws?.send(
              JSON.stringify({
                type: 'push_progress',
                data: chunks[i],
                batchId: `prog_${i}_${chunks.length}`,
                chunkIndex: i,
                totalChunks: chunks.length
              })
            )
          }
          console.log(`[SyncClient] Pushed ${filteredProgress.length} progress items in ${chunks.length} chunks`)
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

    const existingIds = new Set(libResult.value.map((m) => m.id))
    for (const manga of data) {
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
