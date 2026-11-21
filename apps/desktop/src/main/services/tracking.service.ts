import { BrowserWindow } from 'electron'
import { trackerRepo, settingsRepo, chapterRepo } from '../db'
import { AniListUser, AniListMedia } from '@common/types'

const ANILIST_CLIENT_ID = '16329'
const ANILIST_GRAPHQL_ENDPOINT = 'https://graphql.anilist.co'

export class TrackingService {
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
              await settingsRepo.set('anilist_token', token)
              await settingsRepo.set('anilist_user', JSON.stringify(user))
              authWindow.close()
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
    await settingsRepo.set('anilist_token', token)
    await settingsRepo.set('anilist_user', JSON.stringify(user))
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
    const token = await settingsRepo.get('anilist_token')
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
    await settingsRepo.set('anilist_token', '')
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
    return data?.Page?.media || []
  }

  /**
   * Retrieve AniList media details along with current user list progress
   */
  async getAniListMedia(mediaId: number): Promise<AniListMedia | null> {
    const token = await settingsRepo.get('anilist_token')
    const query = `
      query ($mediaId: Int) {
        Media(id: $mediaId) {
          id
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
    return data?.Media || null
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
    const token = await settingsRepo.get('anilist_token')
    if (!token) throw new Error('AniList account is not connected.')

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
    if (status) variables.status = status
    if (progress !== undefined) variables.progress = progress
    if (score !== undefined && score !== null && score > 0) variables.scoreRaw = score

    const data = await this.queryAniList(mutation, variables, token)
    return data?.SaveMediaListEntry
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

      const token = await settingsRepo.get('anilist_token')
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
          console.log(
            `[TrackingService] Auto-syncing manga ${mangaId} to AniList media ${tracker.remoteId} -> progress ${targetNumber}`
          )
          await this.updateAniListMedia(
            parseInt(tracker.remoteId),
            tracker.status || 'CURRENT',
            targetNumber,
            tracker.score && tracker.score > 0 ? tracker.score : undefined
          )
          await trackerRepo.updateSyncedChapter(mangaId, 'anilist', targetNumber)
        }
      }
    } catch (err) {
      console.warn('[TrackingService] Auto-sync failed:', err)
    }
  }
}

export const trackingService = new TrackingService()
