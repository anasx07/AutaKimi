import { AutakimiPlugin, pluginService } from '@common'
import vm from 'vm'
import { BrowserWindow } from 'electron'
import { AppService, ServicePriority } from './service.registry'
import { settingsRepo } from '../db'
import { sourceService, templateService } from '@common'

export class PluginManager implements AppService {
  public priority = ServicePriority.PLUGIN

  constructor() {}

  async initialize(): Promise<void> {
    pluginService.setExecutor(this.executePlugin.bind(this))
    
    // Load plugins and enabled state from database at startup
    try {
      const reposJson = await settingsRepo.get('source_repositories')
      const enabledJson = await settingsRepo.get('pluginsEnabled')
      
      if (enabledJson) {
        try {
          pluginService.setEnabledPlugins(JSON.parse(enabledJson))
        } catch (e) {}
      }

      // Offline Cache Hydration: Load permanently installed plugins so they work completely offline
      const installedJson = await settingsRepo.get('installed_plugins')
      if (installedJson) {
        try {
          const installed = JSON.parse(installedJson)
          if (Array.isArray(installed)) {
            for (const p of installed) {
              pluginService.registerDynamicPlugin(p)
            }
            console.log(`[PluginManager] Hydrated ${installed.length} installed plugins from offline cache.`)
          }
        } catch (e) {
          console.error('[PluginManager] Failed to parse installed plugins from offline cache:', e)
        }
      }

      if (reposJson) {
        const repos = JSON.parse(reposJson)
        if (Array.isArray(repos) && repos.length > 0) {
          console.log(`[PluginManager] Hydrating ${repos.length} repositories...`)
          await Promise.all([
            pluginService.loadAllRepositories(repos),
            templateService.loadAllRepositories(repos),
            sourceService.loadAllRepositories(repos)
          ])
        }
      }
    } catch (e) {
      console.error('[PluginManager] Failed to load plugins at startup:', e)
    }

    console.log('[PluginManager] Initialized with sandboxed VM executor.')
  }

  async shutdown(): Promise<void> {
    // Cleanup if needed
  }

  private async executePlugin(plugin: AutakimiPlugin, context: any): Promise<import('@common').PluginDisposer | void> {
    console.log(`[PluginManager] Executing plugin: ${plugin.name} (${plugin.id})`)
    
    // Create a safe proxy for the window if present to prevent direct access to Electron internals
    const safeContext = { ...context }
    if (context.win && context.win instanceof BrowserWindow) {
      const win = context.win
      safeContext.win = {
        isDestroyed: () => win.isDestroyed(),
        getTitle: () => win.getTitle(),
        webContents: {
          executeJavaScript: (script: string) => {
             if (win.isDestroyed()) return Promise.resolve();
             return win.webContents.executeJavaScript(script);
          },
          sendInputEvent: (event: any) => {
             if (win.isDestroyed()) return;
             win.webContents.sendInputEvent(event);
          }
        }
      }
    }

    const activeTimeouts = new Set<any>()
    const activeIntervals = new Set<any>()

    const wrappedSetTimeout = (callback: (...args: any[]) => void, ms?: number, ...args: any[]) => {
      const id = setTimeout(() => {
        activeTimeouts.delete(id)
        try {
          callback(...args)
        } catch (err) {
          console.error(`[Plugin:${plugin.id}] setTimeout error:`, err)
        }
      }, ms, ...args)
      activeTimeouts.add(id)
      return id
    }

    const wrappedClearTimeout = (id: any) => {
      if (id) {
        clearTimeout(id)
        activeTimeouts.delete(id)
      }
    }

    const wrappedSetInterval = (callback: (...args: any[]) => void, ms?: number, ...args: any[]) => {
      const id = setInterval(() => {
        try {
          callback(...args)
        } catch (err) {
          console.error(`[Plugin:${plugin.id}] setInterval error:`, err)
        }
      }, ms, ...args)
      activeIntervals.add(id)
      return id
    }

    const wrappedClearInterval = (id: any) => {
      if (id) {
        clearInterval(id)
        activeIntervals.delete(id)
      }
    }

    const cleanupTimers = () => {
      for (const id of activeTimeouts) {
        clearTimeout(id)
      }
      activeTimeouts.clear()
      for (const id of activeIntervals) {
        clearInterval(id)
      }
      activeIntervals.clear()
    }

    const sandbox: any = {
      context: safeContext,
      console: {
        log: (...args: any[]) => console.log(`[Plugin:${plugin.id}]`, ...args),
        error: (...args: any[]) => console.error(`[Plugin:${plugin.id}] Error:`, ...args)
      },
      setTimeout: wrappedSetTimeout,
      setInterval: wrappedSetInterval,
      clearTimeout: wrappedClearTimeout,
      clearInterval: wrappedClearInterval,
      Promise,
      Buffer: {
         from: (arg: any, enc?: any) => Buffer.from(arg, enc)
      },
      URL,
      Math,
      Date,
      JSON,
      __pluginCode: plugin.code,
      __disposer: null
    }

    const vmContext = vm.createContext(sandbox)
    
    const wrapper = `
      (async () => {
        try {
          const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
          const getExecutor = new AsyncFunction('context', 'console', __pluginCode);
          const executor = await getExecutor(context, console);
          
          if (typeof executor === 'function') {
            const result = await executor(context);
            if (typeof result === 'function') {
              __disposer = result;
            }
          } else {
            console.error('Plugin did not return a valid executor function');
          }
        } catch (e) {
          console.error('Execution error: ' + e.message);
        }
      })()
    `

    try {
      const script = new vm.Script(wrapper)
      const resultPromise = script.runInContext(vmContext, { timeout: 30000 })
      
      let timeoutId: NodeJS.Timeout
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Plugin execution timed out')), 30000)
      })

      try {
        await Promise.race([resultPromise, timeoutPromise])
      } finally {
        clearTimeout(timeoutId!)
      }
      
      // Return host wrapper disposer that clears all timers
      return () => {
        cleanupTimers()
        if (sandbox.__disposer) {
          try {
            const disposerScript = new vm.Script('if (typeof __disposer === "function") __disposer()')
            disposerScript.runInContext(vmContext)
          } catch (e: any) {
            console.error(`[PluginManager] Disposer Error for ${plugin.id}:`, e.message)
          }
        }
      }
    } catch (e: any) {
      cleanupTimers()
      console.error(`[PluginManager] VM Critical Error for ${plugin.id}:`, e.message)
    }
  }
}

export const pluginManager = new PluginManager()
