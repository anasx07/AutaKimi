/// <reference types="vite/client" />
import { type ElectronApi } from '../../common/types'

declare global {
  interface Window {
    api: ElectronApi
    Capacitor?: any
  }
}

export {}
