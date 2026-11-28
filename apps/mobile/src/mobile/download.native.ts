import * as FileSystem from 'expo-file-system/legacy'
import { MobileDB } from './db.native'
import { MobileNetwork } from './network.native'
import { IpcResult, DownloadEntry } from '@common/types'
import {
  getImageHeaders,
  getVideoHeaders,
  sanitizeHeadersMap,
  sanitizeUrlForHttp
} from './cf-cookies'

export type DownloadEventCallback = (data: any) => void
const downloadCallbacks = new Set<DownloadEventCallback>()

const DOWNLOADS_DIR = `${FileSystem.documentDirectory}Downloads/`

function sanitizePathSegment(segment: string): string {
  return encodeURIComponent(segment || '').replace(/%/g, '_').replace(/[:/\\?*|"><]/g, '_')
}

function isHlsStreamUrl(url: string): boolean {
  const lower = url.toLowerCase()
  const clean = lower.split('?')[0]
  return (
    clean.endsWith('.m3u8') ||
    lower.includes('.m3u8') ||
    lower.includes('hls_proxy') ||
    lower.includes('mode=m3u8')
  )
}

function resolveUrlRelative(rawUri: string, baseUrl: string): string {
  const trimmed = rawUri.trim()
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed
  }
  try {
    return new URL(trimmed, baseUrl).href
  } catch {
    if (trimmed.startsWith('//')) {
      return `https:${trimmed}`
    }
    const baseClean = baseUrl.replace(/[^/]*(\?.*)?$/, '')
    return `${baseClean}${trimmed.replace(/^\//, '')}`
  }
}

function pickBestVariantPlaylistUrl(masterText: string, masterUrl: string): string | null {
  const lines = masterText.split(/\r?\n/)
  let bestBandwidth = -1
  let bestUrl: string | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line.startsWith('#EXT-X-STREAM-INF')) continue
    const bwMatch = line.match(/BANDWIDTH=(\d+)/i)
    const bw = bwMatch ? parseInt(bwMatch[1], 10) : 0
    for (let j = i + 1; j < lines.length; j++) {
      const candidate = lines[j].trim()
      if (!candidate) continue
      if (candidate.startsWith('#')) break
      const resolved = resolveUrlRelative(candidate, masterUrl)
      if (!bestUrl || bw > bestBandwidth) {
        bestBandwidth = bw
        bestUrl = resolved
      }
      break
    }
  }
  return bestUrl
}

function buildEpisodeReferer(mangaId: string, chapterId: string): string | undefined {
  if (chapterId && (chapterId.startsWith('http://') || chapterId.startsWith('https://'))) {
    return chapterId
  }
  if (mangaId && (mangaId.startsWith('http://') || mangaId.startsWith('https://'))) {
    return mangaId
  }
  return undefined
}

function buildAnimeHeaders(
  streamUrl: string,
  referer?: string,
  customHeaders?: Record<string, string>
): Record<string, string> {
  return (
    sanitizeHeadersMap({
      ...getVideoHeaders(streamUrl, referer),
      ...(customHeaders || {})
    }) || {}
  )
}

export type QueueItem = {
  mangaId: string
  chapterId: string
  pageUrls: string[]
  type: 'manga' | 'anime'
  mangaTitle?: string
  extensionName?: string
  chapterTitle?: string
  headers?: Record<string, string>
}

export type ActiveDownloadTask = {
  mangaId: string
  chapterId: string
  active: boolean
  cached: number
  total: number
  type: 'manga' | 'anime'
}

function taskKey(mangaId: string, chapterId: string): string {
  return `${mangaId}|||${chapterId}`
}

async function resolveAnimeLocalUri(mangaId: string, chapterId: string): Promise<string | null> {
  const safeMangaId = sanitizePathSegment(mangaId)
  const safeChapterId = sanitizePathSegment(chapterId)
  const baseUri = `${DOWNLOADS_DIR}anime/${safeMangaId}/${safeChapterId}/`
  for (const filename of ['episode.mp4', 'playlist.m3u8']) {
    try {
      const candidate = `${baseUri}${filename}`
      const info = await FileSystem.getInfoAsync(candidate)
      if (info.exists && !info.isDirectory) {
        return candidate
      }
    } catch {
      /* ignore missing candidate */
    }
  }
  return null
}

