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
