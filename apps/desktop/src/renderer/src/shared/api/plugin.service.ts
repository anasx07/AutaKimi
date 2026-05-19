import { getApi, callIpc } from './base'

export const PluginService = {
  getAll: () => callIpc(() => getApi().plugins.getAll()),
  toggle: (id: string, enabled: boolean) => callIpc(() => getApi().plugins.toggle(id, enabled)),
  install: (plugin: any) => callIpc(() => getApi().plugins.install(plugin)),
  uninstall: (id: string) => callIpc(() => getApi().plugins.uninstall(id))
}
