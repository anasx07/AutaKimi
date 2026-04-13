import { net } from 'electron'
import { Worker } from 'worker_threads'
import path from 'path'
import { extensionRepo, settingsRepo } from '../db'
import { NetworkService } from '../../common/services/network'
import * as crypto from 'crypto'
import { AppService } from './service.registry'
import { ExtensionEngine, IExtensionPlatform } from '../../common/engines/extension.engine'

class WorkerPool {
  private workers: { worker: Worker; isBusy: boolean; id: number }[] = []
  private maxWorkers = 4
  private taskQueue: {
    id: string
    code: string
    params: Record<string, any>
    resolve: (v: any) => void
  }[] = []
  private activeResolvers: Map<string, { resolve: (v: any) => void; timeout: NodeJS.Timeout }> =
    new Map()
  private workerIdCounter = 0
  private initialized = false

  public initialize(maxWorkers = 4) {
    if (this.initialized) return
    this.initialized = true
    this.maxWorkers = maxWorkers
    for (let i = 0; i < this.maxWorkers; i++) {
      this.spawnWorker()
    }
    console.log(`[WorkerPool] Initialized with ${this.maxWorkers} workers.`)
  }

  private spawnWorker() {
    const workerPath = path.join(__dirname, 'extension-worker.js')
    const workerId = this.workerIdCounter++
    const worker = new Worker(workerPath, {
      resourceLimits: {
        maxOldGenerationSizeMb: 64,
        maxYoungGenerationSizeMb: 16,
        codeRangeSizeMb: 16
      }
    })

    const workerObj = { worker, isBusy: false, id: workerId }
    this.workers.push(workerObj)

    worker.on(
      'message',
      async (msg: {
        id: string
        type?: string
        fetchId?: string
        url?: string
        init?: RequestInit
        result?: any
        error?: string
      }) => {
        // Handle fetch delegation from the sandbox (CF bypass path)
        if (msg.type === 'WORKER_FETCH' && msg.fetchId && msg.url) {
          try {
            const bypassCf = (await settingsRepo.get('bypass_cloudflare')) === 'true'
            const response = await ExtensionOrchestrator.getInstance().fetch(
              msg.url,
              msg.init || {},
              bypassCf
            )
            const body = await response.text()
            // Only send serializable primitives — functions cannot cross postMessage
            worker.postMessage({
              type: 'FETCH_REPLY',
              fetchId: msg.fetchId,
              body,
              ok: response.ok,
              status: response.status
            })
          } catch (e: unknown) {
            const errMsg = e instanceof Error ? e.message : String(e)
            console.error(`[WorkerPool] WORKER_FETCH error for ${msg.url}:`, errMsg)
            worker.postMessage({
              type: 'FETCH_REPLY',
              fetchId: msg.fetchId,
              body: errMsg,
              ok: false,
              status: 500
            })
          }
          return
        }

        // Normal task completion
        workerObj.isBusy = false
        const resolver = this.activeResolvers.get(msg.id)
        if (resolver) {
          clearTimeout(resolver.timeout)
          this.activeResolvers.delete(msg.id)
          if (msg.error) resolver.resolve({ error: msg.error })
          else resolver.resolve(msg.result || msg)
        }
        this.processQueue()
      }
    )

    worker.on('error', (err) => {
      console.error(`[WorkerPool] Worker ${workerId} error:`, err)
      this.recreateWorker(workerObj)
    })

    worker.on('exit', (code) => {
      if (code !== 0) console.error(`[WorkerPool] Worker ${workerId} exited with code ${code}`)
      this.recreateWorker(workerObj)
    })
  }

  private recreateWorker(workerObj: { worker: Worker; isBusy: boolean; id: number }) {
    workerObj.worker.terminate().catch(() => {})
    this.workers = this.workers.filter((w) => w !== workerObj)

    if (this.initialized) {
      this.spawnWorker()
      this.processQueue()
    }
  }

  public async runInSandbox(code: string, params: Record<string, any> = {}): Promise<any> {
    if (!this.initialized) this.initialize()

    return new Promise((resolve) => {
      const taskId = crypto.randomUUID()
      this.taskQueue.push({ id: taskId, code, params, resolve })
      this.processQueue()
    })
  }

