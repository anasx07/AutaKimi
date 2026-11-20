import { AutakimiPlugin, pluginService, extensionRegistryOrchestrator } from '@common'
import path from 'path'
import { Worker } from 'worker_threads'
import { AppService, ServicePriority } from './service.registry'
import { extensionRepo, settingsRepo } from '../db'

/**
 * Strictly-typed action that the plugin worker may request against a window.
 * The main process validates and executes these against the actual BrowserWindow.
 */
export type WinActionName = 'executeJavaScript' | 'sendInputEvent' | 'isDestroyed' | 'getTitle'

export type WinActionHandler = (
  action: WinActionName,
  payload: { script?: string; event?: unknown }
) => Promise<unknown>

/**
 * The new context shape passed into `pluginService.runPlugin`. Instead of a
 * raw BrowserWindow, the plugin receives an opaque winId and a handler
 * implementation that proxies window operations through the main process.
 */
export interface PluginRunContext {
  winId: string
  winActionHandler: WinActionHandler
  [key: string]: unknown
}

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (err: Error) => void
  pluginId: string
}

interface ActivePlugin {
  winId: string
  winActionHandler: WinActionHandler
}

interface WorkerExecuteMsg {
  requestId: string
  pluginId: string
  code: string
  context: PluginRunContext
}

interface WorkerDisposeMsg {
  requestId: string
  pluginId: string
}

interface WorkerWinActionRequestMsg {
  replyId: string
  winId: string
  action: WinActionName
  payload?: { script?: string; event?: unknown }
}

interface WorkerDisposeDoneMsg {
  requestId: string
  ok: boolean
  error?: string
}

interface WorkerExecuteSuccessMsg {
  requestId: string
  hasDisposer: boolean
}

interface WorkerExecuteErrorMsg {
  requestId: string
  error: string
}

interface WorkerLogMsg {
  level: 'log' | 'error' | 'warn' | 'info' | 'debug'
  args: unknown[]
}

type WorkerMessage =
  | { type: 'READY' }
  | { type: 'EXECUTE_SUCCESS'; requestId: string; hasDisposer: boolean }
  | { type: 'EXECUTE_ERROR'; requestId: string; error: string }
  | { type: 'WIN_ACTION_REQUEST'; replyId: string; winId: string; action: WinActionName; payload?: { script?: string; event?: unknown } }
  | { type: 'LOG'; level: WorkerLogMsg['level']; args: unknown[] }
  | { type: 'DISPOSE_DONE'; requestId: string; ok: boolean; error?: string }

export class PluginManager implements AppService {
  public priority = ServicePriority.PLUGIN

  private worker: Worker | null = null
  private nextRequestId = 1
  private pendingRequests = new Map<string, PendingRequest>()
  private activePlugins = new Map<string, ActivePlugin>()
  private isShuttingDown = false
  private workerReady: Promise<void>
  private resolveWorkerReady!: () => void
  private rejectWorkerReady!: (err: Error) => void

  constructor() {
    this.workerReady = new Promise<void>((resolve, reject) => {
      this.resolveWorkerReady = resolve
      this.rejectWorkerReady = reject
    })
  }

