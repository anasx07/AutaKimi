import { networkClient } from './network'
import { repositoryService } from './repository.service'

export type PluginTarget = 'main-cloudflare' | 'renderer-reader' | (string & {})

export interface PluginManifest {
  id: string
  name: string
  description: string
  author: string
  version: string
  target: PluginTarget
  installable?: boolean
}

export interface AutakimiPlugin extends PluginManifest {
  code: string
}

export type PluginDisposer = () => void | Promise<void>
export type PluginExecutor = (plugin: AutakimiPlugin, context: any) => Promise<PluginDisposer | void>

export class PluginService {
  private static instance: PluginService
  private plugins = new Map<string, AutakimiPlugin>()
  private enabledPlugins = new Set<string>()
  private executor: PluginExecutor = async (plugin) => {
    console.warn(`[PluginService] No executor registered. Cannot run plugin: ${plugin.name}`)
  }

  public static getInstance(): PluginService {
    if (!PluginService.instance) {
      PluginService.instance = new PluginService()
    }
    return PluginService.instance
  }

  /**
   * Registers the platform-specific executor (e.g. VM-based for Desktop)
   */
  setExecutor(executor: PluginExecutor) {
    this.executor = executor
  }

  /**
   * Executes a specific plugin by ID with the given context.
   * Returns a disposer function if the plugin registered one.
   */
  async runPlugin(id: string, context: any): Promise<PluginDisposer | void> {
    const plugin = this.plugins.get(id)
    if (plugin && this.isPluginEnabled(id)) {
      try {
        return await this.executor(plugin, context)
      } catch (e) {
        console.error(`[PluginService] Error executing plugin ${id}:`, e)
      }
    }
  }

  async hydrateManifest(manifest: any): Promise<{ success: boolean; count: number }> {
    try {
      // Keiyoushi repositories are strictly extension repos and do not host plugins.json
      if (
        Boolean(manifest.isKeiyoushi) ||
        manifest.catalogs?.manga === 'index.json' ||
        manifest.catalogs?.manga === 'index.min.json'
      ) {
        return { success: true, count: 0 }
      }

      const pluginUrl = `${manifest.baseUrl}${manifest.plugins}`
      return await this.fetchPlugins(pluginUrl)
    } catch (e) {
      console.warn(`[PluginService] Error hydrating manifest at ${manifest.baseUrl}:`, e)
      return { success: false, count: 0 }
    }
  }

  async loadAllRepositories(urls: string[]): Promise<{ success: boolean; totalCount: number }> {
    let totalCount = 0
    const results = await Promise.all(
      urls.map(async (url) => {
        try {
          const manifest = await repositoryService.resolveManifest(url)
          return await this.hydrateManifest(manifest)
        } catch (e) {
          console.warn(`[PluginService] Error parsing plugin URL ${url}:`, e)
          return { success: false, count: 0 }
        }
      })
    )
    for (const res of results) {
      if (res.success) totalCount += res.count
    }
    return { success: true, totalCount }
  }

  async fetchPlugins(url: string): Promise<{ success: boolean; count: number; error?: string }> {
    try {
      const res = await networkClient.fetch(url)
      if (!res.ok) {
        throw new Error(`Network error: ${res.error}`)
      }
      
      const response = res.value
      if (!response.ok) {
        if (response.status === 404) {
          // Legitimately no plugins for this repo, treat as silent success with 0 count
          console.debug?.(`[PluginService] No plugins.json found at ${url} (404)`)
          return { success: true, count: 0 }
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const contentType = response.headers.get('content-type') || ''
      if (contentType.includes('text/html')) {
        console.debug?.(`[PluginService] Received HTML instead of JSON at ${url}, treating as 404.`)
        return { success: true, count: 0 }
      }

      const data = await response.json()
      if (!data.plugins || !Array.isArray(data.plugins)) {
        throw new Error('Invalid plugin repository format')
      }

      for (const item of data.plugins) {
        this.registerDynamicPlugin(item)
      }

      return { success: true, count: data.plugins.length }
    } catch (err: any) {
      console.warn(`[PluginService] Failed to load plugins from ${url}:`, err.message || err)
      return { success: false, count: 0, error: err.message }
    }
  }

  registerDynamicPlugin(def: any) {
    try {
      this.plugins.set(def.id, {
        id: def.id,
        name: def.name,
        description: def.description,
        author: def.author,
        version: def.version,
        target: def.target,
        code: def.code,
        installable: def.installable
      })
      console.log(`[PluginService] Registered plugin metadata: ${def.name}`)
    } catch (err) {
      console.error(`[PluginService] Failed to register plugin ${def.name}:`, err)
    }
  }

  removePlugin(id: string) {
    this.plugins.delete(id)
    this.enabledPlugins.delete(id)
  }

  getAllPlugins(): AutakimiPlugin[] {
    return Array.from(this.plugins.values())
  }

  setEnabledPlugins(ids: string[]) {
    this.enabledPlugins = new Set(ids)
  }

  getEnabledPluginIds(): string[] {
    return Array.from(this.enabledPlugins)
  }

  isPluginEnabled(id: string): boolean {
    return this.enabledPlugins.has(id)
  }

  getEnabledPluginsByTarget(target: PluginTarget): AutakimiPlugin[] {
    return this.getAllPlugins().filter(p => p.target === target && this.enabledPlugins.has(p.id))
  }
}

export const pluginService = PluginService.getInstance()
