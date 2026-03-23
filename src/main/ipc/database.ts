import { ipcMain } from 'electron'
import { IpcChannel } from '../types/ipc'
import { extensionRepo, libraryRepo, settingsRepo, progressRepo, historyRepo, chapterRepo, mangaCacheRepo } from '../db'

export function registerDatabaseHandlers() {
  ipcMain.handle(IpcChannel.DB_GET_EXTENSIONS, async () => {
    try {
      const data = await extensionRepo.getAll()
      return { ok: true, value: data }
    } catch (error: any) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle(IpcChannel.DB_ADD_EXTENSION, async (_, data) => {
    try {
      await extensionRepo.upsert({
        ...data,
        installedAt: new Date().toISOString()
      })
      return { ok: true, value: true }
    } catch (error: any) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle(IpcChannel.DB_GET_EXTENSION, async (_, pkg: string) => {
    try {
      const data = await extensionRepo.getByPkg(pkg)
      return { ok: true, value: data }
    } catch (error: any) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle(IpcChannel.DB_REMOVE_EXTENSION, async (_, pkg: string) => {
    try {
      await extensionRepo.remove(pkg)
      return { ok: true, value: true }
    } catch (error: any) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle(IpcChannel.DB_GET_LIBRARY, async () => {
    try {
      const rows = await libraryRepo.getAll()
      const data = rows.map(r => ({
        ...JSON.parse(r.metadata || '{}'),
        id: r.id,
        title: r.title,
        coverUrl: r.coverUrl,
        status: r.status
      }))
      return { ok: true, value: data }
    } catch (error: any) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle(IpcChannel.DB_TOGGLE_LIBRARY, async (_, manga: any) => {
    try {
      const data = await libraryRepo.toggle(manga)
      return { ok: true, value: data }
    } catch (error: any) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle(IpcChannel.DB_GET_SETTING, async (_, key: string) => {
    try {
      const data = await settingsRepo.get(key)
      return { ok: true, value: data }
    } catch (error: any) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle(IpcChannel.DB_GET_SETTINGS, async () => {
    try {
      const rows = await settingsRepo.getAll()
      const result: Record<string, string> = {}
      rows.forEach(r => { 
        if (r.value !== null) result[r.key] = r.value 
      })
      return { ok: true, value: result }
    } catch (error: any) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle(IpcChannel.DB_SET_SETTING, async (_, { key, value }: { key: string; value: string }) => {
    try {
      await settingsRepo.set(key, value)
      return { ok: true, value: true }
    } catch (error: any) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle(IpcChannel.DB_GET_PROGRESS, async (_, mangaId: string) => {
    try {
      const data = await progressRepo.getProgress(mangaId)
      return { ok: true, value: data }
    } catch (error: any) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle(IpcChannel.DB_UPDATE_PROGRESS, async (_, data) => {
    try {
      await progressRepo.updateProgress(data)
      return { ok: true, value: true }
    } catch (error: any) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle(IpcChannel.DB_ADD_HISTORY, async (_, data) => {
    try {
      await historyRepo.addEntry(data)
      return { ok: true, value: true }
    } catch (error: any) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle(IpcChannel.DB_GET_HISTORY, async (_, args?: { limit?: number; offset?: number } | number) => {
    try {
      let limit = 50
      let offset = 0
      if (typeof args === 'number') {
        limit = args
      } else if (args && typeof args === 'object') {
        limit = args.limit ?? 50
        offset = args.offset ?? 0
      }
      const data = await historyRepo.getHistory(limit, offset)
      return { ok: true, value: data }
    } catch (error: any) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle(IpcChannel.DB_DELETE_HISTORY_ENTRY, async (_, id: number) => {
    try {
      await historyRepo.deleteEntry(id)
      return { ok: true, value: true }
    } catch (error: any) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle(IpcChannel.DB_DELETE_HISTORY_BY_MANGA, async (_, mangaId: string) => {
    try {
      await historyRepo.deleteByManga(mangaId)
      return { ok: true, value: true }
    } catch (error: any) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle(IpcChannel.DB_CLEAR_HISTORY, async () => {
    try {
      await historyRepo.clearHistory()
      return { ok: true, value: true }
    } catch (error: any) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle(IpcChannel.DB_GET_CHAPTERS, async (_, mangaId: string) => {
    try {
      const data = await chapterRepo.getByManga(mangaId)
      return { ok: true, value: data }
    } catch (error: any) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle(IpcChannel.DB_SAVE_CHAPTERS, async (_, { mangaId, chapters }: { mangaId: string; chapters: any[] }) => {
    try {
      await chapterRepo.upsertMany(mangaId, chapters)
      return { ok: true, value: true }
    } catch (error: any) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle(IpcChannel.DB_GET_MANGA_CACHE, async (_, mangaId: string) => {
    try {
      const data = await mangaCacheRepo.get(mangaId)
      return { ok: true, value: data }
    } catch (error: any) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle(IpcChannel.DB_SAVE_MANGA_CACHE, async (_, manga: any) => {
    try {
      await mangaCacheRepo.upsert(manga)
      return { ok: true, value: true }
    } catch (error: any) {
      return { ok: false, error: error.message }
    }
  })
}
