import { ipcMain } from 'electron'
import { IpcChannel } from '../types/ipc'
import { extensionRepo, libraryRepo, settingsRepo, progressRepo, historyRepo, chapterRepo, mangaCacheRepo } from '../db'
import { wrapIpc } from './utils'

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
  return wrapIpc((_, ...args: any[]) => (repos[repo] as any)[method](...args))
}

export function registerDatabaseHandlers() {
  ipcMain.handle(IpcChannel.DB_GET_EXTENSIONS, dbHandler('extension', 'getAll'))

  ipcMain.handle(IpcChannel.DB_ADD_EXTENSION, wrapIpc(async (_, data) => {
    await extensionRepo.upsert({ ...data, installedAt: new Date().toISOString() })
    return true
  }))

  ipcMain.handle(IpcChannel.DB_GET_EXTENSION, dbHandler('extension', 'getByPkg'))

  ipcMain.handle(IpcChannel.DB_REMOVE_EXTENSION, wrapIpc(async (_, pkg: string) => {
    await extensionRepo.remove(pkg)
    return true
  }))

  ipcMain.handle(IpcChannel.DB_GET_LIBRARY, wrapIpc(async (_, args?: { limit?: number; offset?: number; type?: 'manga' | 'anime' }) => {
    const limit = args?.limit;
    const offset = args?.offset;
    const type = args?.type;
    const rows = await libraryRepo.getAll(limit, offset, type)
    return rows.map(r => {
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
    })
  }))


  ipcMain.handle(IpcChannel.DB_TOGGLE_LIBRARY, dbHandler('library', 'toggle'))

  ipcMain.handle(IpcChannel.DB_GET_SETTING, dbHandler('settings', 'get'))

  ipcMain.handle(IpcChannel.DB_GET_SETTINGS, wrapIpc(async () => {
    const rows = await settingsRepo.getAll()
    const result: Record<string, string> = {}
    rows.forEach(r => { if (r.value !== null) result[r.key] = r.value })
    return result
  }))

  ipcMain.handle(IpcChannel.DB_SET_SETTING, wrapIpc(async (_, { key, value }: { key: string; value: string }) => {
    await settingsRepo.set(key, value)
    return true
  }))

  ipcMain.handle(IpcChannel.DB_GET_PROGRESS, dbHandler('progress', 'getProgress'))

  ipcMain.handle(IpcChannel.DB_UPDATE_PROGRESS, dbHandler('progress', 'updateProgress'))

  ipcMain.handle(IpcChannel.DB_ADD_HISTORY, wrapIpc(async (_, data) => {
    return historyRepo.addEntry(data)
  }))

  ipcMain.handle(IpcChannel.DB_GET_HISTORY, wrapIpc(async (_, args?: { limit?: number; offset?: number; type?: 'manga' | 'anime' } | number) => {
    let limit = 50, offset = 0, type: 'manga' | 'anime' | undefined = undefined
    if (typeof args === 'number') limit = args
    else if (args && typeof args === 'object') { 
      limit = args.limit ?? 50; 
      offset = args.offset ?? 0; 
      type = args.type as any
    }
    return historyRepo.getHistory(limit, offset, type)
  }))

  ipcMain.handle(IpcChannel.DB_DELETE_HISTORY_ENTRY, dbHandler('history', 'deleteEntry'))

  ipcMain.handle(IpcChannel.DB_DELETE_HISTORY_BY_MANGA, dbHandler('history', 'deleteByManga'))

  ipcMain.handle(IpcChannel.DB_CLEAR_HISTORY, dbHandler('history', 'clearHistory'))

  ipcMain.handle(IpcChannel.DB_GET_CHAPTERS, dbHandler('chapter', 'getByManga'))

  ipcMain.handle(IpcChannel.DB_SAVE_CHAPTERS, wrapIpc(async (_, { mangaId, chapters }: { mangaId: string; chapters: any[] }) => {
    await chapterRepo.upsertMany(mangaId, chapters)
    return true
  }))

  ipcMain.handle(IpcChannel.DB_GET_MANGA_CACHE, dbHandler('mangaCache', 'get'))

  ipcMain.handle(IpcChannel.DB_SAVE_MANGA_CACHE, dbHandler('mangaCache', 'upsert'))
}
