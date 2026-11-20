import fs from 'fs'
import path from 'path'

export class DiskCache {
  constructor(
    private cacheDir: string,
    private maxSizeBytes: number
  ) {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true })
    }
  }

  private isEvicting = false

  async getCachePath(key: string): Promise<string> {
    return path.join(this.cacheDir, key)
  }

  async get(key: string): Promise<Buffer | null> {
    const cachePath = await this.getCachePath(key)
    try {
      return await fs.promises.readFile(cachePath)
    } catch (e) {
      return null
    }
  }

  async set(key: string, buffer: Buffer): Promise<void> {
    const cachePath = await this.getCachePath(key)
    const tmpPath = `${cachePath}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`
    try {
      await fs.promises.writeFile(tmpPath, buffer)
      await fs.promises.rename(tmpPath, cachePath)
    } catch (e) {
      try {
        if (fs.existsSync(tmpPath)) {
          await fs.promises.unlink(tmpPath)
        }
      } catch {}
      throw e
    }
    this.fireAndForgetEviction()
  }

  async exists(key: string): Promise<boolean> {
    return fs.existsSync(await this.getCachePath(key))
  }

  private fireAndForgetEviction(): void {
    if (this.isEvicting) return
    this.evict().catch(() => {
      this.isEvicting = false
    })
  }

  async evict(): Promise<void> {
    if (this.isEvicting) return
    if (!fs.existsSync(this.cacheDir)) return

    this.isEvicting = true
    try {
      const files = await fs.promises.readdir(this.cacheDir)
      const stats = (
        await Promise.all(
          files.map(async (file) => {
            const filePath = path.join(this.cacheDir, file)
            if (file.endsWith('.tmp')) {
              try {
                const s = await fs.promises.stat(filePath)
                if (Date.now() - s.mtimeMs > 300000) {
                  await fs.promises.unlink(filePath).catch(() => {})
                }
              } catch {}
              return null
            }
            try {
              const stat = await fs.promises.stat(filePath)
              return { filePath, size: stat.size, mtime: stat.mtimeMs }
            } catch {
              return null
            }
          })
        )
      ).filter((s): s is { filePath: string; size: number; mtime: number } => s !== null)

      let currentSize = stats.reduce((acc, s) => acc + s.size, 0)
      if (currentSize <= this.maxSizeBytes) {
        this.isEvicting = false
        return
      }

      console.log(
        `[DiskCache] Evicting... Current size: ${(currentSize / 1024 / 1024).toFixed(2)}MB`
      )
      stats.sort((a, b) => a.mtime - b.mtime)

      for (const stat of stats) {
        if (currentSize <= this.maxSizeBytes) break
        try {
          await fs.promises.unlink(stat.filePath)
          currentSize -= stat.size
        } catch {
          // File may have already been removed
        }
      }
      console.log(
        `[DiskCache] Eviction done. New size: ${(currentSize / 1024 / 1024).toFixed(2)}MB`
      )
    } catch (e) {
      console.error('[DiskCache] Eviction failed:', e)
    } finally {
      this.isEvicting = false
    }
  }

  async clear(): Promise<void> {
    if (fs.existsSync(this.cacheDir)) {
      await fs.promises.rm(this.cacheDir, { recursive: true, force: true })
      await fs.promises.mkdir(this.cacheDir, { recursive: true })
    }
  }
}
