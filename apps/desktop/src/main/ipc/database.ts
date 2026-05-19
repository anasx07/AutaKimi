import { IpcChannel } from '../types/ipc'
import {
  extensionRepo,
  libraryRepo,
  settingsRepo,
  progressRepo,
  historyRepo,
  chapterRepo,
  mangaCacheRepo
} from '../db'
import { registerHandler, wrapIpc } from './utils'
import { cacheManager, CacheGroup } from '../services/cache.service'

const repos = {
  extension: extensionRepo,
  library: libraryRepo,
  settings: settingsRepo,
  progress: progressRepo,
  history: historyRepo,
  chapter: chapterRepo,
  mangaCache: mangaCacheRepo
} as const

function dbHandler(repo: keyof typeof repos, method: string) {
  return wrapIpc((_, ...args: any[]) => {
    if (method === 'getByPkg' || method === 'get' || method === 'deleteByManga' || method === 'getByManga') {
      if (typeof args[0] !== 'string') throw new Error('Invalid arguments: expected a string')
    }
    if (method === 'toggle') {
      if (typeof args[0] !== 'string' || !args[1] || typeof args[1] !== 'object') {
        throw new Error('Invalid arguments: expected (string, object)')
      }
    }
    if (method === 'getProgress') {
      if (typeof args[0] !== 'string' || typeof args[1] !== 'string') {
        throw new Error('Invalid arguments: expected (string, string)')
      }
    }
    if (method === 'updateProgress') {
      if (typeof args[0] !== 'string' || typeof args[1] !== 'string' || typeof args[2] !== 'number') {
        throw new Error('Invalid arguments: expected (string, string, number)')
      }
    }
    if (method === 'deleteEntry') {
      if (typeof args[0] !== 'string' && typeof args[0] !== 'number') {
        throw new Error('Invalid arguments: expected string or number')
      }
    }
    return (repos[repo] as any)[method](...args)
  })
}

