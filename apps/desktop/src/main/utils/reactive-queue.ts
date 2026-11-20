import { Subject, BehaviorSubject, defer, from, takeUntil, finalize } from 'rxjs'

export type TaskRunner<T> = () => Promise<T>

export interface QueueOptions {
  concurrency?: number
}

interface QueueTask<T = any> {
  id: string
  run: TaskRunner<T>
  resolve: (value: T | PromiseLike<T>) => void
  reject: (reason?: any) => void
  cancelled?: boolean
}

/**
 * ReactiveQueue manages task concurrency and lifecycle using a dynamic semaphore.
 * Unlike a naive switchMap pipeline, changing concurrency does NOT cancel or teardown
 * in-flight tasks; it dynamically expands or contracts available task slots.
 */
export class ReactiveQueue {
  private isPaused$ = new BehaviorSubject<boolean>(false)
  private concurrency$ = new BehaviorSubject<number>(3)
  private cancelSignals = new Map<string, Subject<void>>()
  private runningTaskIds = new Map<string, number>()
  private pendingQueue: QueueTask<any>[] = []
  private runningCount = 0
  private concurrency = 3
  private isPaused = false

  constructor(options: QueueOptions = {}) {
    if (typeof options.concurrency === 'number' && options.concurrency > 0) {
      this.concurrency = options.concurrency
      this.concurrency$.next(this.concurrency)
    }
  }

  /**
   * Drain loop implementing the dynamic semaphore.
   * Pulls tasks while runningCount < concurrency and not paused.
   */
  private drain(): void {
    if (this.isPaused) return

    while (this.runningCount < this.concurrency && this.pendingQueue.length > 0) {
      const task = this.pendingQueue.shift()!
      if (task.cancelled) {
        task.reject(new Error(`Task ${task.id} was cancelled before starting`))
        continue
      }

      this.runningCount++
      this.runningTaskIds.set(task.id, (this.runningTaskIds.get(task.id) || 0) + 1)
      this.execute(task)
    }
  }

  private execute(task: QueueTask<any>): void {
    const cancel$ = this.getCancelSignal(task.id)
    let completed = false

    defer(() => from(Promise.resolve().then(() => task.run())))
      .pipe(
        takeUntil(cancel$),
        finalize(() => {
          this.runningCount--
          const count = (this.runningTaskIds.get(task.id) || 1) - 1
          if (count <= 0) {
            this.runningTaskIds.delete(task.id)
            this.cancelSignals.delete(task.id)
          } else {
            this.runningTaskIds.set(task.id, count)
          }
          this.drain()
        })
      )
      .subscribe({
        next: (val) => {
          completed = true
          task.resolve(val)
        },
        error: (err) => {
          completed = true
          task.reject(err)
        },
        complete: () => {
          if (!completed) {
            task.reject(new Error(`Task ${task.id} was cancelled`))
          }
        }
      })
  }

  /**
   * Adds a task to the queue. Returns a promise that resolves when the task finishes.
   */
  public add<T>(id: string, run: TaskRunner<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.pendingQueue.push({
        id,
        run,
        resolve,
        reject
      })
      this.drain()
    })
  }

  /**
   * Adds multiple tasks and returns a promise for all results.
   */
  public addAll<T>(id: string, tasks: TaskRunner<T>[]): Promise<T[]> {
    return Promise.all(tasks.map((task) => this.add(id, task)))
  }

  /**
   * Pauses task consumption. Already running tasks will continue.
   */
  public pause(): void {
    this.isPaused = true
    this.isPaused$.next(true)
  }

  /**
   * Resumes task consumption.
   */
  public resume(): void {
    this.isPaused = false
    this.isPaused$.next(false)
    this.drain()
  }

  /**
   * Cancels all pending and active tasks associated with a specific ID.
   */
  public cancel(id: string): void {
    // 1. Cancel and remove any pending tasks with this ID
    const remaining: QueueTask<any>[] = []
    for (const task of this.pendingQueue) {
      if (task.id === id) {
        task.cancelled = true
        task.reject(new Error(`Task ${id} was cancelled`))
      } else {
        remaining.push(task)
      }
    }
    this.pendingQueue = remaining

    // 2. Signal cancellation to in-flight tasks
    const signal = this.cancelSignals.get(id)
    if (signal) {
      signal.next()
      signal.complete()
      this.cancelSignals.delete(id)
    }
  }

  /**
   * Updates the concurrency limit using dynamic semaphore capacity.
   * In-flight tasks continue without interruption. If concurrency increased,
   * available pending tasks are immediately dispatched.
   */
  public setConcurrency(n: number): void {
    const valid = Math.max(1, Math.floor(n))
    if (this.concurrency === valid) return
    this.concurrency = valid
    this.concurrency$.next(valid)
    this.drain()
  }

  /**
   * Clears all pending and active tasks and cancel signals.
   */
  public clear(): void {
    for (const task of this.pendingQueue) {
      task.cancelled = true
      task.reject(new Error('Queue cleared'))
    }
    this.pendingQueue = []

    this.cancelSignals.forEach((signal) => {
      signal.next()
      signal.complete()
    })
    this.cancelSignals.clear()
    this.runningTaskIds.clear()
  }

  /**
   * Tears down the queue.
   */
  public destroy(): void {
    this.clear()
    this.isPaused$.complete()
    this.concurrency$.complete()
  }

  private getCancelSignal(id: string): Subject<void> {
    let signal = this.cancelSignals.get(id)
    if (!signal) {
      signal = new Subject<void>()
      this.cancelSignals.set(id, signal)
    }
    return signal
  }
}