  async initialize(): Promise<void> {
    pluginService.setExecutor((plugin, context) => this.executePlugin(plugin, context))

    await this.spawnWorker()

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
            console.log(
              `[PluginManager] Hydrated ${installed.length} installed plugins from offline cache.`
            )
          }
        } catch (e) {
          console.error('[PluginManager] Failed to parse installed plugins from offline cache:', e)
        }
      }

      if (reposJson) {
        const repos = JSON.parse(reposJson)
        if (Array.isArray(repos) && repos.length > 0) {
          console.log(`[PluginManager] Hydrating ${repos.length} repositories...`)
          
          let installedLangs: string[] = []
          try {
            const installedDb = await extensionRepo.getAll()
            installedLangs = Array.from(new Set(installedDb.map((e) => e.lang || 'en')))
          } catch (e) {
            console.warn('[PluginManager] Failed to get installed languages:', e)
          }

          await extensionRegistryOrchestrator.syncRepositories(repos, installedLangs)
        }
      }
    } catch (e) {
      console.error('[PluginManager] Failed to load plugins at startup:', e)
    }

    console.log('[PluginManager] Initialized with isolated worker executor.')
  }

  async shutdown(): Promise<void> {
    this.isShuttingDown = true
    if (this.worker) {
      try {
        this.worker.postMessage({ type: 'SHUTDOWN' })
      } catch {
        // Worker may have already exited
      }
      try {
        await this.worker.terminate()
      } catch (e) {
        console.warn('[PluginManager] Error terminating worker:', e)
      }
      this.worker = null
    }
    // Reject any in-flight requests
    for (const [, pending] of this.pendingRequests) {
      pending.reject(new Error('PluginManager shut down'))
    }
    this.pendingRequests.clear()
    this.activePlugins.clear()
  }

  // ─── Worker lifecycle ──────────────────────────────────────────────────────

  private spawnWorker(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      try {
        const worker = new Worker(path.join(__dirname, 'plugin-worker.js'))
        this.worker = worker

        worker.once('message', (msg: WorkerMessage) => {
          if (msg && (msg as { type?: string }).type === 'READY') {
            this.resolveWorkerReady()
            resolve()
          } else {
            const err = new Error('Plugin worker did not send READY')
            this.rejectWorkerReady(err)
            reject(err)
          }
        })

        const onMessage = (msg: WorkerMessage) => this.handleWorkerMessage(msg)
        worker.on('message', onMessage)

        worker.once('error', (err) => {
          console.error('[PluginManager] Plugin worker error:', err)
          if (!this.isShuttingDown) {
            this.rejectWorkerReady(err)
            reject(err)
          }
        })

        worker.once('exit', (code) => {
          if (code !== 0 && !this.isShuttingDown) {
            console.warn(`[PluginManager] Plugin worker exited with code ${code}; respawning in 1s`)
            this.worker = null
            setTimeout(() => {
              if (!this.isShuttingDown) {
                this.workerReady = new Promise<void>((res, rej) => {
                  this.resolveWorkerReady = res
                  this.rejectWorkerReady = rej
                })
                this.spawnWorker().catch((e) =>
                  console.error('[PluginManager] Failed to respawn plugin worker:', e)
                )
              }
            }, 1000)
          }
        })
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    })
  }

  private handleWorkerMessage(msg: WorkerMessage): void {
    switch (msg.type) {
      case 'READY':
        // Spawn-time READY is handled in the once listener
        return
      case 'EXECUTE_SUCCESS': {
        const m = msg as WorkerExecuteSuccessMsg
        const pending = this.pendingRequests.get(m.requestId)
        if (pending) {
          this.pendingRequests.delete(m.requestId)
          pending.resolve(m.hasDisposer)
        }
        return
      }
      case 'EXECUTE_ERROR': {
        const m = msg as WorkerExecuteErrorMsg
        const pending = this.pendingRequests.get(m.requestId)
        if (pending) {
          this.pendingRequests.delete(m.requestId)
          pending.reject(new Error(m.error))
        }
        return
      }
      case 'WIN_ACTION_REQUEST': {
        const m = msg as WorkerWinActionRequestMsg
        void this.routeWinAction(m)
        return
      }
      case 'LOG': {
        const m = msg as WorkerLogMsg
        const line = m.args
          .map((a) => (typeof a === 'string' ? a : JSON.stringify(a)))
          .join(' ')
        if (m.level === 'error') console.error('[Plugin-Worker]', line)
        else if (m.level === 'warn') console.warn('[Plugin-Worker]', line)
        else console.log('[Plugin-Worker]', line)
        return
      }
      case 'DISPOSE_DONE': {
        const m = msg as WorkerDisposeDoneMsg
        const pending = this.pendingRequests.get(m.requestId)
        if (pending) {
          this.pendingRequests.delete(m.requestId)
          if (m.ok) pending.resolve(undefined)
          else pending.reject(new Error(m.error ?? 'Dispose failed'))
        }
        return
      }
    }
  }

  private async routeWinAction(m: WorkerWinActionRequestMsg): Promise<void> {
    // Find the active plugin associated with this winId
    let handler: WinActionHandler | undefined
    for (const plugin of this.activePlugins.values()) {
      if (plugin.winId === m.winId) {
        handler = plugin.winActionHandler
        break
      }
    }

    if (!handler) {
      this.postToWorker({
        type: 'WIN_ACTION_REPLY',
        replyId: m.replyId,
        ok: false,
        error: `No active plugin registered for winId ${m.winId}`
      })
      return
    }

    try {
      const result = await handler(m.action, m.payload ?? {})
      this.postToWorker({
        type: 'WIN_ACTION_REPLY',
        replyId: m.replyId,
        ok: true,
        result
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.postToWorker({
        type: 'WIN_ACTION_REPLY',
        replyId: m.replyId,
        ok: false,
        error: message
      })
    }
  }

  private postToWorker(msg: unknown): void {
    if (this.worker) {
      try {
        this.worker.postMessage(msg)
      } catch (e) {
        console.warn('[PluginManager] Failed to post message to worker:', e)
      }
    }
  }

  /**
   * Notifies the plugin worker that a window has been destroyed, so the
   * worker's per-window sync `isDestroyed()` shim can return true without
   * round-tripping IPC on every check.
   */
  public notifyWindowDestroyed(winId: string): void {
    this.postToWorker({ type: 'WINDOW_DESTROYED', winId })
  }

  // ─── Executor (called by pluginService.runPlugin) ──────────────────────────

  private async executePlugin(
    plugin: AutakimiPlugin,
    context: PluginRunContext
  ): Promise<import('@common').PluginDisposer | void> {
    console.log(`[PluginManager] Executing plugin: ${plugin.name} (${plugin.id})`)

    if (!context || typeof context.winId !== 'string' || typeof context.winActionHandler !== 'function') {
      throw new Error(
        `Plugin ${plugin.id} requires context { winId, winActionHandler } (got invalid context)`
      )
    }

    // Wait for the worker to be ready
    await this.workerReady

    const requestId = String(this.nextRequestId++)

    // Register the active plugin for winAction routing
    this.activePlugins.set(plugin.id, {
      winId: context.winId,
      winActionHandler: context.winActionHandler
    })

    const executePromise = new Promise<boolean>((resolve, reject) => {
      this.pendingRequests.set(requestId, {
        resolve: (v) => resolve(Boolean(v)),
        reject,
        pluginId: plugin.id
      })
    })

    const msg: WorkerExecuteMsg = {
      requestId,
      pluginId: plugin.id,
      code: plugin.code,
      context: { winId: context.winId } as any
    }
    this.postToWorker({ type: 'EXECUTE', ...msg })

    let hasDisposer = false
    try {
      hasDisposer = await executePromise
    } catch (err) {
      this.activePlugins.delete(plugin.id)
      console.error(`[PluginManager] Plugin ${plugin.id} execution failed:`, err)
      throw err instanceof Error ? err : new Error(String(err))
    }

    if (!hasDisposer) {
      // Plugin didn't register a disposer; clean up
      this.activePlugins.delete(plugin.id)
      return
    }

    // Return a host-side disposer that asks the worker to invoke the plugin's disposer
    return async () => {
      const disposeRequestId = String(this.nextRequestId++)
      const disposePromise = new Promise<void>((resolve, reject) => {
        this.pendingRequests.set(disposeRequestId, {
          resolve: () => resolve(),
          reject,
          pluginId: plugin.id
        })
      })

      const disposeMsg: WorkerDisposeMsg = { requestId: disposeRequestId, pluginId: plugin.id }
      this.postToWorker({ type: 'DISPOSE', ...disposeMsg })

      try {
        await disposePromise
      } catch (err) {
        console.error(`[PluginManager] Disposer error for ${plugin.id}:`, err)
      } finally {
        this.activePlugins.delete(plugin.id)
      }
    }
  }
}

export const pluginManager = new PluginManager()
