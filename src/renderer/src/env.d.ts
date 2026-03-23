/// <reference types="vite/client" />
import { type ElectronApi } from '../../main/types/ipc'

declare global {
  interface Window {
    api: ElectronApi
    electron: any
  }
}

export {}
