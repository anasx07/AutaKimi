import { ElectronApi } from '@common/types'
import { getApi, callIpc } from './base'

export const WindowService = {
  minimize: () => callIpc(() => getApi().window.minimize()),
  maximize: () => callIpc(() => getApi().window.maximize()),
  restore: () => callIpc(() => getApi().window.restore()),
  close: () => callIpc(() => getApi().window.close()),
  isMaximized: () => callIpc(() => getApi().window.isMaximized()),
  setFullScreen: (flag: boolean) => callIpc(() => getApi().window.setFullScreen(flag)),
  isFullScreen: () => callIpc(() => getApi().window.isFullScreen()),
  onFullScreenChange: (
    callback: Parameters<ElectronApi['window']['onFullScreenChange']>[0]
  ) => getApi().window.onFullScreenChange(callback),
  updateOverlay: (options: { color: string; symbolColor: string }) =>
    callIpc(() => getApi().window.updateOverlay(options)),
  openExternal: (url: string) => callIpc(() => getApi().openExternal(url)),
  openInternalBrowser: (url: string) => callIpc(() => getApi().openInternalBrowser(url))
}
