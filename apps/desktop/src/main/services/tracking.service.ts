import { BrowserWindow, net, safeStorage } from 'electron'
import { trackerRepo, settingsRepo, chapterRepo } from '../db'
import { AniListUser, AniListMedia } from '@common/types'
import { AppService, ServicePriority } from './service.registry'

const ANILIST_CLIENT_ID = '16329'
const ANILIST_GRAPHQL_ENDPOINT = 'https://graphql.anilist.co'

export class TrackingService implements AppService {
  public priority = ServicePriority.FEATURE
  private mediaCache = new Map<number, AniListMedia>()
  private isProcessingQueue = false
  private queueInterval: NodeJS.Timeout | null = null

  constructor() {
    this.startQueueTimer()
  }

  private startQueueTimer(): void {
    if (!this.queueInterval) {
      // Periodically process offline retry queue (every 45s)
      this.queueInterval = setInterval(() => {
        this.processRetryQueue().catch(() => {})
      }, 45000)
    }
  }

  public async initialize(): Promise<void> {
    this.startQueueTimer()
  }

  public async shutdown(): Promise<void> {
    this.destroy()
  }

  /**
   * Encrypt and store AniList access token
   */
  private async saveToken(token: string): Promise<void> {
    if (!token) {
      await settingsRepo.set('anilist_token', '')
      return
    }

    try {
      if (safeStorage.isEncryptionAvailable()) {
        const encrypted = safeStorage.encryptString(token)
        await settingsRepo.set('anilist_token', `enc:${encrypted.toString('base64')}`)
        return
      }
    } catch (err) {
      console.warn(
        '[TrackingService] safeStorage encryption failed, falling back to plaintext:',
        err
      )
    }

    await settingsRepo.set('anilist_token', token)
  }

  /**
   * Retrieve and decrypt AniList access token
   */
  private async getToken(): Promise<string | null> {
    const raw = await settingsRepo.get('anilist_token')
    if (!raw) return null

    if (raw.startsWith('enc:')) {
      try {
        if (safeStorage.isEncryptionAvailable()) {
          const buffer = Buffer.from(raw.slice(4), 'base64')
          return safeStorage.decryptString(buffer)
        } else {
          console.warn('[TrackingService] safeStorage is not available to decrypt token')
          return null
        }
      } catch (err) {
        console.error('[TrackingService] Failed to decrypt anilist_token:', err)
        return null
      }
    }

    // Auto-migrate legacy unencrypted token to encrypted format
    try {
      if (safeStorage.isEncryptionAvailable()) {
        await this.saveToken(raw)
      }
    } catch {}

    return raw
  }

  /**
   * Clear stored AniList access token
   */
  private async clearToken(): Promise<void> {
    await settingsRepo.set('anilist_token', '')
  }

  /**
   * Helper to check whether an error is caused by missing internet or network failure
   */
  private isNetworkOrOfflineError(error: any): boolean {
    if (!error) return false
    if (typeof net !== 'undefined' && net.isOnline && !net.isOnline()) return true

    const msg = String(error?.message || error || '').toLowerCase()
    const code = String(error?.code || error?.cause?.code || '').toLowerCase()

    return (
      msg.includes('fetch failed') ||
      msg.includes('network') ||
      msg.includes('enotfound') ||
      msg.includes('econnrefused') ||
      msg.includes('etimedout') ||
      msg.includes('eai_again') ||
      msg.includes('offline') ||
      msg.includes('abort') ||
      code.includes('enotfound') ||
      code.includes('econnrefused') ||
      code.includes('etimedout') ||
      code.includes('eai_again')
    )
  }

