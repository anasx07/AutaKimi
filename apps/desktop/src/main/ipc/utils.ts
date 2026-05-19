import { ipcMain, IpcMainInvokeEvent } from 'electron'
import { IpcInvokeMap, IpcResult } from '../types/ipc'

export function wrapIpc<T>(fn: (event: IpcMainInvokeEvent, ...args: any[]) => Promise<T>) {
  return async (event: IpcMainInvokeEvent, ...args: any[]): Promise<IpcResult<T>> => {
    try {
      const value = await fn(event, ...args)
      return { ok: true, value }
    } catch (error: any) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }
}

export function registerHandler<K extends keyof IpcInvokeMap>(
  channel: K,
  handler: (
    event: IpcMainInvokeEvent,
    ...args: any[]
  ) => Promise<IpcResult<any>> | IpcResult<any> | any
) {
  ipcMain.handle(channel, handler as any)
}

export function isValidUrl(url: string | any = ''): boolean {
  if (!url || typeof url !== 'string') return false
  const lower = url.toLowerCase()
  return lower.startsWith('http://') || lower.startsWith('https://')
}

