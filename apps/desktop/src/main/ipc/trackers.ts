import { IpcChannel } from '../types/ipc'
import { registerHandler, wrapIpc } from './utils'
import { trackerRepo } from '../db'
import { trackingService } from '../services/tracking.service'
import { Tracker, TrackerProvider } from '@common/types'

export function registerTrackerHandlers(): void {
  registerHandler(
    IpcChannel.DB_GET_TRACKERS,
    wrapIpc(async (_, mangaId: string) => {
      if (typeof mangaId !== 'string') throw new Error('Invalid mangaId: expected string')
      return trackerRepo.getTrackers(mangaId)
    })
  )

  registerHandler(
    IpcChannel.DB_SAVE_TRACKER,
    wrapIpc(async (_, tracker: Tracker) => {
      if (!tracker || typeof tracker !== 'object') throw new Error('Invalid tracker object')
      if (typeof tracker.mangaId !== 'string' || typeof tracker.provider !== 'string') {
        throw new Error('Invalid tracker fields: mangaId and provider required')
      }
      return trackerRepo.saveTracker(tracker)
    })
  )

  registerHandler(
    IpcChannel.DB_DELETE_TRACKER,
    wrapIpc(async (_, args: { mangaId: string; provider: TrackerProvider }) => {
      if (!args || typeof args.mangaId !== 'string' || typeof args.provider !== 'string') {
        throw new Error('Invalid delete tracker arguments')
      }
      return trackerRepo.deleteTracker(args.mangaId, args.provider)
    })
  )

  registerHandler(
    IpcChannel.TRACKER_AUTH_ANILIST,
    wrapIpc(async () => {
      return trackingService.loginAniList()
    })
  )

  registerHandler(
    IpcChannel.TRACKER_GET_USER_ANILIST,
    wrapIpc(async () => {
      return trackingService.getAniListUser()
    })
  )

  registerHandler(
    IpcChannel.TRACKER_SET_TOKEN_ANILIST,
    wrapIpc(async (_, token: string) => {
      if (typeof token !== 'string' || !token.trim()) throw new Error('Invalid token')
      return trackingService.setAniListToken(token.trim())
    })
  )

  registerHandler(
    IpcChannel.TRACKER_LOGOUT_ANILIST,
    wrapIpc(async () => {
      await trackingService.logoutAniList()
      return { success: true }
    })
  )

  registerHandler(
    IpcChannel.TRACKER_SEARCH_ANILIST,
    wrapIpc(async (_, args: { query: string; type?: 'ANIME' | 'MANGA' }) => {
      if (!args || typeof args.query !== 'string') throw new Error('Invalid search query')
      return trackingService.searchAniList(args.query, args.type || 'MANGA')
    })
  )

  registerHandler(
    IpcChannel.TRACKER_GET_MEDIA_ANILIST,
    wrapIpc(async (_, mediaId: number) => {
      if (typeof mediaId !== 'number') throw new Error('Invalid mediaId: expected number')
      return trackingService.getAniListMedia(mediaId)
    })
  )

  registerHandler(
    IpcChannel.TRACKER_UPDATE_ANILIST,
    wrapIpc(
      async (_, args: { mediaId: number; status?: string; progress?: number; score?: number }) => {
        if (!args || typeof args.mediaId !== 'number') throw new Error('Invalid mediaId')
        return trackingService.updateAniListMedia(
          args.mediaId,
          args.status,
          args.progress,
          args.score
        )
      }
    )
  )

  registerHandler(
    IpcChannel.TRACKER_PROCESS_QUEUE,
    wrapIpc(async () => {
      return trackingService.processRetryQueue()
    })
  )

  registerHandler(
    IpcChannel.TRACKER_GET_SKIP_TIMES,
    wrapIpc(async (_, args: any) => {
      if (!args || typeof args.episodeNumber !== 'number') {
        throw new Error('Invalid getSkipTimes arguments: episodeNumber required')
      }
      return trackingService.getSkipTimes(args)
    })
  )
}
