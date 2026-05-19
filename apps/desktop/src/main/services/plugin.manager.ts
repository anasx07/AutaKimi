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

    const sandbox: any = {
      context: safeContext,
      console: {
        log: (...args: any[]) => console.log(`[Plugin:${plugin.id}]`, ...args),
        error: (...args: any[]) => console.error(`[Plugin:${plugin.id}] Error:`, ...args)
      },
      setTimeout,
      setInterval,
      clearTimeout,
      clearInterval,
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
      
      // If the plugin returned a disposer, wrap it for the host
      if (sandbox.__disposer) {
        return () => {
          try {
            const disposerScript = new vm.Script('if (typeof __disposer === "function") __disposer()')
            disposerScript.runInContext(vmContext)
          } catch (e: any) {
            console.error(`[PluginManager] Disposer Error for ${plugin.id}:`, e.message)
          }
        }
      }
    } catch (e: any) {
      console.error(`[PluginManager] VM Critical Error for ${plugin.id}:`, e.message)
    }
  }
}

export const pluginManager = new PluginManager()
