export const MobileCache = {
  async get(key: string): Promise<string | null> {
    // Capacitor removed. Fallback to null or add web storage logic here if needed.
    return null
  },

  async set(key: string, data: string): Promise<void> {
    // Capacitor removed.
  },

  async clear(): Promise<void> {
    // Capacitor removed.
  }
}