export function registerDatabaseHandlers() {
  registerHandler(IpcChannel.INIT, wrapIpc(async () => {}))

  registerHandler(IpcChannel.DB_GET_EXTENSIONS, dbHandler('extension', 'getAll'))

  registerHandler(
    IpcChannel.DB_ADD_EXTENSION,
    wrapIpc(async (_, data) => {
      if (!data || typeof data !== 'object') throw new Error('Invalid extension data')
      await extensionRepo.upsert({ ...data, installedAt: new Date().toISOString() })
      return { success: true }
    })
  )

  registerHandler(IpcChannel.DB_GET_EXTENSION, dbHandler('extension', 'getByPkg'))

  registerHandler(
    IpcChannel.DB_REMOVE_EXTENSION,
    wrapIpc(async (_, pkg: string) => {
      if (typeof pkg !== 'string') throw new Error('Invalid package name')
      await extensionRepo.remove(pkg)
      return true
    })
  )

  registerHandler(
    IpcChannel.DB_GET_LIBRARY,
    wrapIpc(async (_, args?: { limit?: number; offset?: number; type?: string }) => {
      if (args && typeof args !== 'object') throw new Error('Invalid arguments')
      const limit = args?.limit
      const offset = args?.offset
      const type = args?.type as 'manga' | 'anime' | undefined
      if (limit !== undefined && typeof limit !== 'number') throw new Error('Invalid limit')
      if (offset !== undefined && typeof offset !== 'number') throw new Error('Invalid offset')
      if (type !== undefined && typeof type !== 'string') throw new Error('Invalid type')

      const rows = await libraryRepo.getAll(limit, offset, type)
      return rows.map((r) => {
        let meta: Record<string, unknown> = {}
        try {
          const parsed = JSON.parse(r.metadata || '{}')
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            meta = parsed
          }
        } catch {}
        return {
          ...meta,
          id: r.id,
          title: r.title,
          coverUrl: r.coverUrl,
          status: r.status
        }
      }) as any
    })
  )

  registerHandler(IpcChannel.DB_TOGGLE_LIBRARY, dbHandler('library', 'toggle'))

  registerHandler(IpcChannel.DB_CLEAR_LIBRARY, dbHandler('library', 'clear'))

  registerHandler(IpcChannel.DB_GET_SETTING, dbHandler('settings', 'get'))

  registerHandler(
    IpcChannel.DB_GET_SETTINGS,
    wrapIpc(async () => {
      const rows = await settingsRepo.getAll()
      const result: Record<string, string> = {}
      rows.forEach((r) => {
        if (r.value !== null) result[r.key] = r.value
      })
      return result
    })
  )

  registerHandler(
    IpcChannel.DB_SET_SETTING,
    wrapIpc(async (_, key, value) => {
      if (typeof key !== 'string') throw new Error('Invalid key')
      if (value !== null && value !== undefined && typeof value !== 'string') throw new Error('Invalid value')
      await settingsRepo.set(key, value)
      return { success: true }
    })
  )

  registerHandler(IpcChannel.DB_GET_PROGRESS, dbHandler('progress', 'getProgress'))

  registerHandler(IpcChannel.DB_UPDATE_PROGRESS, dbHandler('progress', 'updateProgress'))

  registerHandler(
    IpcChannel.DB_ADD_HISTORY,
    wrapIpc(async (_, data) => {
      if (!data || typeof data !== 'object') throw new Error('Invalid history data')
      return historyRepo.addEntry(data)
    })
  )

  registerHandler(
    IpcChannel.DB_GET_HISTORY,
    wrapIpc(
      async (_, args?: { limit?: number; offset?: number; type?: string } | number) => {
        if (args !== undefined && typeof args !== 'number' && typeof args !== 'object') {
          throw new Error('Invalid arguments')
        }
        let limit = 50,
          offset = 0,
          type: 'manga' | 'anime' | undefined = undefined
        if (typeof args === 'number') limit = args
        else if (args && typeof args === 'object') {
          limit = args.limit ?? 50
          offset = args.offset ?? 0
          type = args.type as any
          if (typeof limit !== 'number') throw new Error('Invalid limit')
          if (typeof offset !== 'number') throw new Error('Invalid offset')
          if (type !== undefined && typeof type !== 'string') throw new Error('Invalid type')
        }
        return historyRepo.getHistory(limit, offset, type)
      }
    )
  )

  registerHandler(IpcChannel.DB_DELETE_HISTORY_ENTRY, dbHandler('history', 'deleteEntry'))

  registerHandler(IpcChannel.DB_DELETE_HISTORY_BY_MANGA, dbHandler('history', 'deleteByManga'))

  registerHandler(IpcChannel.DB_CLEAR_HISTORY, dbHandler('history', 'clearHistory'))

  registerHandler(IpcChannel.DB_GET_CHAPTERS, dbHandler('chapter', 'getByManga'))

  registerHandler(
    IpcChannel.DB_SAVE_CHAPTERS,
    wrapIpc(async (_, args: { mangaId: string; chapters: any[] }) => {
      if (!args || typeof args !== 'object') throw new Error('Invalid arguments')
      const { mangaId, chapters } = args
      if (typeof mangaId !== 'string' || !Array.isArray(chapters)) {
        throw new Error('Invalid mangaId or chapters array')
      }
      await chapterRepo.upsertMany(mangaId, chapters)
      return { success: true }
    })
  )

  registerHandler(IpcChannel.DB_GET_MANGA_CACHE, dbHandler('mangaCache', 'get'))

  registerHandler(
    IpcChannel.DB_SAVE_MANGA_CACHE,
    wrapIpc(async (_, manga) => {
      if (!manga || typeof manga !== 'object') throw new Error('Invalid manga cache data')
      const expiresAt = cacheManager.getExpiryDate(CacheGroup.MANGA_METADATA)
      await mangaCacheRepo.upsert({ ...manga, expiresAt })
      return { success: true }
    })
  )
}