async function enrichEntryWithLocalFiles(entry: DownloadEntry): Promise<DownloadEntry> {
  if (entry.status !== 'completed') return entry
  if (entry.mediaType === 'anime') {
    const localUri = await resolveAnimeLocalUri(entry.mangaId, entry.chapterId)
    if (localUri) {
      return { ...entry, localPages: [localUri] }
    }
  }
  return entry
}

export const MobileDownload = {
  activeDownloads: new Map<string, ActiveDownloadTask>(),
  activeResumables: new Map<string, FileSystem.DownloadResumable>(),
  queue: [] as QueueItem[],
  isProcessing: false,

  onEvent(callback: DownloadEventCallback) {
    downloadCallbacks.add(callback)
    return () => downloadCallbacks.delete(callback)
  },

  emit(data: any) {
    downloadCallbacks.forEach((cb) => cb(data))
  },

  async ensureDir(path: string) {
    const dirUri = `${DOWNLOADS_DIR}${path}`
    const dirInfo = await FileSystem.getInfoAsync(dirUri)
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dirUri, { intermediates: true })
    }
  },

  async start(args: QueueItem): Promise<IpcResult<boolean>> {
    const key = taskKey(args.mangaId, args.chapterId)
    if (
      this.activeDownloads.has(key) ||
      this.queue.some((q) => taskKey(q.mangaId, q.chapterId) === key)
    ) {
      return { ok: true, value: true }
    }

    const initialTotal = args.type === 'anime' ? 100 : args.pageUrls.length

    this.queue.push(args)
    await MobileDB.upsertDownload({
      mangaId: args.mangaId,
      chapterId: args.chapterId,
      totalPages: initialTotal,
      cachedPages: 0,
      status: 'queued',
      pageUrls: JSON.stringify(args.pageUrls),
      type: args.type,
      mangaTitle: args.mangaTitle,
      chapterTitle: args.chapterTitle,
      updatedAt: new Date().toISOString()
    })

    this.emit({
      type: 'queued',
      mangaId: args.mangaId,
      chapterId: args.chapterId,
      total: initialTotal,
      cached: 0,
      mediaType: args.type
    })

    this.processQueue().catch((e) => console.error('[MobileDownload Native] processQueue error:', e))

    return { ok: true, value: true }
  },

  async downloadAnimeEpisode(
    args: QueueItem,
    key: string,
    targetDirUri: string
  ): Promise<{ total: number; cached: number }> {
    const streamUrl = sanitizeUrlForHttp(args.pageUrls[0] || '')
    if (!streamUrl) {
      throw new Error('No downloadable stream URL provided')
    }

    const referer = buildEpisodeReferer(args.mangaId, args.chapterId)
    const headers = buildAnimeHeaders(streamUrl, referer, args.headers)

    let hlsMode = isHlsStreamUrl(streamUrl)
    let mediaPlaylistUrl = streamUrl
    let mediaPlaylistText: string | null = null

    if (hlsMode) {
      const playlistRes = await MobileNetwork.fetchText(streamUrl, { headers })
      if (!playlistRes.ok || !playlistRes.value.ok) {
        throw new Error(
          playlistRes.ok
            ? `HTTP ${playlistRes.value.status} fetching HLS playlist`
            : playlistRes.error || 'Failed to fetch HLS playlist'
        )
      }
      const rawText = playlistRes.value.data || ''
      if (rawText.includes('#EXT-X-STREAM-INF')) {
        const variantUrl = pickBestVariantPlaylistUrl(rawText, streamUrl)
        if (!variantUrl) {
          throw new Error('Could not find playable variant inside HLS master playlist')
        }
        const safeVariant = sanitizeUrlForHttp(variantUrl)
        const variantHeaders = buildAnimeHeaders(safeVariant, referer, args.headers)
        const variantRes = await MobileNetwork.fetchText(safeVariant, { headers: variantHeaders })
        if (!variantRes.ok || !variantRes.value.ok) {
          throw new Error(
            variantRes.ok
              ? `HTTP ${variantRes.value.status} fetching HLS media playlist`
              : variantRes.error || 'Failed to fetch HLS media playlist'
          )
        }
        mediaPlaylistUrl = safeVariant
        mediaPlaylistText = variantRes.value.data || ''
      } else {
        mediaPlaylistText = rawText
      }
    }

    // Download HLS segments + rewrite playlist.m3u8 for offline ExoPlayer playback
    if (hlsMode && mediaPlaylistText !== null) {
      const lines = mediaPlaylistText.split(/\r?\n/)
      const urlMap = new Map<string, string>()
      const downloadQueue: Array<{ remoteUrl: string; localFilename: string; isSegment: boolean }> = []
      let segIndex = 0
      let keyIndex = 0

      const rewrittenLines = lines.map((rawLine) => {
        const line = rawLine.trim()
        if (!line) return rawLine

        if (line.startsWith('#')) {
          // Handle AES keys or fMP4 init maps: #EXT-X-KEY:...URI="..." / #EXT-X-MAP:URI="..."
          const uriMatch = line.match(/URI="([^"]+)"/)
          if (uriMatch && (line.startsWith('#EXT-X-KEY') || line.startsWith('#EXT-X-MAP'))) {
            const absUrl = sanitizeUrlForHttp(resolveUrlRelative(uriMatch[1], mediaPlaylistUrl))
            let localName = urlMap.get(absUrl)
            if (!localName) {
              keyIndex++
              localName = line.startsWith('#EXT-X-MAP') ? `init_${keyIndex}.mp4` : `key_${keyIndex}.bin`
              urlMap.set(absUrl, localName)
              downloadQueue.push({ remoteUrl: absUrl, localFilename: localName, isSegment: false })
            }
            return line.replace(`URI="${uriMatch[1]}"`, `URI="${localName}"`)
          }
          return rawLine
        }

        const absUrl = sanitizeUrlForHttp(resolveUrlRelative(line, mediaPlaylistUrl))
        let localName = urlMap.get(absUrl)
        if (!localName) {
          segIndex++
          const cleanExt = absUrl.split('?')[0].toLowerCase().endsWith('.m4s') ? '.m4s' : '.ts'
          localName = `seg_${String(segIndex).padStart(5, '0')}${cleanExt}`
          urlMap.set(absUrl, localName)
          downloadQueue.push({ remoteUrl: absUrl, localFilename: localName, isSegment: true })
        }
        return localName
      })

      if (downloadQueue.length === 0) {
        throw new Error('HLS playlist contains no downloadable video segments')
      }

      const totalCount = downloadQueue.length
      const task = this.activeDownloads.get(key)
      if (task) task.total = totalCount
      await MobileDB.updateDownloadProgress(args.mangaId, args.chapterId, 0, totalCount)

      let completed = 0
      for (const item of downloadQueue) {
        const current = this.activeDownloads.get(key)
        if (!current || !current.active) {
          return { total: totalCount, cached: completed }
        }

        const segHeaders = buildAnimeHeaders(item.remoteUrl, referer, args.headers)
        const res = await FileSystem.downloadAsync(
          item.remoteUrl,
          `${targetDirUri}${item.localFilename}`,
          { headers: segHeaders }
        )

        if (res.status < 200 || res.status >= 300) {
          throw new Error(`HTTP ${res.status} downloading video segment`)
        }

        completed++
        current.cached = completed
        if (completed === totalCount || completed % 4 === 0) {
          await MobileDB.updateDownloadProgress(args.mangaId, args.chapterId, completed, totalCount)
        }
        this.emit({
          type: 'progress',
          mangaId: args.mangaId,
          chapterId: args.chapterId,
          cached: completed,
          total: totalCount,
          mediaType: 'anime'
        })
      }

      await FileSystem.writeAsStringAsync(
        `${targetDirUri}playlist.m3u8`,
        rewrittenLines.join('\n')
      )
      return { total: totalCount, cached: completed }
    }

    // Progressive direct video (MP4 / WebM) with live resumable percentage progress
    const destUri = `${targetDirUri}episode.mp4`
    let lastEmitAt = 0
    let lastPct = -1

    const resumable = FileSystem.createDownloadResumable(
      streamUrl,
      destUri,
      { headers },
      (progress) => {
        const current = this.activeDownloads.get(key)
        if (!current || !current.active) return
        const expected = progress.totalBytesExpectedToWrite
        const pct =
          expected > 0
            ? Math.min(99, Math.max(0, Math.round((progress.totalBytesWritten / expected) * 100)))
            : Math.min(95, Math.floor(progress.totalBytesWritten / (1024 * 1024)))
        const now = Date.now()
        if (pct !== lastPct && (now - lastEmitAt > 450 || pct - lastPct >= 3)) {
          lastPct = pct
          lastEmitAt = now
          current.cached = pct
          current.total = 100
          MobileDB.updateDownloadProgress(args.mangaId, args.chapterId, pct, 100).catch(() => {})
          this.emit({
            type: 'progress',
            mangaId: args.mangaId,
            chapterId: args.chapterId,
            cached: pct,
            total: 100,
            mediaType: 'anime'
          })
        }
      }
    )

    this.activeResumables.set(key, resumable)
    try {
      const result = await resumable.downloadAsync()
      const current = this.activeDownloads.get(key)
      if (!current || !current.active) {
        return { total: 100, cached: lastPct > 0 ? lastPct : 0 }
      }
      if (!result || result.status < 200 || result.status >= 300) {
        await FileSystem.deleteAsync(destUri, { idempotent: true }).catch(() => {})
        throw new Error(`HTTP ${result?.status || 0} downloading video file`)
      }
      await MobileDB.updateDownloadProgress(args.mangaId, args.chapterId, 100, 100)
      return { total: 100, cached: 100 }
    } finally {
      this.activeResumables.delete(key)
    }
  },

  async processQueue() {
    if (this.isProcessing) return
    this.isProcessing = true

    while (this.queue.length > 0) {
      const args = this.queue.shift()!
      const key = taskKey(args.mangaId, args.chapterId)
      const initialTotal = args.type === 'anime' ? 100 : args.pageUrls.length

      const currentTask: ActiveDownloadTask = {
        mangaId: args.mangaId,
        chapterId: args.chapterId,
        active: true,
        cached: 0,
        total: initialTotal,
        type: args.type
      }
      this.activeDownloads.set(key, currentTask)

      if (args.type !== 'anime') {
        await MobileDB.updateProgress({
          mangaId: args.mangaId,
          chapterId: args.chapterId,
          isRead: false
        })
      }

      await MobileDB.updateDownloadStatus(args.mangaId, args.chapterId, 'downloading')

      this.emit({
        type: 'start',
        mangaId: args.mangaId,
        chapterId: args.chapterId,
        total: initialTotal,
        cached: 0,
        mediaType: args.type
      })

      const safeMangaId = sanitizePathSegment(args.mangaId)
      const safeChapterId = sanitizePathSegment(args.chapterId)
      const targetDirSub = `${args.type}/${safeMangaId}/${safeChapterId}`
      const targetDirUri = `${DOWNLOADS_DIR}${targetDirSub}/`

      try {
        await this.ensureDir(targetDirSub)

        let totalFinal = initialTotal
        let cachedFinal = 0

        if (args.type === 'anime') {
          const animeOutcome = await this.downloadAnimeEpisode(args, key, targetDirUri)
          totalFinal = animeOutcome.total
          cachedFinal = animeOutcome.cached
        } else {
          for (let i = 0; i < args.pageUrls.length; i++) {
            const task = this.activeDownloads.get(key)
            if (!task || !task.active) break

            const url = sanitizeUrlForHttp(args.pageUrls[i])
            const filename = `${String(i + 1).padStart(3, '0')}.jpg`
            const fileUri = `${targetDirUri}${filename}`

            const referer = buildEpisodeReferer(args.mangaId, args.chapterId)
            const downloadHeaders = getImageHeaders(url, referer)

            const downloadRes = await FileSystem.downloadAsync(url, fileUri, {
              headers: downloadHeaders
            })

            if (downloadRes.status >= 200 && downloadRes.status < 300) {
              cachedFinal++
              task.cached = cachedFinal
              await MobileDB.updateDownloadProgress(
                args.mangaId,
                args.chapterId,
                cachedFinal,
                args.pageUrls.length
              )
              this.emit({
                type: 'progress',
                mangaId: args.mangaId,
                chapterId: args.chapterId,
                cached: cachedFinal,
                total: args.pageUrls.length,
                mediaType: 'manga'
              })
            }
          }
          totalFinal = args.pageUrls.length
        }

        const task = this.activeDownloads.get(key)
        if (task && task.active) {
          await MobileDB.upsertDownload({
            mangaId: args.mangaId,
            chapterId: args.chapterId,
            totalPages: totalFinal,
            cachedPages: cachedFinal,
            status: 'completed',
            pageUrls: JSON.stringify(args.pageUrls),
            type: args.type,
            mangaTitle: args.mangaTitle,
            chapterTitle: args.chapterTitle,
            updatedAt: new Date().toISOString()
          })
          this.emit({
            type: 'completed',
            mangaId: args.mangaId,
            chapterId: args.chapterId,
            mediaType: args.type
          })
        }
      } catch (err: any) {
        console.error('[MobileDownload Native] Download failed:', err)
        const stillActive = this.activeDownloads.get(key)?.active
        if (stillActive) {
          await MobileDB.updateDownloadStatus(
            args.mangaId,
            args.chapterId,
            'error',
            err.message || String(err)
          )
          this.emit({
            type: 'error',
            mangaId: args.mangaId,
            chapterId: args.chapterId,
            error: err.message || String(err),
            mediaType: args.type
          })
        }
      } finally {
        this.activeDownloads.delete(key)
      }
    }

    this.isProcessing = false
  },

  async cancel(args: { mangaId: string; chapterId: string }): Promise<IpcResult<boolean>> {
    const key = taskKey(args.mangaId, args.chapterId)
    const task = this.activeDownloads.get(key)
    if (task) {
      task.active = false
    }
    const resumable = this.activeResumables.get(key)
    if (resumable) {
      this.activeResumables.delete(key)
      resumable.cancelAsync().catch(() => {})
    }
    this.queue = this.queue.filter((q) => taskKey(q.mangaId, q.chapterId) !== key)
    await MobileDB.updateDownloadStatus(args.mangaId, args.chapterId, 'canceled')
    this.emit({
      type: 'canceled',
      mangaId: args.mangaId,
      chapterId: args.chapterId
    })
    return { ok: true, value: true }
  },

  async remove(args: { mangaId: string; chapterId: string }): Promise<IpcResult<boolean>> {
    const key = taskKey(args.mangaId, args.chapterId)

    const activeTask = this.activeDownloads.get(key)
    if (activeTask) {
      activeTask.active = false
    }
    const resumable = this.activeResumables.get(key)
    if (resumable) {
      this.activeResumables.delete(key)
      resumable.cancelAsync().catch(() => {})
    }

    this.queue = this.queue.filter((q) => taskKey(q.mangaId, q.chapterId) !== key)

    const statusInfo = await this.getStatus(args)
    const mediaType = statusInfo.ok && statusInfo.value?.mediaType ? statusInfo.value.mediaType : 'manga'
    const safeMangaId = sanitizePathSegment(args.mangaId)
    const safeChapterId = sanitizePathSegment(args.chapterId)
    const targetDirSub = `${mediaType}/${safeMangaId}/${safeChapterId}`
    const targetDirUri = `${DOWNLOADS_DIR}${targetDirSub}`

    try {
      await FileSystem.deleteAsync(targetDirUri, { idempotent: true })
    } catch (e) {
      console.error('[MobileDownload Native] Remove directory failed:', e)
    }

    try {
      const mangaDirUri = `${DOWNLOADS_DIR}${mediaType}/${safeMangaId}`
      const info = await FileSystem.getInfoAsync(mangaDirUri)
      if (info.exists) {
        const remaining = await FileSystem.readDirectoryAsync(mangaDirUri)
        if (remaining.length === 0) {
          await FileSystem.deleteAsync(mangaDirUri, { idempotent: true })
        }
      }
    } catch {}

    await MobileDB.deleteDownload(args.mangaId, args.chapterId)
    await MobileDB.setSetting(`dl_status_${args.mangaId}:${args.chapterId}`, '')
    await MobileDB.setSetting(`dl_meta_${args.mangaId}:${args.chapterId}`, '')

    return { ok: true, value: true }
  },

  async getStatus(args: {
    mangaId: string
    chapterId: string
  }): Promise<IpcResult<DownloadEntry | undefined>> {
    const key = taskKey(args.mangaId, args.chapterId)
    const task = this.activeDownloads.get(key)
    const dbRes = await MobileDB.getDownload(args.mangaId, args.chapterId)
    const entry = dbRes.ok && dbRes.value ? dbRes.value : undefined

    if (task && task.active) {
      return {
        ok: true,
        value: {
          mangaId: args.mangaId,
          chapterId: args.chapterId,
          status: 'downloading',
          totalPages: task.total || entry?.totalPages || null,
          cachedPages: task.cached || entry?.cachedPages || null,
          pageUrls: entry?.pageUrls || null,
          error: null,
          updatedAt: entry?.updatedAt || new Date().toISOString(),
          mediaType: task.type || entry?.mediaType || 'manga',
          mangaTitle: entry?.mangaTitle || null,
          chapterTitle: entry?.chapterTitle || null
        }
      }
    }

    if (entry) {
      return {
        ok: true,
        value: await enrichEntryWithLocalFiles(entry)
      }
    }

    return {
      ok: true,
      value: undefined
    }
  },

  async getMangaDownloads(mangaId: string): Promise<IpcResult<DownloadEntry[]>> {
    const res = await MobileDB.getDownloadsByManga(mangaId)
    const entries = res.ok && res.value ? res.value : []
    const enriched: DownloadEntry[] = []
    for (const entry of entries) {
      const task = this.activeDownloads.get(taskKey(entry.mangaId, entry.chapterId))
      if (task && task.active) {
        entry.status = 'downloading'
        if (typeof task.cached === 'number') entry.cachedPages = task.cached
        if (typeof task.total === 'number') entry.totalPages = task.total
        enriched.push(entry)
      } else {
        enriched.push(await enrichEntryWithLocalFiles(entry))
      }
    }
    return { ok: true, value: enriched }
  },

  async getAllMangaDownloads(type?: string): Promise<IpcResult<DownloadEntry[]>> {
    const res = await MobileDB.getAllDownloads(type)
    let entries = res.ok && res.value ? res.value : []
    for (const entry of entries) {
      const task = this.activeDownloads.get(taskKey(entry.mangaId, entry.chapterId))
      if (task && task.active) {
        entry.status = 'downloading'
        if (typeof task.cached === 'number') entry.cachedPages = task.cached
        if (typeof task.total === 'number') entry.totalPages = task.total
      }
    }
    if (type && type !== 'all') {
      entries = entries.filter((e) => e.mediaType === type)
    }
    return { ok: true, value: entries }
  },

  async clearAll(type?: string): Promise<IpcResult<boolean>> {
    const entriesRes = await this.getAllMangaDownloads(type)
    const list = entriesRes.ok && entriesRes.value ? entriesRes.value : []
    for (const entry of list) {
      await this.remove({ mangaId: entry.mangaId, chapterId: entry.chapterId })
    }
    return { ok: true, value: true }
  }
}
