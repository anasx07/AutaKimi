import { IpcChannel } from '@common/types/ipc'
import { extensionRepo, settingsRepo } from '../db'
import { sourceService } from '@common/services/source.service'
import { pluginService } from '@common/services/plugin.service'
import { extensionRegistryOrchestrator } from '@common/services/extensionRegistryOrchestrator'
import { registerHandler, wrapIpc, isValidUrl } from './utils'
import { getRepoMeta } from '@common/services/repoIdentity'

function isNewerVersion(remoteVersion?: string, currentVersion?: string): boolean {
  if (!remoteVersion || !currentVersion) return false
  const clean = (v: string) => v.trim().replace(/^v/i, '').split(/[-+]/)[0]
  const rClean = clean(remoteVersion)
  const cClean = clean(currentVersion)
  if (rClean === cClean) return false

  const p1 = rClean.split('.').map((n) => parseInt(n, 10) || 0)
  const p2 = cClean.split('.').map((n) => parseInt(n, 10) || 0)
  const maxLen = Math.max(p1.length, p2.length)

  for (let i = 0; i < maxLen; i++) {
    const v1 = p1[i] || 0
    const v2 = p2[i] || 0
    if (v1 > v2) return true
    if (v1 < v2) return false
  }
  return false
}

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
    wrapIpc(async (_, input: any) => {
      const url = typeof input === 'string' ? input : input?.value || input?.url
      if (typeof url !== 'string' || !isValidUrl(url)) throw new Error('Invalid URL')

      if (url.startsWith('autakimi-local://')) {
        let clean = decodeURIComponent(url.replace(/^autakimi-local:\/\//, ''))
        if (process.platform === 'win32' && /^\/[a-zA-Z]:/.test(clean)) {
          clean = clean.slice(1)
        }
        const { dirname } = await import('path')
        const { registerAllowedDirectory } = await import('@common/services/localFileInterceptor')
        registerAllowedDirectory(dirname(clean))
      }

      const reposJson = await settingsRepo.get('source_repositories')
      const repos: string[] = reposJson ? JSON.parse(reposJson) : []

      if (repos.includes(url)) {
        return { success: true, count: 0 } // Already exists
      }

      let installedLangs: string[] = []
      try {
        const installedDb = await extensionRepo.getAll()
        installedLangs = Array.from(new Set(installedDb.map((e) => e.lang || 'en')))
      } catch (e) {}

      // Validate and instantly sync via orchestrator
      const syncRes = await extensionRegistryOrchestrator.syncRepositories([url], installedLangs)
      if (!syncRes.success || syncRes.manifestsCount === 0) {
        throw new Error('Failed to resolve repository manifest')
      }

      repos.push(url)
      await settingsRepo.set('source_repositories', JSON.stringify(repos))

      return { success: true, count: syncRes.sourcesCount || syncRes.templatesCount }
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

      // Prune in-memory plugins that originated from remote repos unless permanently installed
      try {
        const installedJson = await settingsRepo.get('installed_plugins')
        const installedList: any[] = installedJson ? JSON.parse(installedJson) : []
        const installedIds = new Set(installedList.map((p) => p.id))
        for (const p of pluginService.getAllPlugins()) {
          if (!installedIds.has(p.id)) {
            pluginService.removePlugin(p.id)
          }
        }

        if (repos.length > 0) {
          let installedLangs: string[] = []
          try {
            const installedDb = await extensionRepo.getAll()
            installedLangs = Array.from(new Set(installedDb.map((e) => e.lang || 'en')))
          } catch (e) {}
          extensionRegistryOrchestrator.clearCache()
          await extensionRegistryOrchestrator.syncRepositories(repos, installedLangs)
        } else {
          extensionRegistryOrchestrator.clearCache()
        }
      } catch (err) {
        console.error('[SOURCES_REMOVE_REPO] Error cleaning up plugins:', err)
      }
    })
  )

  registerHandler(
    IpcChannel.SOURCES_REFRESH_ALL,
    wrapIpc(async () => {
      const reposJson = await settingsRepo.get('source_repositories')
      const repos: string[] = reposJson ? JSON.parse(reposJson) : []
      let installedLangs: string[] = []
      try {
        const installedDb = await extensionRepo.getAll()
        installedLangs = Array.from(new Set(installedDb.map((e) => e.lang || 'en')))
      } catch (e) {}

      const syncRes = await extensionRegistryOrchestrator.syncRepositories(repos, installedLangs)

      const enabledJson = await settingsRepo.get('pluginsEnabled')
      if (enabledJson) {
        try {
          pluginService.setEnabledPlugins(JSON.parse(enabledJson))
        } catch (e) {}
      }

      return { success: syncRes.success, totalCount: syncRes.templatesCount } as any
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
        const isUpdateAvailable = installedPlugin
          ? isNewerVersion(p?.version, installedPlugin.version)
          : false

        // All plugins originating from external repositories are installable by user choice
        // respecting 100% legal neutrality and explicit user consent (Mihon/Tachiyomi architecture)
        const isInstallable = p?.installable !== false

        return {
          id: p?.id || 'unknown',
          name: p?.name || 'Unknown',
          description: p?.description || '',
          author: p?.author || '',
          version: p?.version || '0.0.0',
          installedVersion: installedPlugin?.version,
          target: p?.target || 'unknown',
          code: p?.code || '',
          enabled: (!isInstallable || isInstalled) && enabledIds.includes(p?.id),
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

      const existingInMemory = pluginService.getAllPlugins().find((x) => x.id === plugin.id)
      const code = plugin.code || existingInMemory?.code || ''
      if (typeof code !== 'string' || !code) throw new Error('Invalid plugin code')

      const installedJson = await settingsRepo.get('installed_plugins')
      let installedList: any[] = installedJson ? JSON.parse(installedJson) : []

      const fullPlugin = {
        id: plugin.id,
        name: plugin.name,
        description: plugin.description || existingInMemory?.description || '',
        author: plugin.author || existingInMemory?.author || '',
        version: plugin.version || existingInMemory?.version || '0.0.0',
        target: plugin.target || existingInMemory?.target || 'unknown',
        code
      }

      const index = installedList.findIndex((p: any) => p.id === plugin.id)
      if (index !== -1) {
        installedList[index] = fullPlugin
      } else {
        installedList.push(fullPlugin)
      }

      await settingsRepo.set('installed_plugins', JSON.stringify(installedList))
      pluginService.registerDynamicPlugin(fullPlugin)

      // Auto-enable plugin on user installation
      let enabledIds = pluginService.getEnabledPluginIds()
      if (!enabledIds.includes(plugin.id)) {
        enabledIds.push(plugin.id)
        pluginService.setEnabledPlugins(enabledIds)
        await settingsRepo.set('pluginsEnabled', JSON.stringify(enabledIds))
      }
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
    wrapIpc(async (_, lang?: string) => {
      const reposJson = await settingsRepo.get('source_repositories')
      const repos: string[] = reposJson ? JSON.parse(reposJson) : []

      if (repos.length === 0) {
        extensionRegistryOrchestrator.clearCache()
        return []
      }

      if (!sourceService.hasCatalogFiles()) {
        let installedLangs: string[] = []
        try {
          const installedDb = await extensionRepo.getAll()
          installedLangs = Array.from(new Set(installedDb.map((e) => e.lang || 'en')))
        } catch (e) {}
        await extensionRegistryOrchestrator.syncRepositories(repos, installedLangs)
      }

      const targetLang = lang || 'all'
      await Promise.all([
        sourceService.fetchCatalogByLang(targetLang, 'manga'),
        sourceService.fetchCatalogByLang(targetLang, 'anime')
      ])

      const sources = sourceService.getAllSources()

      return sources.map((s: any) => {
        const fullPkg = s.pkg || s.id || ''
        const iconName = fullPkg.startsWith('ma.autakimi.extension.')
          ? `${fullPkg}.png`
          : `ma.autakimi.extension.${fullPkg}.png`
        const effectiveRepoUrl =
          s.repoUrl && s.repoUrl !== 'remote' ? s.repoUrl : repos[0] || 'remote'
        const meta = getRepoMeta(effectiveRepoUrl, s.repoName)
        const iconUrl =
          typeof s.icon === 'string' && s.icon.startsWith('http')
            ? s.icon
            : `autakimi-cache://local-icon/${iconName}`

        return {
          pkg: fullPkg,
          id: fullPkg,
          catalogKey: s.catalogKey || `${effectiveRepoUrl}::${fullPkg}`,
          name: s.name,
          lang: s.lang || s.language || 'all',
          icon: iconUrl,
          version: s.version || '0.0.0',
          baseUrl: s.baseUrl || s.url || '',
          nsfw: !!s.nsfw,
          repoUrl: effectiveRepoUrl,
          repoName: s.repoName || meta.repoName,
          repoColor: s.repoColor || meta.repoColor,
          isKeiyoushi: Boolean(s.isKeiyoushi || meta.isKeiyoushi),
          type: s.type || (fullPkg.toLowerCase().includes('anime') ? 'anime' : 'manga'),
          status: s.status,
          isFullySupported: s.isFullySupported !== undefined ? s.isFullySupported : undefined
        }
      }) as any
    })
  )

  registerHandler(
    IpcChannel.SOURCES_SELECT_DIRECTORY,
    wrapIpc(async () => {
      const { dialog } = await import('electron')
      const result = await dialog.showOpenDialog({
        title: 'Select Extension Manifest',
        message: 'Select the manifest.json file',
        properties: ['openFile'],
        filters: [{ name: 'Manifest File', extensions: ['json'] }]
      })
      if (result.canceled || result.filePaths.length === 0) {
        return null
      }

      const { dirname, basename } = await import('path')
      const filePath = result.filePaths[0]

      if (basename(filePath).toLowerCase() !== 'manifest.json') {
        const { dialog: errDialog } = await import('electron')
        errDialog.showErrorBox(
          'Invalid File',
          'You must select a file exactly named "manifest.json".'
        )
        return null
      }

      const dirPath = dirname(filePath)
      const { registerAllowedDirectory } = await import('@common/services/localFileInterceptor')
      registerAllowedDirectory(dirPath)

      // Encode the local path to ensure safe URI characters (e.g. spaces) while preserving slashes
      const encodedPath = encodeURI(dirPath.replace(/\\/g, '/'))
      return `autakimi-local://${encodedPath}/manifest.json`
    })
  )
}
