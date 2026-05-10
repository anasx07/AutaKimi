import { net } from 'electron'
import { Worker } from 'worker_threads'
import path from 'path'
import { extensionRepo, settingsRepo } from '../db'
import { NetworkService, ExtensionEngine, IExtensionPlatform, networkClient } from '@common'
import * as crypto from 'crypto'
import { AppService } from './service.registry'

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

  constructor() {
    this.initPool()
  }

  private initPool() {
    for (let i = 0; i < this.maxWorkers; i++) {
      const worker = new Worker(path.join(__dirname, 'extension-worker.js'))
      const workerEntry = { worker, isBusy: false, id: i }

      worker.on('message', (msg) => {
        const resolver = this.activeResolvers.get(msg.id)
        if (resolver) {
          clearTimeout(resolver.timeout)
          resolver.resolve(msg.result)
          this.activeResolvers.delete(msg.id)
        }
        workerEntry.isBusy = false
        this.processQueue()
      })

      worker.on('error', (err) => {
        console.error(`[WorkerPool] Worker ${i} error:`, err)
        workerEntry.isBusy = false
        this.processQueue()
      })

      this.workers.push(workerEntry)
    }
    console.log(`[WorkerPool] Initialized with ${this.maxWorkers} workers.`)
  }

  async runInSandbox(code: string, params: Record<string, any>): Promise<any> {
    const id = crypto.randomUUID()
    return new Promise((resolve) => {
      this.taskQueue.push({ id, code, params, resolve })
      this.processQueue()
    })
  }

  private processQueue() {
    const availableWorker = this.workers.find((w) => !w.isBusy)
    if (availableWorker && this.taskQueue.length > 0) {
      const task = this.taskQueue.shift()!
      availableWorker.isBusy = true

      const timeout = setTimeout(() => {
        const resolver = this.activeResolvers.get(task.id)
        if (resolver) {
          resolver.resolve({ error: 'Worker timed out' })
          this.activeResolvers.delete(task.id)
        }
        availableWorker.isBusy = false
        this.processQueue()
      }, 30000)

      this.activeResolvers.set(task.id, { resolve: task.resolve, timeout })
      availableWorker.worker.postMessage({ id: task.id, code: task.code, params: task.params })
    }
  }

  shutdown() {
    this.workers.forEach((w) => w.worker.terminate())
  }
}

export class ExtensionOrchestrator implements IExtensionPlatform, AppService {
  private static instance: ExtensionOrchestrator
  private workerPool: WorkerPool
  private engine: ExtensionEngine

  private constructor() {
    this.workerPool = new WorkerPool()
    this.engine = new ExtensionEngine(this)
  }

  public static getInstance(): ExtensionOrchestrator {
    if (!ExtensionOrchestrator.instance) {
      ExtensionOrchestrator.instance = new ExtensionOrchestrator()
    }
    return ExtensionOrchestrator.instance
  }

  async initialize(): Promise<void> {
    // Already handled in constructor or ServiceRegistry order
  }

  async shutdown(): Promise<void> {
    this.workerPool.shutdown()
  }

  // --- IExtensionPlatform Implementation ---

  async fetch(url: string, init?: any): Promise<any> {
    const res = await networkClient.fetch(url, init)
    if (res.ok) return res.value
    throw new Error(res.error || `Fetch failed with status ${res.status}`)
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

  async getExtension(pkg: string): Promise<any> {
    return extensionRepo.get(pkg)
  }

  // --- Public Engine Accessors ---

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
   * @deprecated Use networkClient.fetch() instead
   */
  async electronFetch(url: string, init?: any): Promise<any> {
    try {
      const response = await net.fetch(url, init)
      return response
    } catch (e) {
      console.error('[ExtensionOrchestrator] electronFetch error:', e)
      throw e
    }
  }
}

export const extensionOrchestrator = ExtensionOrchestrator.getInstance()
