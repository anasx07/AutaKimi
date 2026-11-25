import { create } from 'zustand'
import type { Chapter, PartialManga } from '@common/types'

export interface PipSession {
  manga: PartialManga
  chapter: Chapter
  pkg: string
  returnPath: string
}

export interface LivePlaybackSnapshot {
  manga: PartialManga
  chapter: Chapter
  pkg: string
  isPlaying: boolean
}

const playbackSecondsByKey = new Map<string, number>()

export function makePlaybackKey(mangaId: string, chapterId: string): string {
  return `${mangaId}::${chapterId}`
}

export function recordLivePlaybackSeconds(
  mangaId: string,
  chapterId: string,
  seconds: number
): void {
  if (!mangaId || !chapterId || !Number.isFinite(seconds) || seconds < 0) return
  playbackSecondsByKey.set(makePlaybackKey(mangaId, chapterId), seconds)
}

export function consumeLivePlaybackSeconds(mangaId: string, chapterId: string): number {
  const key = makePlaybackKey(mangaId, chapterId)
  const val = playbackSecondsByKey.get(key) ?? 0
  playbackSecondsByKey.delete(key)
  return val
}

export function peekLivePlaybackSeconds(mangaId: string, chapterId: string): number {
  return playbackSecondsByKey.get(makePlaybackKey(mangaId, chapterId)) ?? 0
}

export function clearLivePlaybackSeconds(mangaId: string, chapterId: string): void {
  if (!mangaId || !chapterId) return
  playbackSecondsByKey.delete(makePlaybackKey(mangaId, chapterId))
}

/**
 * Pure decision helper: enters Auto-PiP when navigating away from the watch view while video
 * is actively playing (and not paused or explicitly stopped).
 */
export function shouldAutoEnterPip(params: {
  livePlayback: LivePlaybackSnapshot | null
  hasExistingPip: boolean
  isMobileView: boolean
}): boolean {
  const { livePlayback, hasExistingPip, isMobileView } = params
  if (isMobileView || hasExistingPip || !livePlayback) return false
  if (livePlayback.manga.mediaType !== 'anime') return false
  return livePlayback.isPlaying
}

interface PipPlayerState {
  pipSession: PipSession | null
  livePlayback: LivePlaybackSnapshot | null
  setLivePlayback: (snapshot: LivePlaybackSnapshot | null) => void
  setLivePlaying: (isPlaying: boolean) => void
  enterPip: (session: PipSession) => void
  updatePipChapter: (chapter: Chapter) => void
  clearPip: () => void
}

export const usePipPlayerStore = create<PipPlayerState>((set) => ({
  pipSession: null,
  livePlayback: null,

  setLivePlayback: (livePlayback) => set({ livePlayback }),

  setLivePlaying: (isPlaying) =>
    set((state) => {
      if (!state.livePlayback || state.livePlayback.isPlaying === isPlaying) {
        return state
      }
      return {
        livePlayback: {
          ...state.livePlayback,
          isPlaying
        }
      }
    }),

  enterPip: (pipSession) => set({ pipSession, livePlayback: null }),

  updatePipChapter: (chapter) =>
    set((state) => {
      if (!state.pipSession) return state
      return {
        pipSession: {
          ...state.pipSession,
          chapter
        }
      }
    }),

  clearPip: () => set({ pipSession: null })
}))
