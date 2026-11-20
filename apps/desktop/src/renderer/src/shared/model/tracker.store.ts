import { create } from 'zustand'
import { DataService } from '@renderer/shared/api'
import { Tracker, TrackerProvider, AniListUser } from '@common/types'

interface TrackerState {
  trackers: Record<string, Tracker[]>
  currentUser: AniListUser | null
  isLoadingUser: boolean

  loadUser: () => Promise<void>
  loginAniList: () => Promise<AniListUser | null>
  setTokenAniList: (token: string) => Promise<AniListUser | null>
  logoutAniList: () => Promise<void>

  loadTrackers: (mangaId: string) => Promise<Tracker[]>
  saveTracker: (tracker: Tracker) => Promise<void>
  deleteTracker: (mangaId: string, provider: TrackerProvider) => Promise<void>
  syncTracker: (
    mangaId: string,
    remoteId: number,
    status?: string,
    progress?: number,
    score?: number
  ) => Promise<void>
}

export const useTrackerStore = create<TrackerState>((set, get) => ({
  trackers: {},
  currentUser: null,
  isLoadingUser: false,

  loadUser: async () => {
    set({ isLoadingUser: true })
    try {
      const user = await DataService.tracker.getUserAniList()
      set({ currentUser: user || null })
    } catch {
      set({ currentUser: null })
    } finally {
      set({ isLoadingUser: false })
    }
  },

  loginAniList: async () => {
    try {
      const res = await DataService.tracker.authAniList()
      if (res?.user) {
        set({ currentUser: res.user })
        return res.user
      }
      return null
    } catch (err) {
      console.error('Failed to log in to AniList:', err)
      throw err
    }
  },

  setTokenAniList: async (token: string) => {
    try {
      const user = await DataService.tracker.setTokenAniList(token)
      if (user) {
        set({ currentUser: user })
        return user
      }
      return null
    } catch (err) {
      console.error('Failed to set AniList token:', err)
      throw err
    }
  },

  logoutAniList: async () => {
    try {
      await DataService.tracker.logoutAniList()
      set({ currentUser: null })
    } catch (err) {
      console.error('Failed to logout of AniList:', err)
    }
  },

  loadTrackers: async (mangaId: string) => {
    try {
      const list = await DataService.tracker.getByManga(mangaId)
      const validList = Array.isArray(list) ? list : []
      set((state) => ({
        trackers: { ...state.trackers, [mangaId]: validList }
      }))
      return validList
    } catch (err) {
      console.error('Failed to load trackers for manga:', err)
      return []
    }
  },

  saveTracker: async (tracker: Tracker) => {
    try {
      await DataService.tracker.save(tracker)
      set((state) => {
        const existing = state.trackers[tracker.mangaId] || []
        const next = existing.filter((t) => t.provider !== tracker.provider)
        next.push(tracker)
        return {
          trackers: { ...state.trackers, [tracker.mangaId]: next }
        }
      })
    } catch (err) {
      console.error('Failed to save tracker:', err)
      throw err
    }
  },

  deleteTracker: async (mangaId: string, provider: TrackerProvider) => {
    try {
      await DataService.tracker.delete(mangaId, provider)
      set((state) => {
        const existing = state.trackers[mangaId] || []
        return {
          trackers: {
            ...state.trackers,
            [mangaId]: existing.filter((t) => t.provider !== provider)
          }
        }
      })
    } catch (err) {
      console.error('Failed to delete tracker:', err)
      throw err
    }
  },

  syncTracker: async (mangaId, remoteId, status, progress, score) => {
    try {
      await DataService.tracker.updateAniList({
        mediaId: remoteId,
        status,
        progress,
        score
      })
      const tracker: Tracker = {
        mangaId,
        provider: 'anilist',
        remoteId: String(remoteId),
        status,
        score,
        lastSyncedChapter: progress,
        updatedAt: new Date().toISOString()
      }
      await get().saveTracker(tracker)
    } catch (err) {
      console.error('Failed to sync tracker:', err)
      throw err
    }
  }
}))
