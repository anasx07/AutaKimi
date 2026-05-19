import { IpcChannel } from '@common/types/ipc'
import { settingsRepo } from '../db'
import { templateService } from '@common/services/template.service'
import { sourceService } from '@common/services/source.service'
import { pluginService } from '@common/services/plugin.service'
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
      if (typeof url !== 'string') throw new Error('Invalid URL')
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

        // Instantly load plugins and sources from this new repository
        await sourceService.loadAllRepositories([url])
        await pluginService.loadAllRepositories([url])
      }
      return res as any
    })
  )

  registerHandler(
    IpcChannel.SOURCES_REMOVE_REPO,
    wrapIpc(async (_, url: string) => {
      if (typeof url !== 'string') throw new Error('Invalid URL')
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
      const templatesRes = await templateService.loadAllRepositories(repos)
      await sourceService.loadAllRepositories(repos)

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
      const plugins = pluginService.getAllPlugins() || []
      const enabledIds = pluginService.getEnabledPluginIds() || []
      const installedJson = await settingsRepo.get('installed_plugins')
      const installedList: any[] = installedJson ? JSON.parse(installedJson) : []

      return plugins.map((p) => {
        const installedPlugin = installedList.find((x: any) => x.id === p?.id)
        const isInstalled = !!installedPlugin
        const isUpdateAvailable = installedPlugin ? installedPlugin.version !== p?.version : false

        // A plugin is installable if p.installable !== false AND it is not targeted to Cloudflare (online-only/direct)
        const isCloudflare = p?.target === 'main-cloudflare' || p?.id === 'auto-solve-cloudflare' || p?.name?.toLowerCase().includes('cloudflare')
        const isInstallable = p?.installable !== false && !isCloudflare

        return {
          id: p?.id || 'unknown',
          name: p?.name || 'Unknown',
          description: p?.description || '',
          author: p?.author || '',
          version: p?.version || '0.0.0',
          target: p?.target || 'unknown',
          code: p?.code || '',
          enabled: enabledIds.includes(p?.id),
          installed: isInstalled,
          updateAvailable: isUpdateAvailable,
          installable: isInstallable
        }
      })
    })
  )

  registerHandler(
    IpcChannel.PLUGINS_TOGGLE,
    wrapIpc(async (_, id: string, enabled: boolean) => {
      if (typeof id !== 'string') throw new Error('Invalid id')
      if (typeof enabled !== 'boolean') throw new Error('Invalid enabled flag')
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
    IpcChannel.PLUGINS_INSTALL,
    wrapIpc(async (_, plugin: any) => {
      if (!plugin || typeof plugin !== 'object') throw new Error('Invalid plugin data')
      if (typeof plugin.id !== 'string') throw new Error('Invalid plugin ID')
      if (typeof plugin.name !== 'string') throw new Error('Invalid plugin name')
      if (typeof plugin.code !== 'string') throw new Error('Invalid plugin code')

      const installedJson = await settingsRepo.get('installed_plugins')
      let installedList: any[] = installedJson ? JSON.parse(installedJson) : []
      
      const fullPlugin = {
        id: plugin.id,
        name: plugin.name,
        description: plugin.description || '',
        author: plugin.author || '',
        version: plugin.version || '0.0.0',
        target: plugin.target || 'unknown',
        code: plugin.code
      }

      const index = installedList.findIndex((p: any) => p.id === plugin.id)
      if (index !== -1) {
        installedList[index] = fullPlugin
      } else {
        installedList.push(fullPlugin)
      }

      await settingsRepo.set('installed_plugins', JSON.stringify(installedList))
      pluginService.registerDynamicPlugin(fullPlugin)
    })
  )

  registerHandler(
    IpcChannel.PLUGINS_UNINSTALL,
    wrapIpc(async (_, id: string) => {
      if (typeof id !== 'string') throw new Error('Invalid id')
      const installedJson = await settingsRepo.get('installed_plugins')
      let installedList: any[] = installedJson ? JSON.parse(installedJson) : []
      
      installedList = installedList.filter((p: any) => p.id !== id)
      await settingsRepo.set('installed_plugins', JSON.stringify(installedList))
      
      pluginService.removePlugin(id)
      
      let enabledIds = pluginService.getEnabledPluginIds()
      if (enabledIds.includes(id)) {
        enabledIds = enabledIds.filter((x) => x !== id)
        pluginService.setEnabledPlugins(enabledIds)
        await settingsRepo.set('pluginsEnabled', JSON.stringify(enabledIds))
      }
    })
  )

  registerHandler(
    IpcChannel.SOURCES_GET_ALL,
    wrapIpc(async () => {
      return sourceService.getAllSources()
    })
  )

  registerHandler(
    IpcChannel.SOURCES_GET_CATALOG_EXTENSIONS,
    wrapIpc(async () => {
      const sources = sourceService.getAllSources()

      return sources.map((s: any) => ({
        pkg: s.id,
        name: s.name,
        lang: s.lang || s.language || 'all',
        icon: `autakimi-cache://local-icon/ma.autakimi.extension.${s.id}.png`,
        version: s.version || '0.0.0',
        baseUrl: s.baseUrl || s.url || '',
        nsfw: !!s.nsfw,
        repoUrl: 'remote' // Denotes it's managed via remote repository
      })) as any
    })
  )

  registerHandler(
    IpcChannel.SOURCES_SELECT_DIRECTORY,
    wrapIpc(async () => {
      const { dialog } = await import('electron')
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory']
      })
      if (result.canceled || result.filePaths.length === 0) {
        return null
      }
      return result.filePaths[0]
    })
  )
}

