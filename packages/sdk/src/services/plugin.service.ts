import { networkClient } from './network'

export interface PluginManifest {
  id: string
  name: string
  description: string
  author: string
  version: string
  target: string
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

  async loadAllRepositories(urls: string[]): Promise<{ success: boolean; totalCount: number }> {
    let totalCount = 0
    for (const url of urls) {
      try {
        // If the URL ends with templates.json, fetch plugins.json from the same directory
        let pluginUrl = url
        if (url.endsWith('templates.json')) {
          pluginUrl = url.replace('templates.json', 'plugins.json')
        } else if (!url.endsWith('plugins.json')) {
          pluginUrl = url.endsWith('/') ? `${url}plugins.json` : `${url}/plugins.json`
        }
        
        const res = await this.fetchPlugins(pluginUrl)
        if (res.success) totalCount += res.count
      } catch (e) {
        console.warn(`[PluginService] Error parsing plugin URL ${url}:`, e)
      }
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

  private registerDynamicPlugin(def: any) {
    try {
      this.plugins.set(def.id, {
        id: def.id,
        name: def.name,
        description: def.description,
        author: def.author,
        version: def.version,
        target: def.target,
        code: def.code
      })
      console.log(`[PluginService] Registered plugin metadata: ${def.name}`)
    } catch (err) {
      console.error(`[PluginService] Failed to register plugin ${def.name}:`, err)
    }
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

  getEnabledPluginsByTarget(target: string): AutakimiPlugin[] {
    return this.getAllPlugins().filter(p => p.target === target && this.enabledPlugins.has(p.id))
  }
}

export const pluginService = PluginService.getInstance()
