import { getApi, callIpc } from './base'

export const BackupService = {
  export: () => callIpc(() => getApi().backup.export()),
  import: () => callIpc(() => getApi().backup.import())
}
