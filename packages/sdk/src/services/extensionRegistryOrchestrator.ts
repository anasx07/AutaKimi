import { repositoryService, RepositoryManifest } from './repository.service'
import { templateService } from './template.service'
import { pluginService } from './plugin.service'
import { sourceService } from './source.service'

export interface SyncResult {
  success: boolean
  manifestsCount: number
  templatesCount: number
  pluginsCount: number
  sourcesCount: number
}

export class ExtensionRegistryOrchestrator {
  private static instance: ExtensionRegistryOrchestrator
  private repositoryCache = new Map<string, RepositoryManifest>()

  public static getInstance(): ExtensionRegistryOrchestrator {
    if (!ExtensionRegistryOrchestrator.instance) {
      ExtensionRegistryOrchestrator.instance = new ExtensionRegistryOrchestrator()
    }
    return ExtensionRegistryOrchestrator.instance
  }

  /**
   * Unified single-pass parallel orchestration for loading and hydrating all remote extension repositories.
   * Eliminates duplicate manifest resolutions and resolves Templates, Plugins, and Catalogs in a single pass.
   */
  async syncRepositories(urls: string[], installedLangs: string[] = []): Promise<SyncResult> {
    if (!urls || urls.length === 0) {
      return {
        success: true,
        manifestsCount: 0,
        templatesCount: 0,
        pluginsCount: 0,
        sourcesCount: 0
      }
    }

    // Step 1: Single-pass parallel manifest resolution
    const manifests = await Promise.all(
      urls.map(async (url) => {
        try {
          const manifest = await repositoryService.resolveManifest(url)
          this.repositoryCache.set(url, manifest)
          return manifest
        } catch (e) {
          console.error(`[ExtensionRegistryOrchestrator] Error resolving manifest for ${url}:`, e)
          return null
        }
      })
    )

    const validManifests = manifests.filter((m): m is RepositoryManifest => m !== null)

    // Reset catalog index files before hydration
    sourceService.resetCatalogFiles()

    // Step 2: Atomic multi-resource hydration in parallel across Templates, Plugins, and Sources
    let totalTemplates = 0
    let totalPlugins = 0
    let totalSources = 0

    await Promise.all(
      validManifests.map(async (manifest) => {
        const [tRes, pRes, sRes] = await Promise.all([
          templateService.hydrateManifest(manifest),
          pluginService.hydrateManifest(manifest),
          sourceService.hydrateManifest(manifest, installedLangs)
        ])

        totalTemplates += tRes?.count || 0
        totalPlugins += pRes?.count || 0
        totalSources += sRes?.totalCount || 0
      })
    )

    return {
      success: true,
      manifestsCount: validManifests.length,
      templatesCount: totalTemplates,
      pluginsCount: totalPlugins,
      sourcesCount: totalSources
    }
  }

  getCachedManifest(url: string): RepositoryManifest | undefined {
    return this.repositoryCache.get(url)
  }

  getAllCachedManifests(): RepositoryManifest[] {
    return Array.from(this.repositoryCache.values())
  }
}

export const extensionRegistryOrchestrator = ExtensionRegistryOrchestrator.getInstance()