  /**
   * Helper to execute GraphQL queries/mutations against AniList
   */
  private async queryAniList<T = any>(
    query: string,
    variables: Record<string, any> = {},
    token?: string
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const response = await fetch(ANILIST_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables })
    })

    if (!response.ok && response.status !== 400) {
      throw new Error(`AniList HTTP ${response.status}: ${response.statusText}`)
    }

    const json = (await response.json()) as { data?: T; errors?: Array<{ message: string }> }
    if (json.errors && json.errors.length > 0) {
      throw new Error(json.errors[0]?.message || 'AniList API Error')
    }
    return json.data as T
  }

  /**
   * Opens an OAuth popup window to authenticate the user with AniList.
   */
  async loginAniList(): Promise<{ token: string; user: AniListUser }> {
    return new Promise((resolve, reject) => {
      const authUrl = `https://anilist.co/api/v2/oauth/authorize?client_id=${ANILIST_CLIENT_ID}&response_type=token`

      const authWindow = new BrowserWindow({
        width: 600,
        height: 750,
        show: true,
        autoHideMenuBar: true,
        title: 'Sign in with AniList',
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      })

      let isDone = false

      const extractToken = (url: string) => {
        if (!url) return
        const match = url.match(/[#?&]access_token=([^&]+)/)
        if (match && match[1]) {
          isDone = true
          const token = match[1]

          // Fetch authenticated user info
          this.fetchViewer(token)
            .then(async (user) => {
              await this.saveToken(token)
              await settingsRepo.set('anilist_user', JSON.stringify(user))
              authWindow.close()
              this.processRetryQueue().catch(() => {})
              resolve({ token, user })
            })
            .catch((err) => {
              authWindow.close()
              reject(err)
            })
        }
      }

      authWindow.webContents.on('will-navigate', (_event, url) => {
        extractToken(url)
      })

      authWindow.webContents.on('will-redirect', (_event, url) => {
        extractToken(url)
      })

      authWindow.webContents.on('did-navigate', (_event, url) => {
        extractToken(url)
      })

      authWindow.on('closed', () => {
        if (!isDone) {
          reject(new Error('Authentication window closed by user'))
        }
      })

      authWindow.loadURL(authUrl).catch((err) => {
        if (!isDone) reject(err)
      })
    })
  }

  /**
   * Set AniList access token manually (e.g. from personal access token / pin)
   */
  async setAniListToken(token: string): Promise<AniListUser> {
    const user = await this.fetchViewer(token)
    await this.saveToken(token)
    await settingsRepo.set('anilist_user', JSON.stringify(user))
    this.processRetryQueue().catch(() => {})
    return user
  }

  /**
   * Fetch current authenticated viewer profile from AniList
   */
  private async fetchViewer(token: string): Promise<AniListUser> {
    const query = `
      query {
        Viewer {
          id
          name
          avatar {
            large
            medium
          }
        }
      }
    `
    const data = await this.queryAniList<{ Viewer: AniListUser }>(query, {}, token)
    if (!data?.Viewer) throw new Error('Failed to retrieve AniList user profile.')
    return data.Viewer
  }

  /**
   * Get cached or stored AniList user profile
   */
  async getAniListUser(): Promise<AniListUser | null> {
    const token = await this.getToken()
    if (!token) return null

    const cached = await settingsRepo.get('anilist_user')
    if (cached) {
      try {
        return JSON.parse(cached)
      } catch {}
    }

    try {
      const user = await this.fetchViewer(token)
      await settingsRepo.set('anilist_user', JSON.stringify(user))
      return user
    } catch {
      return null
    }
  }

  /**
   * Disconnect AniList account
   */
  async logoutAniList(): Promise<void> {
    await this.clearToken()
    await settingsRepo.set('anilist_user', '')
  }

  /**
   * Search Anime or Manga on AniList
   */
  async searchAniList(search: string, type: 'ANIME' | 'MANGA' = 'MANGA'): Promise<AniListMedia[]> {
    const query = `
      query ($search: String, $type: MediaType) {
        Page(page: 1, perPage: 15) {
          media(search: $search, type: $type) {
            id
            idMal
            title {
              romaji
              english
              native
            }
            coverImage {
              large
              medium
            }
            type
            format
            status
            episodes
            chapters
          }
        }
      }
    `
    const data = await this.queryAniList<{ Page: { media: AniListMedia[] } }>(query, {
      search,
      type
    })
    const list = data?.Page?.media || []
    for (const item of list) {
      if (item && item.id) {
        this.mediaCache.set(item.id, item)
      }
    }
    return list
  }

  /**
   * Retrieve AniList media details along with current user list progress
   */
  async getAniListMedia(mediaId: number): Promise<AniListMedia | null> {
    const token = await this.getToken()
    const query = `
      query ($mediaId: Int) {
        Media(id: $mediaId) {
          id
          idMal
          title {
            romaji
            english
            native
          }
          coverImage {
            large
            medium
          }
          type
          format
          status
          episodes
          chapters
          mediaListEntry {
            id
            status
            score(format: POINT_100)
            progress
          }
        }
      }
    `
    const data = await this.queryAniList<{ Media: AniListMedia }>(
      query,
      { mediaId },
      token || undefined
    )
    if (data?.Media) {
      this.mediaCache.set(mediaId, data.Media)
    }
    return data?.Media || null
  }

  /**
   * Resolves smart status: if targetNumber equals or exceeds media.chapters / episodes, sets status to 'COMPLETED'.
   */
  async resolveSmartStatus(
    mediaId: number,
    targetNumber: number,
    currentStatus?: string
  ): Promise<string> {
    let resolvedStatus = currentStatus || 'CURRENT'
    try {
      let media = this.mediaCache.get(mediaId)
      if (!media && (typeof net === 'undefined' || !net.isOnline || net.isOnline())) {
        const remote = await this.getAniListMedia(mediaId)
        if (remote) {
          media = remote
          this.mediaCache.set(mediaId, remote)
        }
      }

      const totalChapters = media?.chapters || media?.episodes
      if (totalChapters && targetNumber >= totalChapters) {
        resolvedStatus = 'COMPLETED'
      }
    } catch (err) {
      console.warn('[TrackingService] Could not resolve media chapters for smart status:', err)
    }
    return resolvedStatus
  }

  /**
   * Update media list entry on AniList (Status, Progress, Score)
   */
  async updateAniListMedia(
    mediaId: number,
    status?: string,
    progress?: number,
    score?: number
  ): Promise<any> {
    const token = await this.getToken()
    if (!token) throw new Error('AniList account is not connected.')

    // Smart Status auto-completion check if progress is passed
    let finalStatus = status
    if (progress !== undefined && progress > 0 && finalStatus !== 'COMPLETED') {
      finalStatus = await this.resolveSmartStatus(mediaId, progress, finalStatus)
    }

    const mutation = `
      mutation ($mediaId: Int, $status: MediaListStatus, $progress: Int, $scoreRaw: Int) {
        SaveMediaListEntry(mediaId: $mediaId, status: $status, progress: $progress, scoreRaw: $scoreRaw) {
          id
          mediaId
          status
          score(format: POINT_100)
          progress
        }
      }
    `
    const variables: Record<string, any> = { mediaId }
    if (finalStatus) variables.status = finalStatus
    if (progress !== undefined) variables.progress = progress
    if (score !== undefined && score !== null && score > 0) variables.scoreRaw = score

    try {
      const data = await this.queryAniList(mutation, variables, token)
      // On success, process any pending offline queue items in background
      this.processRetryQueue().catch(() => {})
      return data?.SaveMediaListEntry
    } catch (err: any) {
      if (this.isNetworkOrOfflineError(err) && progress !== undefined) {
        console.log(
          `[TrackingService] Network error in updateAniListMedia. Enqueuing update for media ${mediaId} -> progress ${progress}`
        )
        const tracker = await trackerRepo.getTrackerByRemoteId(String(mediaId), 'anilist')
        await trackerRepo.enqueueSync({
          mangaId: tracker?.mangaId || String(mediaId),
          mediaId,
          status: finalStatus,
          progress,
          score: score && score > 0 ? score : undefined,
          lastError: err.message || 'Offline'
        })
      }
      throw err
    }
  }

  /**
   * Auto-sync chapter or episode progress to AniList
   * Triggers when markChapterRead executes and autoMarkRead is enabled
   */
  async handleAutoSync(
    mangaId: string,
    chapterId: string,
    passedChapterNumber?: number
  ): Promise<void> {
    try {
      const autoMarkRead = await settingsRepo.get('auto_mark_read')
      if (autoMarkRead === 'false') return

      const token = await this.getToken()
      if (!token) return

      const tracker = await trackerRepo.getTracker(mangaId, 'anilist')
      if (!tracker || !tracker.remoteId) return

      let chapterNum = passedChapterNumber
      if (chapterNum === undefined) {
        const chapters = await chapterRepo.getByManga(mangaId)
        const matched = chapters.find((c) => c.id === chapterId)
        if (matched) {
          const parsed = parseFloat(String(matched.number))
          if (!isNaN(parsed)) chapterNum = parsed
          else {
            // Try extracting number from title if chapter.number is non-numeric
            const titleMatch = String(matched.title || '').match(/(\d+(?:\.\d+)?)/)
            if (titleMatch) chapterNum = parseFloat(titleMatch[1])
          }
        }
      }

      if (chapterNum !== undefined && !isNaN(chapterNum)) {
        const targetNumber = Math.floor(chapterNum)
        const lastSynced = tracker.lastSyncedChapter || 0

        if (targetNumber > lastSynced) {
          const remoteMediaId = parseInt(tracker.remoteId)
          const targetStatus = await this.resolveSmartStatus(
            remoteMediaId,
            targetNumber,
            tracker.status || 'CURRENT'
          )

          // 1. If currently offline, queue update immediately without failing
          const isOffline = typeof net !== 'undefined' && net.isOnline ? !net.isOnline() : false
          if (isOffline) {
            console.log(
              `[TrackingService] Device is offline. Queuing AniList update for media ${remoteMediaId} -> progress ${targetNumber} (status: ${targetStatus})`
            )
            await trackerRepo.enqueueSync({
              mangaId,
              mediaId: remoteMediaId,
              status: targetStatus,
              progress: targetNumber,
              score: tracker.score && tracker.score > 0 ? tracker.score : undefined,
              lastError: 'Device is offline'
            })
            await trackerRepo.updateSyncedChapter(mangaId, 'anilist', targetNumber)
            if (targetStatus === 'COMPLETED' && tracker.status !== 'COMPLETED') {
              await trackerRepo.saveTracker({
                mangaId,
                provider: 'anilist',
                remoteId: tracker.remoteId,
                status: 'COMPLETED',
                score: tracker.score,
                lastSyncedChapter: targetNumber
              })
            }
            return
          }

          // 2. Online: attempt live sync with retry queue fallback
          try {
            console.log(
              `[TrackingService] Auto-syncing manga ${mangaId} to AniList media ${tracker.remoteId} -> progress ${targetNumber} (status: ${targetStatus})`
            )
            await this.updateAniListMedia(
              remoteMediaId,
              targetStatus,
              targetNumber,
              tracker.score && tracker.score > 0 ? tracker.score : undefined
            )
            await trackerRepo.updateSyncedChapter(mangaId, 'anilist', targetNumber)
            if (targetStatus === 'COMPLETED' && tracker.status !== 'COMPLETED') {
              await trackerRepo.saveTracker({
                mangaId,
                provider: 'anilist',
                remoteId: tracker.remoteId,
                status: 'COMPLETED',
                score: tracker.score,
                lastSyncedChapter: targetNumber
              })
            }
            // Trigger retry queue processing
            this.processRetryQueue().catch(() => {})
          } catch (syncErr: any) {
            if (this.isNetworkOrOfflineError(syncErr)) {
              console.log(
                `[TrackingService] Network error during auto-sync. Enqueuing update for media ${remoteMediaId}:`,
                syncErr.message
              )
              await trackerRepo.enqueueSync({
                mangaId,
                mediaId: remoteMediaId,
                status: targetStatus,
                progress: targetNumber,
                score: tracker.score && tracker.score > 0 ? tracker.score : undefined,
                lastError: syncErr.message || 'Network error'
              })
              await trackerRepo.updateSyncedChapter(mangaId, 'anilist', targetNumber)
              if (targetStatus === 'COMPLETED' && tracker.status !== 'COMPLETED') {
                await trackerRepo.saveTracker({
                  mangaId,
                  provider: 'anilist',
                  remoteId: tracker.remoteId,
                  status: 'COMPLETED',
                  score: tracker.score,
                  lastSyncedChapter: targetNumber
                })
              }
            } else {
              throw syncErr
            }
          }
        }
      }
    } catch (err) {
      console.warn('[TrackingService] Auto-sync failed:', err)
    }
  }

  /**
   * Process all pending sync updates in SQLite retry queue when online.
   */
  async processRetryQueue(): Promise<{ processed: number; succeeded: number; failed: number }> {
    if (this.isProcessingQueue) return { processed: 0, succeeded: 0, failed: 0 }
    if (typeof net !== 'undefined' && net.isOnline && !net.isOnline()) {
      return { processed: 0, succeeded: 0, failed: 0 }
    }

    const token = await this.getToken()
    if (!token) return { processed: 0, succeeded: 0, failed: 0 }

    const queue = await trackerRepo.getPendingSyncs()
    if (!queue || queue.length === 0) return { processed: 0, succeeded: 0, failed: 0 }

    this.isProcessingQueue = true
    let succeeded = 0
    let failed = 0

    console.log(
      `[TrackingService] Processing AniList retry queue (${queue.length} pending items)...`
    )

    for (const item of queue) {
      try {
        // Resolve smart status (e.g. check if progress reached total chapters)
        let targetStatus = item.status || 'CURRENT'
        if (targetStatus !== 'COMPLETED' && item.progress > 0) {
          targetStatus = await this.resolveSmartStatus(item.mediaId, item.progress, targetStatus)
        }

        const mutation = `
          mutation ($mediaId: Int, $status: MediaListStatus, $progress: Int, $scoreRaw: Int) {
            SaveMediaListEntry(mediaId: $mediaId, status: $status, progress: $progress, scoreRaw: $scoreRaw) {
              id
              mediaId
              status
              progress
            }
          }
        `
        const variables: Record<string, any> = { mediaId: item.mediaId }
        if (targetStatus) variables.status = targetStatus
        if (item.progress !== undefined) variables.progress = item.progress
        if (item.score !== undefined && item.score !== null && item.score > 0) {
          variables.scoreRaw = item.score
        }

        await this.queryAniList(mutation, variables, token)
        await trackerRepo.removeSyncQueueItem(item.id)
        succeeded++

        if (item.mangaId) {
          await trackerRepo.updateSyncedChapter(item.mangaId, 'anilist', item.progress)
          if (targetStatus === 'COMPLETED') {
            const currentTracker = await trackerRepo.getTracker(item.mangaId, 'anilist')
            if (currentTracker && currentTracker.status !== 'COMPLETED') {
              await trackerRepo.saveTracker({
                mangaId: item.mangaId,
                provider: 'anilist',
                remoteId: String(item.mediaId),
                status: 'COMPLETED',
                score: item.score ?? currentTracker.score,
                lastSyncedChapter: item.progress
              })
            }
          }
        }
      } catch (err: any) {
        failed++
        if (this.isNetworkOrOfflineError(err)) {
          console.warn(
            '[TrackingService] Network still unavailable during retry queue execution, halting:',
            err.message
          )
          await trackerRepo.incrementSyncAttempts(item.id, err.message)
          break
        } else {
          console.error(`[TrackingService] Failed to sync queued item ${item.mediaId}:`, err)
          await trackerRepo.incrementSyncAttempts(item.id, err.message || 'API error')
          // If persistent non-network error after 5 attempts (e.g. invalid media ID or permission revoked), discard
          if (item.attempts >= 5) {
            console.warn(
              `[TrackingService] Discarding queued item ${item.mediaId} after 5 failed attempts`
            )
            await trackerRepo.removeSyncQueueItem(item.id)
          }
        }
      }
    }

    this.isProcessingQueue = false
    return { processed: queue.length, succeeded, failed }
  }

  /**
   * Cleanup timer on service shutdown
   */
  destroy(): void {
    if (this.queueInterval) {
      clearInterval(this.queueInterval)
      this.queueInterval = null
    }
  }
}

export const trackingService = new TrackingService()
