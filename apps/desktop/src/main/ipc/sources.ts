import { ipcMain } from 'electron'
import { IpcChannel } from '@common/types/ipc'
import { settingsRepo } from '../db'
import { templateService } from '@common/services/template.service'
import { wrapIpc } from './utils'

export function registerSourceHandlers() {
  ipcMain.handle(
    IpcChannel.SOURCES_GET_REPOS,
    wrapIpc(async () => {
      const reposJson = await settingsRepo.get('source_repositories')
      return reposJson ? JSON.parse(reposJson) : []
    })
  )

  ipcMain.handle(
    IpcChannel.SOURCES_ADD_REPO,
    wrapIpc(async (_, url: string) => {
      const reposJson = await settingsRepo.get('source_repositories')
      const repos: string[] = reposJson ? JSON.parse(reposJson) : []
      
      if (repos.includes(url)) {
        return { success: true, count: 0 } // Already exists
      }

      // Test fetch before adding
      const res = await templateService.fetchTemplates(url)
      if (res.success) {
        repos.push(url)
        await settingsRepo.set('source_repositories', JSON.stringify(repos))
      }
      return res
    })
  )

  ipcMain.handle(
    IpcChannel.SOURCES_REMOVE_REPO,
    wrapIpc(async (_, url: string) => {
      const reposJson = await settingsRepo.get('source_repositories')
      let repos: string[] = reposJson ? JSON.parse(reposJson) : []
      repos = repos.filter((r) => r !== url)
      await settingsRepo.set('source_repositories', JSON.stringify(repos))
    })
  )

  ipcMain.handle(
    IpcChannel.SOURCES_REFRESH_ALL,
    wrapIpc(async () => {
      const reposJson = await settingsRepo.get('source_repositories')
      const repos: string[] = reposJson ? JSON.parse(reposJson) : []
      return await templateService.loadAllRepositories(repos)
    })
  )
}
