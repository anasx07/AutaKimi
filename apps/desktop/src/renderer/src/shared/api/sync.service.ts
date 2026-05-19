import { getApi, callIpc } from './base'

export const SyncService = {
  startServer: () => callIpc(() => getApi().sync.startServer()),
  stopServer: () => callIpc(() => getApi().sync.stopServer()),
  getStatus: () => callIpc(() => getApi().sync.getStatus()),
  getPairingPayload: (args: { ip: string; port: number }) =>
    callIpc(() => getApi().sync.getPairingPayload(args))
}
