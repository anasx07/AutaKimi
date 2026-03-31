import { Filesystem, Directory } from '@capacitor/filesystem'

export const MobileCache = {
  async get(key: string): Promise<string | null> {
    try {
      const result = await Filesystem.readFile({
        path: `Cache/${key}`,
        directory: Directory.Cache
      })
      return result.data as string
    } catch (e) {
      return null
    }
  },

  async set(key: string, data: string): Promise<void> {
    try {
      await Filesystem.writeFile({
        path: `Cache/${key}`,
        data,
        directory: Directory.Cache,
        recursive: true
      })
    } catch (e) {
      console.error('[MobileCache] Failed to set cache:', e)
    }
  },

  async clear(): Promise<void> {
    try {
      await Filesystem.rmdir({
        path: 'Cache',
        directory: Directory.Cache,
        recursive: true
      })
    } catch (e) {}
  }
}
