import { getApi, callIpc } from './base'

export const SourceService = {
  getRepos: () => callIpc(() => getApi().sources.getRepos()),
  addRepo: (url: string) => callIpc(() => getApi().sources.addRepo(url)),
  removeRepo: (url: string) => callIpc(() => getApi().sources.removeRepo(url)),
  refreshAll: () => callIpc(() => getApi().sources.refreshAll()),
  getAllSources: () => callIpc(() => getApi().sources.getAllSources())
}
