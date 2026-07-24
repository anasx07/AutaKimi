import { net } from 'electron'
import { Worker } from 'worker_threads'
import path from 'path'
import { extensionRepo, settingsRepo } from '../db'
import fs from 'fs'
import { app } from 'electron'
import { ExtensionEngine, IExtensionPlatform, networkClient } from '@common'
import * as crypto from 'crypto'
import { AppService, ServicePriority } from './service.registry'

class WorkerPool {
  private workers: { worker: Worker; isBusy: boolean; id: number; pkg?: string; currentTaskId?: string }[] = []
  private maxWorkers = 4
  private taskQueue: {
    id: string
    pkg: string
    code: string
    params: Record<string, any>
    resolve: (v: any) => void
  }[] = []
  private activeResolvers: Map<string, { resolve: (v: any) => void; timeout: NodeJS.Timeout }> =
    new Map()

  constructor() {
    this.initPool()
  }

  private createWorker(id: number) {
    const worker = new Worker(path.join(__dirname, 'extension-worker.js'))
    const workerEntry: { worker: Worker; isBusy: boolean; id: number; pkg?: string; currentTaskId?: string } = {
      worker,
      isBusy: false,
      id,
      pkg: undefined,
      currentTaskId: undefined
    }

    worker.on('message', async (msg) => {
      if (msg.type) {
        if (msg.type === 'WORKER_FETCH') {
          try {
            const res = await net.fetch(msg.url, msg.init)
            const body = await res.text()
            worker.postMessage({
              type: 'FETCH_REPLY',
              fetchId: msg.fetchId,
              ok: res.ok,
              status: res.status,
              body
            })
          } catch (err: any) {
            console.error(`[WorkerPool] WORKER_FETCH error for ${msg.url}:`, err)
            worker.postMessage({
              type: 'FETCH_REPLY',
              fetchId: msg.fetchId,
              ok: false,
              status: 500,
              body: err.message || String(err)
            })
          }
        }
        return
      }

      const resolver = this.activeResolvers.get(msg.id)
      if (resolver) {
        clearTimeout(resolver.timeout)
        resolver.resolve(msg.result)
        this.activeResolvers.delete(msg.id)
      }
      workerEntry.isBusy = false
      workerEntry.pkg = undefined
      workerEntry.currentTaskId = undefined
      this.processQueue()
    })

    worker.on('error', (err) => {
      console.error(`[WorkerPool] Worker ${id} error:`, err)
      worker.terminate()
      const index = this.workers.indexOf(workerEntry)
      if (index !== -1) {
        this.workers[index] = this.createWorker(id)
      }
      this.processQueue()
    })

    return workerEntry
  }

  private initPool() {
    for (let i = 0; i < this.maxWorkers; i++) {
      this.workers.push(this.createWorker(i))
    }
    console.log(`[WorkerPool] Initialized with ${this.maxWorkers} workers.`)
  }

  async runInSandbox(code: string, params: Record<string, any>, pkg?: string, taskId?: string): Promise<any> {
    const id = taskId || crypto.randomUUID()
    return new Promise((resolve) => {
      this.taskQueue.push({ id, pkg: pkg || '', code, params, resolve })
      this.processQueue()
    })
  }

  cancelTask(id: string): boolean {
    const queueIndex = this.taskQueue.findIndex((t) => t.id === id)
    if (queueIndex !== -1) {
      const task = this.taskQueue.splice(queueIndex, 1)[0]
      task.resolve({ error: 'Cancelled' })
      console.log(`[WorkerPool] Cancelled queued task ${id}`)
      return true
    }

    const workerEntry = this.workers.find((w) => w.isBusy && w.currentTaskId === id)
    if (workerEntry) {
      const resolver = this.activeResolvers.get(id)
      if (resolver) {
        clearTimeout(resolver.timeout)
        resolver.resolve({ error: 'Cancelled' })
        this.activeResolvers.delete(id)
      }

      console.log(`[WorkerPool] Terminating worker ${workerEntry.id} due to task cancellation: ${id}`)
      workerEntry.worker.terminate()
      const index = this.workers.indexOf(workerEntry)
      if (index !== -1) {
        this.workers[index] = this.createWorker(workerEntry.id)
      }

      this.processQueue()
      return true
    }

    return false
  }

