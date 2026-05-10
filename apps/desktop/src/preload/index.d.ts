import { ElectronAPI } from '@electron-toolkit/preload'
import { ElectronApi } from '../main/types/ipc'

declare global {
  interface Window {
    electron: ElectronAPI
    api: ElectronApi
  }
}
