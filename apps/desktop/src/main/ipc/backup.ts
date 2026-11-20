import { IpcChannel } from '../types/ipc'
import { registerHandler, wrapIpc } from './utils'
import { backupService } from '../services/backup.service'

export function registerBackupHandlers(): void {
  registerHandler(
    IpcChannel.BACKUP_EXPORT,
    wrapIpc(async () => {
      return backupService.exportBackup()
    })
  )

  registerHandler(
    IpcChannel.BACKUP_IMPORT,
    wrapIpc(async () => {
      return backupService.importBackup()
    })
  )
}