  private processQueue() {
    if (this.taskQueue.length === 0) return

    const availableWorker = this.workers.find((w) => !w.isBusy)
    if (!availableWorker) return

    const task = this.taskQueue.shift()!
    availableWorker.isBusy = true

    const timeout = setTimeout(() => {
      this.activeResolvers.delete(task.id)
      task.resolve({ error: 'Sandbox execution timed out (30s)' })

      // If a task times out, assume VM is stuck and cycle the worker
      availableWorker.isBusy = false
      console.warn(`[WorkerPool] Task ${task.id} timed out. Terminating stuck worker.`)
      this.recreateWorker(availableWorker)
    }, 30000)

    this.activeResolvers.set(task.id, { resolve: task.resolve, timeout })
    availableWorker.worker.postMessage({ id: task.id, code: task.code, params: task.params })

    this.processQueue() // Check next
  }

  public async shutdown() {
    this.initialized = false
    this.taskQueue = []
    for (const resolver of this.activeResolvers.values()) {
      clearTimeout(resolver.timeout)
      resolver.resolve({ error: 'WorkerPool is shutting down' })
    }
    this.activeResolvers.clear()

    const terminations = this.workers.map((w) => w.worker.terminate())
    await Promise.all(terminations)
    this.workers = []
  }
}

/**
 * ExtensionOrchestrator handles the complete lifecycle of extensions:
 * - Installation and theme detection
 * - Template generation
 * - Isolated sandbox execution
 * - Configuration and persistence
 */
export class ExtensionOrchestrator implements AppService, IExtensionPlatform {
  private static instance: ExtensionOrchestrator
  private workerPool = new WorkerPool()
  private engine: ExtensionEngine

  constructor() {
    this.engine = new ExtensionEngine(this)
  }

  public static getInstance(): ExtensionOrchestrator {
    if (!ExtensionOrchestrator.instance) {
      ExtensionOrchestrator.instance = new ExtensionOrchestrator()
    }
    return ExtensionOrchestrator.instance
  }

  // --- IExtensionPlatform Implementation ---

  async fetch(url: string, init?: any, bypassCf = false): Promise<any> {
    const fetchFn = bypassCf ? this.electronFetch.bind(this) : fetch
    const response = await NetworkService.fetchWithRetry(url, init, 3, 1000, fetchFn)
    return response // Duck-typing for IExtensionPlatform response
  }

  async runSandbox(code: string, params: Record<string, any>): Promise<any> {
    return this.workerPool.runInSandbox(code, params)
  }

  async getSetting(key: string): Promise<string | null> {
    return settingsRepo.get(key)
  }

  async upsertExtension(ext: any): Promise<void> {
    await extensionRepo.upsert(ext)
  }

  // --- Service Lifecycle ---

  async initialize(): Promise<void> {
    this.workerPool.initialize(4)
  }

  async shutdown(): Promise<void> {
    await this.workerPool.shutdown()
  }

  // --- Logic delegation to Engine ---

  async runInSandbox(code: string, params: Record<string, any> = {}): Promise<any> {
    return this.engine.execute('', code, params)
  }

  async detectTheme(url: string, bypassCf = true): Promise<'madara' | 'mangastream' | 'unknown'> {
    return this.engine.detectTheme(url, bypassCf)
  }

  async install(ext: any, repoUrl: string): Promise<{ success: boolean }> {
    return this.engine.install(ext, repoUrl)
  }

  // --- Electron Specific Utilities ---

  /**
   * Electron-native fetch wrapper using net.fetch for automatic cookie/session handling
   */
  async electronFetch(url: string, init?: any): Promise<any> {
    try {
      // net.fetch uses the default session cookies automatically
      const response = await net.fetch(url, init)
      return response
    } catch (e) {
      console.error('[ExtensionOrchestrator] electronFetch error:', e)
      throw e
    }
  }
}

export const extensionOrchestrator = ExtensionOrchestrator.getInstance()
