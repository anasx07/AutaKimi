import { getApi, callIpc } from './base'
import { Tracker, TrackerProvider } from '@common/types'

export const TrackerService = {
  getByManga: (mangaId: string) => callIpc(() => getApi().trackers.getByManga(mangaId)),
  save: (tracker: Tracker) => callIpc(() => getApi().trackers.save(tracker)),
  delete: (mangaId: string, provider: TrackerProvider) =>
    callIpc(() => getApi().trackers.delete({ mangaId, provider })),
  authAniList: () => callIpc(() => getApi().trackers.authAniList()),
  getUserAniList: () => callIpc(() => getApi().trackers.getUserAniList()),
  setTokenAniList: (token: string) => callIpc(() => getApi().trackers.setTokenAniList(token)),
  logoutAniList: () => callIpc(() => getApi().trackers.logoutAniList()),
  searchAniList: (query: string, type: 'ANIME' | 'MANGA' = 'MANGA') =>
    callIpc(() => getApi().trackers.searchAniList({ query, type })),
  getMediaAniList: (mediaId: number) => callIpc(() => getApi().trackers.getMediaAniList(mediaId)),
  updateAniList: (args: {
    mediaId: number
    status?: string
    progress?: number
    score?: number
  }) => callIpc(() => getApi().trackers.updateAniList(args))
}
