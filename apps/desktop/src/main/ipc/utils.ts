import { ipcMain, IpcMainInvokeEvent } from 'electron'
import { IpcInvokeMap, IpcResult, IpcChannel } from '../types/ipc'

const callTimestamps: Map<string, number[]> = new Map()

// Default limits: max 100 requests per 5 seconds
const DEFAULT_MAX = 100
const DEFAULT_WINDOW_MS = 5000

// Custom channel limits
const CHANNEL_LIMITS: Record<string, { max: number; windowMs: number }> = {
  [IpcChannel.EXECUTE_EXTENSION]: { max: 60, windowMs: 5000 },
  [IpcChannel.DETECT_THEME]: { max: 30, windowMs: 5000 }
}

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
  ipcMain.handle(channel, async (event, ...args) => {
    const now = Date.now()
    const limit = CHANNEL_LIMITS[channel as string] || { max: DEFAULT_MAX, windowMs: DEFAULT_WINDOW_MS }
    
    let timestamps = callTimestamps.get(channel as string) || []
    timestamps = timestamps.filter((t) => now - t < limit.windowMs)
    
    if (timestamps.length >= limit.max) {
      console.warn(`[IPC Rate Limit] Channel "${String(channel)}" rate limit exceeded (${limit.max} req / ${limit.windowMs}ms)`)
      return {
        ok: false,
        error: `Rate limit exceeded for channel ${String(channel)}. Please wait before trying again.`
      }
    }
    
    timestamps.push(now)
    callTimestamps.set(channel as string, timestamps)
    
    return handler(event, ...args)
  })
}

export function isSafeExternalUrl(url: unknown): boolean {
  if (typeof url !== 'string' || !url.trim()) return false
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export function isValidUrl(url: unknown): boolean {
  if (typeof url !== 'string' || !url.trim()) return false
  if (url.startsWith('autakimi-local://') || url.startsWith('autakimi-cache://')) {
    return true
  }
  return isSafeExternalUrl(url)
}

