export const isElectron = (): boolean => {
  return typeof window !== 'undefined' && !!(window as any).api
}

export const isMobile = (): boolean => {
  // If we are on Desktop (Electron), we are never mobile
  if (isElectron()) return false
  // For other platforms (Web), any window under 1024px is mobile
  return window.innerWidth < 1024
}

export const isDesktop = (): boolean => !isMobile()

export const MobileCache = {
  async get(_key: string): Promise<string | null> {
    // Capacitor removed. Fallback to null or add web storage logic here if needed.
    return null
  },

  async set(_key: string, _data: string): Promise<void> {
    // Capacitor removed.
  },

  async clear(): Promise<void> {
    // Capacitor removed.
  }
}
