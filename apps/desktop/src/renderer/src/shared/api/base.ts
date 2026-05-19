import { ElectronApi, IpcResult } from '@common/types'

// Use Electron IPC API if window.api is exposed (Desktop)
// On mobile (Expo), window.api is set in app/_layout.tsx by MobileApi
export const getApi = (): ElectronApi => {
  if (typeof window !== 'undefined' && (window as any).api) {
    return (window as any).api
  }
  // In a pure web environment without API bridge, provide a minimal fallback
  // that throws informative errors
  return new Proxy({} as ElectronApi, {
    get(_, prop) {
      return () =>
        Promise.reject(new Error(`ElectronApi.${String(prop)} not available — no API bridge found`))
    }
  })
}

export async function callIpc<T>(fn: () => Promise<IpcResult<T>>): Promise<T> {
  const res = await fn()
  if (!res.ok) throw new Error(res.error)
  return res.value
}
