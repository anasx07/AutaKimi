import { getApi, callIpc } from './base'

export const PluginService = {
  getAll: () => callIpc(() => getApi().plugins.getAll()),
  toggle: (id: string, enabled: boolean) => callIpc(() => getApi().plugins.toggle(id, enabled))
}