  private processQueue() {
    const availableWorker = this.workers.find((w) => !w.isBusy)
    if (!availableWorker || this.taskQueue.length === 0) return

    // Limit concurrency: only run if no other busy worker is already executing the same extension pkg
    const taskIndex = this.taskQueue.findIndex((task) => {
      if (!task.pkg) return true
      return !this.workers.some((w) => w.isBusy && w.pkg === task.pkg)
    })

    if (taskIndex === -1) return

    const task = this.taskQueue.splice(taskIndex, 1)[0]
    availableWorker.isBusy = true
    availableWorker.pkg = task.pkg
    availableWorker.currentTaskId = task.id

    const timeout = setTimeout(() => {
      const resolver = this.activeResolvers.get(task.id)
      if (resolver) {
        resolver.resolve({ error: 'Worker timed out' })
        this.activeResolvers.delete(task.id)
      }
      
      // Terminate the timed-out worker and replace it with a fresh one
      availableWorker.worker.terminate()
      const index = this.workers.indexOf(availableWorker)
      if (index !== -1) {
        this.workers[index] = this.createWorker(availableWorker.id)
      }

      this.processQueue()
    }, 30000)

    this.activeResolvers.set(task.id, { resolve: task.resolve, timeout })
    availableWorker.worker.postMessage({ id: task.id, code: task.code, params: task.params })
  }

  shutdown() {
    this.workers.forEach((w) => w.worker.terminate())
  }
}

export class ExtensionOrchestrator implements IExtensionPlatform, AppService {
  public priority = ServicePriority.PLUGIN
  private workerPool: WorkerPool
  private engine: ExtensionEngine

  constructor() {
    this.workerPool = new WorkerPool()
    this.engine = new ExtensionEngine(this)
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

  async runSandboxViaPool(code: string, params: Record<string, any>, pkg?: string, taskId?: string): Promise<any> {
    return this.workerPool.runInSandbox(code, params, pkg, taskId)
  }

  async getSetting(key: string): Promise<string | null> {
    return settingsRepo.get(key)
  }

  async upsertExtension(ext: any): Promise<void> {
    await extensionRepo.upsert(ext)
  }

  async getExtension(pkg: string): Promise<any> {
    return extensionRepo.getByPkg(pkg)
  }

  // --- Public Engine Accessors ---

  async runInSandbox(pkg: string, code: string, params: Record<string, any> = {}, taskId?: string): Promise<any> {
    return this.engine.execute(pkg, code, params, taskId)
  }

  cancelExtension(taskId: string): boolean {
    return this.workerPool.cancelTask(taskId)
  }

  async detectTheme(url: string, bypassCf = true): Promise<'madara' | 'mangastream' | 'unknown'> {
    return this.engine.detectTheme(url, bypassCf) as Promise<'madara' | 'mangastream' | 'unknown'>
  }

  async install(ext: any, repoUrl: string): Promise<{ success: boolean }> {
    let actualRepoUrl = repoUrl

    // Find the remote repo actual URL if a pseudo-value was passed
    if (!actualRepoUrl || actualRepoUrl === 'local' || actualRepoUrl === 'remote') {
      const reposJson = await settingsRepo.get('source_repositories')
      const repos: string[] = reposJson ? JSON.parse(reposJson) : []
      if (repos.length > 0) {
        actualRepoUrl = repos[0]
      }
    }

    // Proactively download and cache the extension's icon for offline mode
    try {
      const filename = `ma.autakimi.extension.${ext.pkg}.png`
      const userDataIconsDir = path.join(app.getPath('userData'), 'icons')
      if (!fs.existsSync(userDataIconsDir)) {
        fs.mkdirSync(userDataIconsDir, { recursive: true })
      }
      const cachedIconPath = path.join(userDataIconsDir, filename)

      if (!fs.existsSync(cachedIconPath)) {
        let baseUrl = ''
        if (actualRepoUrl && actualRepoUrl !== 'local' && actualRepoUrl !== 'remote') {
          baseUrl = actualRepoUrl.replace(/\/?([^/]+\.json)$/, '')
          if (baseUrl && !baseUrl.endsWith('/')) baseUrl += '/'
        }

        if (baseUrl) {
          const remoteUrl = `${baseUrl}icons/${filename}`
          const res = await fetch(remoteUrl)
          if (res.ok) {
            const buffer = await res.arrayBuffer()
            fs.writeFileSync(cachedIconPath, Buffer.from(buffer))
            console.log(`[ExtensionOrchestrator] Successfully pre-downloaded icon for offline mode: ${ext.pkg}`)
          }
        }
      }
    } catch (err: any) {
      console.warn('[ExtensionOrchestrator] Failed to pre-download icon during installation:', err.message)
    }

    return this.engine.install(ext, actualRepoUrl)
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

export const extensionOrchestrator = new ExtensionOrchestrator()
