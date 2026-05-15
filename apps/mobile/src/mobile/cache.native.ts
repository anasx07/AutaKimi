import * as FileSystem from 'expo-file-system'

const CACHE_DIR = `${FileSystem.cacheDirectory}AutaKimi/Cache/`

let cacheInvalidateCallback: ((data: { group: string; key?: string }) => void) | null = null

export function setCacheInvalidateCallback(cb: typeof cacheInvalidateCallback): void {
  cacheInvalidateCallback = cb
}

export const MobileCache = {
  async ensureDir() {
    const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR)
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true })
    }
  },

  async get(key: string): Promise<string | null> {
    try {
      const fileUri = `${CACHE_DIR}${key}`
      const fileInfo = await FileSystem.getInfoAsync(fileUri)
      if (fileInfo.exists) {
        return await FileSystem.readAsStringAsync(fileUri)
      }
      return null
    } catch (e) {
      return null
    }
  },

  async set(key: string, data: string): Promise<void> {
    try {
      await this.ensureDir()
      const fileUri = `${CACHE_DIR}${key}`
      await FileSystem.writeAsStringAsync(fileUri, data)
    } catch (e) {
      console.error('[MobileCache Native] Failed to set cache:', e)
    }
  },

  async clear(): Promise<void> {
    try {
      await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true })
      if (cacheInvalidateCallback) cacheInvalidateCallback({ group: 'all' })
    } catch (e) {}
  }
}
