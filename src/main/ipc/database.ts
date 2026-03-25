import { ipcMain } from 'electron'
import { IpcChannel } from '../types/ipc'
import { extensionRepo, libraryRepo, settingsRepo, progressRepo, historyRepo, chapterRepo, mangaCacheRepo } from '../db'
import { wrapIpc } from './utils'

export function registerDatabaseHandlers() {
  ipcMain.handle(IpcChannel.DB_GET_EXTENSIONS, wrapIpc(() => extensionRepo.getAll()))

  ipcMain.handle(IpcChannel.DB_ADD_EXTENSION, wrapIpc(async (_, data) => {
    await extensionRepo.upsert({ ...data, installedAt: new Date().toISOString() })
    return true
  }))

  ipcMain.handle(IpcChannel.DB_GET_EXTENSION, wrapIpc((_, pkg: string) => extensionRepo.getByPkg(pkg)))

  ipcMain.handle(IpcChannel.DB_REMOVE_EXTENSION, wrapIpc(async (_, pkg: string) => {
    await extensionRepo.remove(pkg)
    return true
  }))

  ipcMain.handle(IpcChannel.DB_GET_LIBRARY, wrapIpc(async (_, args?: { limit?: number; offset?: number }) => {
    const limit = args?.limit;
    const offset = args?.offset;
    const rows = await libraryRepo.getAll(limit, offset)
    return rows.map(r => ({
      ...JSON.parse(r.metadata || '{}'),
      id: r.id,
      title: r.title,
      coverUrl: r.coverUrl,
      status: r.status
    }))
  }))


  ipcMain.handle(IpcChannel.DB_TOGGLE_LIBRARY, wrapIpc((_, manga: any) => libraryRepo.toggle(manga)))

  ipcMain.handle(IpcChannel.DB_GET_SETTING, wrapIpc((_, key: string) => settingsRepo.get(key)))

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

  ipcMain.handle(IpcChannel.DB_GET_PROGRESS, wrapIpc((_, mangaId: string) => progressRepo.getProgress(mangaId)))

  ipcMain.handle(IpcChannel.DB_UPDATE_PROGRESS, wrapIpc(async (_, data) => {
    await progressRepo.updateProgress(data)
    return true
  }))

  ipcMain.handle(IpcChannel.DB_ADD_HISTORY, wrapIpc(async (_, data) => {
    await historyRepo.addEntry(data)
    return true
  }))

  ipcMain.handle(IpcChannel.DB_GET_HISTORY, wrapIpc(async (_, args?: { limit?: number; offset?: number } | number) => {
    let limit = 50, offset = 0
    if (typeof args === 'number') limit = args
    else if (args && typeof args === 'object') { limit = args.limit ?? 50; offset = args.offset ?? 0 }
    return historyRepo.getHistory(limit, offset)
  }))

  ipcMain.handle(IpcChannel.DB_DELETE_HISTORY_ENTRY, wrapIpc(async (_, id: number) => {
    await historyRepo.deleteEntry(id)
    return true
  }))

  ipcMain.handle(IpcChannel.DB_DELETE_HISTORY_BY_MANGA, wrapIpc(async (_, mangaId: string) => {
    await historyRepo.deleteByManga(mangaId)
    return true
  }))

  ipcMain.handle(IpcChannel.DB_CLEAR_HISTORY, wrapIpc(async () => {
    await historyRepo.clearHistory()
    return true
  }))

  ipcMain.handle(IpcChannel.DB_GET_CHAPTERS, wrapIpc((_, mangaId: string) => chapterRepo.getByManga(mangaId)))

  ipcMain.handle(IpcChannel.DB_SAVE_CHAPTERS, wrapIpc(async (_, { mangaId, chapters }: { mangaId: string; chapters: any[] }) => {
    await chapterRepo.upsertMany(mangaId, chapters)
    return true
  }))

  ipcMain.handle(IpcChannel.DB_GET_MANGA_CACHE, wrapIpc((_, mangaId: string) => mangaCacheRepo.get(mangaId)))

  ipcMain.handle(IpcChannel.DB_SAVE_MANGA_CACHE, wrapIpc(async (_, manga: any) => {
    await mangaCacheRepo.upsert(manga)
    return true
  }))
}
