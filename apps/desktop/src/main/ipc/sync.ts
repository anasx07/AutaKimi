import { IpcChannel } from '@common/types/ipc'
import { syncServer } from '../services/sync-server.service'
import { identityService } from '../services/identity.service'
import { registerHandler, wrapIpc } from './utils'

export function registerSyncHandlers() {
  registerHandler(
    IpcChannel.SYNC_START_SERVER,
    wrapIpc(async () => {
      return syncServer.start()
    })
  )

  registerHandler(
    IpcChannel.SYNC_STOP_SERVER,
    wrapIpc(async () => {
      await syncServer.stop()
    })
  )

  registerHandler(
    IpcChannel.SYNC_GET_STATUS,
    wrapIpc(async () => {
      return syncServer.getStatus()
    })
  )

  registerHandler(
    IpcChannel.SYNC_GET_PAIRING_PAYLOAD,
    wrapIpc(async (_, args: { ip: string; port: number }) => {
      if (!args || typeof args !== 'object') throw new Error('Invalid arguments')
      if (typeof args.ip !== 'string' || typeof args.port !== 'number') {
        throw new Error('Invalid ip or port')
      }
      return identityService.getPairingPayload(args.ip, args.port)
    })
  )
}

