import { StateUpdateEvent, ElectronApi } from '@common/types'
import { getApi, callIpc } from './base'

export const SystemService = {
  init: () => callIpc(() => getApi().init()),
  getSystemState: () => callIpc(() => getApi().getSystemState()),
  onSystemStateUpdate: (callback: (data: StateUpdateEvent) => void) =>
    getApi().onSystemStateUpdate(callback),
  get version() {
    return getApi()?.version || '0.0.0'
  },
  checkForUpdates: () => callIpc(() => getApi().checkForUpdates()),
  installUpdate: () => callIpc(() => getApi().installUpdate()),
  detectTheme: (baseUrl: string) => callIpc(() => getApi().detectTheme(baseUrl)),
  clearCache: () => callIpc(() => getApi().clearCache()),
  clearCookies: () => callIpc(() => getApi().clearCookies()),
  onAppUpdate: (callback: Parameters<ElectronApi['onAppUpdate']>[0]) =>
    getApi().onAppUpdate(callback),
  onCacheInvalidate: (callback: (data: { group: string; key?: string }) => void) =>
    getApi().onCacheInvalidate(callback),
  platform: getApi()?.platform || 'win32'
}
