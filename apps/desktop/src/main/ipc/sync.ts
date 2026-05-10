import { ipcMain } from 'electron'
import { IpcChannel } from '@common/types/ipc'
import { syncServer } from '../services/sync-server.service'
import { identityService } from '../services/identity.service'

export function registerSyncHandlers() {
  ipcMain.handle(IpcChannel.SYNC_START_SERVER, async () => {
    try {
      const result = await syncServer.start()
      return { ok: true, value: result }
    } catch (err: any) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle(IpcChannel.SYNC_STOP_SERVER, async () => {
    try {
      await syncServer.stop()
      return { ok: true, value: undefined }
    } catch (err: any) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle(IpcChannel.SYNC_GET_STATUS, async () => {
    try {
      const status = syncServer.getStatus()
      return { ok: true, value: status }
    } catch (err: any) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle(IpcChannel.SYNC_GET_PAIRING_PAYLOAD, async (_, args: { ip: string; port: number }) => {
    try {
      const payload = await identityService.getPairingPayload(args.ip, args.port)
      return { ok: true, value: payload }
    } catch (err: any) {
      return { ok: false, error: err.message }
    }
  })
}
