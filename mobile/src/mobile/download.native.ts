import * as FileSystem from 'expo-file-system'
import { MobileDB } from './db.native'
import { MobileNetwork } from './network.native'
import { IpcResult, DownloadEntry } from '../common/types'

export type DownloadEventCallback = (data: any) => void
let downloadCallback: DownloadEventCallback | null = null

const DOWNLOADS_DIR = `${FileSystem.documentDirectory}Downloads/`

function metaKey(mangaId: string, chapterId: string) {
  return `dl_meta_${mangaId}:${chapterId}`
}

function statusKey(mangaId: string, chapterId: string) {
  return `dl_status_${mangaId}:${chapterId}`
}

export const MobileDownload = {
  activeDownloads: new Map<string, boolean>(),

  onEvent(callback: DownloadEventCallback) {
    downloadCallback = callback
  },

  emit(data: any) {
    if (downloadCallback) downloadCallback(data)
  },

  async ensureDir(path: string) {
    const dirUri = `${DOWNLOADS_DIR}${path}`
    const dirInfo = await FileSystem.getInfoAsync(dirUri)
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dirUri, { intermediates: true })
    }
  },

  async start(args: {
    mangaId: string
    chapterId: string
    pageUrls: string[]
    type: 'manga' | 'anime'
    mangaTitle?: string
    extensionName?: string
    chapterTitle?: string
  }): Promise<IpcResult<boolean>> {
    const key = `${args.mangaId}:${args.chapterId}`
    if (this.activeDownloads.has(key)) return { ok: true, value: true }

    this.activeDownloads.set(key, true)

    await MobileDB.updateProgress({
      mangaId: args.mangaId,
      chapterId: args.chapterId,
      isRead: false
    })

    await MobileDB.setSetting(statusKey(args.mangaId, args.chapterId), 'downloading')

    this.emit({
      type: 'start',
      mangaId: args.mangaId,
      chapterId: args.chapterId,
      total: args.pageUrls.length
    })

    const targetDirSub = `${args.type}/${args.mangaId}/${args.chapterId}`
    const targetDirUri = `${DOWNLOADS_DIR}${targetDirSub}/`

    try {
      await this.ensureDir(targetDirSub)

      let cachedCount = 0
      for (let i = 0; i < args.pageUrls.length; i++) {
        if (!this.activeDownloads.get(key)) break

        const url = args.pageUrls[i]
        const filename = `${String(i + 1).padStart(3, '0')}.jpg`
        const fileUri = `${targetDirUri}${filename}`

        const downloadRes = await FileSystem.downloadAsync(url, fileUri, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        })

        if (downloadRes.status >= 200 && downloadRes.status < 300) {
          cachedCount++
          this.emit({
            type: 'progress',
            mangaId: args.mangaId,
            chapterId: args.chapterId,
            cached: cachedCount,
            total: args.pageUrls.length
          })
        }
      }

      if (this.activeDownloads.get(key)) {
        await MobileDB.setSetting(statusKey(args.mangaId, args.chapterId), 'completed')
        await MobileDB.setSetting(
          metaKey(args.mangaId, args.chapterId),
          JSON.stringify({
            pageUrls: args.pageUrls,
            mangaTitle: args.mangaTitle,
            chapterTitle: args.chapterTitle,
            type: args.type,
            downloadedAt: new Date().toISOString(),
            totalPages: args.pageUrls.length
          })
        )
        this.emit({
          type: 'completed',
          mangaId: args.mangaId,
          chapterId: args.chapterId
        })
      }
    } catch (err: any) {
      console.error('[MobileDownload Native] Download failed:', err)
      this.emit({
        type: 'error',
        mangaId: args.mangaId,
        chapterId: args.chapterId,
        error: err.message || String(err)
      })
    } finally {
      this.activeDownloads.delete(key)
    }

    return { ok: true, value: true }
  },

  async cancel(args: { mangaId: string; chapterId: string }): Promise<IpcResult<boolean>> {
    const key = `${args.mangaId}:${args.chapterId}`
    this.activeDownloads.set(key, false)
    this.emit({
      type: 'canceled',
      mangaId: args.mangaId,
      chapterId: args.chapterId
    })
    return { ok: true, value: true }
  },

  async remove(args: { mangaId: string; chapterId: string }): Promise<IpcResult<boolean>> {
    const key = `${args.mangaId}:${args.chapterId}`
    const targetDirSub = `manga/${args.mangaId}/${args.chapterId}`
    const targetDirUri = `${DOWNLOADS_DIR}${targetDirSub}`
    try {
      await FileSystem.deleteAsync(targetDirUri, { idempotent: true })
    } catch {}
    await MobileDB.setSetting(statusKey(args.mangaId, args.chapterId), '')
    await MobileDB.setSetting(metaKey(args.mangaId, args.chapterId), '')
    return { ok: true, value: true }
  },

  async getStatus(args: { mangaId: string; chapterId: string }): Promise<IpcResult<DownloadEntry | undefined>> {
    const key = `${args.mangaId}:${args.chapterId}`
    const status = await MobileDB.getSetting(statusKey(args.mangaId, args.chapterId))
    const metaRaw = await MobileDB.getSetting(metaKey(args.mangaId, args.chapterId))
    const meta = metaRaw ? JSON.parse(metaRaw) : null
    const isActive = this.activeDownloads.has(key)
    return {
      ok: true,
      value: {
        mangaId: args.mangaId,
        chapterId: args.chapterId,
        status: isActive ? 'downloading' : (status || null),
        totalPages: meta?.totalPages || null,
        cachedPages: meta?.totalPages || null,
        pageUrls: meta?.pageUrls ? JSON.stringify(meta.pageUrls) : null,
        error: null,
        updatedAt: meta?.downloadedAt || null,
        mediaType: meta?.type || 'manga'
      }
    }
  },

  async getMangaDownloads(mangaId: string): Promise<IpcResult<DownloadEntry[]>> {
    const allSettings = await MobileDB.getSettings()
    const prefix = `dl_status_${mangaId}:`
    const metaPrefix = `dl_meta_${mangaId}:`
    const entries: any[] = []
    for (const [settingKey, status] of Object.entries(allSettings)) {
      if (!settingKey.startsWith(prefix) || !status) continue
      const chapterId = settingKey.slice(prefix.length)
      const metaRaw = allSettings[`dl_meta_${mangaId}:${chapterId}`]
      const meta = metaRaw ? JSON.parse(metaRaw) : null
      entries.push({
        mangaId,
        chapterId,
        status,
        totalPages: meta?.totalPages || null,
        cachedPages: meta?.totalPages || null,
        pageUrls: meta?.pageUrls ? JSON.stringify(meta.pageUrls) : null,
        error: null,
        updatedAt: meta?.downloadedAt || null,
        mediaType: meta?.type || 'manga'
      })
    }
    return { ok: true, value: entries }
  },

  async getAllMangaDownloads(type?: string): Promise<IpcResult<DownloadEntry[]>> {
    const allSettings = await MobileDB.getSettings()
    const entries: any[] = []
    const seen = new Set<string>()
    for (const [settingKey, status] of Object.entries(allSettings)) {
      if (!settingKey.startsWith('dl_status_') || !status || !settingKey.includes(':')) continue
      const rest = settingKey.slice('dl_status_'.length)
      const colonIdx = rest.indexOf(':')
      if (colonIdx === -1) continue
      const mangaId = rest.slice(0, colonIdx)
      const chapterId = rest.slice(colonIdx + 1)
      const uniqueKey = `${mangaId}:${chapterId}`
      if (seen.has(uniqueKey)) continue
      seen.add(uniqueKey)
      const metaRaw = allSettings[`dl_meta_${mangaId}:${chapterId}`]
      const meta = metaRaw ? JSON.parse(metaRaw) : null
      entries.push({
        mangaId,
        chapterId,
        status,
        totalPages: meta?.totalPages || null,
        cachedPages: meta?.totalPages || null,
        pageUrls: meta?.pageUrls ? JSON.stringify(meta.pageUrls) : null,
        error: null,
        updatedAt: meta?.downloadedAt || null,
        mediaType: meta?.type || 'manga'
      })
    }
    return { ok: true, value: entries }
  },

  async clearAll(type?: string): Promise<IpcResult<boolean>> {
    const entries = await this.getAllMangaDownloads(type)
    for (const entry of entries.value || []) {
      await this.remove({ mangaId: entry.mangaId, chapterId: entry.chapterId })
    }
    return { ok: true, value: true }
  }
}
