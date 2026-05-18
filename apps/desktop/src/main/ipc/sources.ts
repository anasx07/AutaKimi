import { IpcChannel } from '@common/types/ipc'
import { settingsRepo } from '../db'
import { templateService } from '@common/services/template.service'
import { registerHandler, wrapIpc } from './utils'

export function registerSourceHandlers() {
  registerHandler(
    IpcChannel.SOURCES_GET_REPOS,
    wrapIpc(async () => {
      const reposJson = await settingsRepo.get('source_repositories')
      return reposJson ? JSON.parse(reposJson) : []
    })
  )

  registerHandler(
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
      return res as any
    })
  )

  registerHandler(
    IpcChannel.SOURCES_REMOVE_REPO,
    wrapIpc(async (_, url: string) => {
      const reposJson = await settingsRepo.get('source_repositories')
      let repos: string[] = reposJson ? JSON.parse(reposJson) : []
      repos = repos.filter((r) => r !== url)
      await settingsRepo.set('source_repositories', JSON.stringify(repos))
    })
  )

  registerHandler(
    IpcChannel.SOURCES_REFRESH_ALL,
    wrapIpc(async () => {
      const reposJson = await settingsRepo.get('source_repositories')
      const repos: string[] = reposJson ? JSON.parse(reposJson) : []
      const { sourceService } = await import('@common/services/source.service')
      const templatesRes = await templateService.loadAllRepositories(repos)
      await sourceService.loadAllRepositories(repos)

      const { pluginService } = await import('@common/services/plugin.service')
      const enabledJson = await settingsRepo.get('pluginsEnabled')
      if (enabledJson) {
        try {
          pluginService.setEnabledPlugins(JSON.parse(enabledJson))
        } catch (e) {}
      }
      await pluginService.loadAllRepositories(repos)

      return templatesRes as any
    })
  )

  registerHandler(
    IpcChannel.PLUGINS_GET_ALL,
    wrapIpc(async () => {
      const { pluginService } = await import('@common/services/plugin.service')
      const plugins = pluginService.getAllPlugins()
      const enabledIds = pluginService.getEnabledPluginIds()

      return plugins.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        author: p.author,
        version: p.version,
        target: p.target,
        enabled: enabledIds.includes(p.id)
      }))
    })
  )

  registerHandler(
    IpcChannel.PLUGINS_TOGGLE,
    wrapIpc(async (_, id: string, enabled: boolean) => {
      const { pluginService } = await import('@common/services/plugin.service')

      let enabledIds = pluginService.getEnabledPluginIds()
      if (enabled) {
        if (!enabledIds.includes(id)) enabledIds.push(id)
      } else {
        enabledIds = enabledIds.filter((x) => x !== id)
      }

      pluginService.setEnabledPlugins(enabledIds)
      await settingsRepo.set('pluginsEnabled', JSON.stringify(enabledIds))
    })
  )

  registerHandler(
    IpcChannel.SOURCES_GET_ALL,
    wrapIpc(async () => {
      const { sourceService } = await import('@common/services/source.service')
      return sourceService.getAllSources()
    })
  )

  registerHandler(
    IpcChannel.SOURCES_GET_CATALOG_EXTENSIONS,
    wrapIpc(async () => {
      const { sourceService } = await import('@common/services/source.service')
      const sources = sourceService.getAllSources()

      return sources.map((s: any) => ({
        pkg: s.id,
        name: s.name,
        lang: s.lang || s.language || 'all',
        icon: `autakimi-cache://local-icon/${s.id}.png`,
        version: s.version || '0.0.0',
        baseUrl: s.baseUrl || s.url || '',
        nsfw: !!s.nsfw,
        repoUrl: 'remote' // Denotes it's managed via remote repository
      })) as any
    })
  )
}

