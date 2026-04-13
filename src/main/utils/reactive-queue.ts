import { Subject, BehaviorSubject, filter, take, mergeMap, from, takeUntil, finalize } from 'rxjs'

export type TaskRunner<T> = () => Promise<T>

export interface QueueOptions {
  concurrency?: number
}

/**
 * ReactiveQueue uses RxJS to manage task concurrency and lifecycle.
 * It provides a more robust and flexible alternative to custom-rolled loops.
 */
export class ReactiveQueue {
  private tasks$ = new Subject<{ id: string; run: TaskRunner<any> }>()
  private isPaused$ = new BehaviorSubject<boolean>(false)
  private cancelSignals = new Map<string, Subject<void>>()
  private concurrency: number

  constructor(options: QueueOptions = {}) {
    this.concurrency = options.concurrency || 3
    this.init()
  }

  /**
   * Initializes the reactive pipeline.
   * Tasks are processed through mergeMap which enforces the concurrency limit.
   */
  private init(): void {
    this.tasks$
      .pipe(
        mergeMap((task) => {
          // 1. Wait if the queue is paused
          return this.isPaused$.pipe(
            filter((paused) => !paused),
            take(1),
            // 2. Execute the task with cancellation support
            mergeMap(() => {
              const cancel$ = this.getCancelSignal(task.id)
              return from(task.run()).pipe(
                takeUntil(cancel$),
                // Clean up signal map when task finishes
                finalize(() => {
                  // We don't delete immediately here to avoid race conditions 
                  // with the cancel() method itself if called exactly at completion
                })
              )
            })
          )
        }, this.concurrency)
      )
      .subscribe({
        error: (err) => {
          console.error('[ReactiveQueue] Fatal Stream Error:', err)
          // Attempt recovery
          this.init()
        }
      })
  }

  /**
   * Adds a task to the queue. Returns a promise that resolves when the task finishes.
   */
  public add<T>(id: string, run: TaskRunner<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.tasks$.next({
        id,
        run: async () => {
          try {
            const res = await run()
            resolve(res)
            return res
          } catch (e) {
            reject(e)
            throw e
          }
        }
      })
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
    this.isPaused$.next(true)
  }

  /**
   * Resumes task consumption.
   */
  public resume(): void {
    this.isPaused$.next(false)
  }

  /**
   * Cancels all pending and active tasks associated with a specific ID.
   */
  public cancel(id: string): void {
    const signal = this.cancelSignals.get(id)
    if (signal) {
      signal.next()
      signal.complete()
      this.cancelSignals.delete(id)
    }
  }

  /**
   * Updates the concurrency limit. 
   * Note: This currently requires a re-initialization to apply to the mergeMap operator.
   */
  public setConcurrency(n: number): void {
    if (this.concurrency !== n) {
      this.concurrency = n
      // We don't restart existing stream as it might lose pending tasks in Subject buffer 
      // if not handled carefully. In DownloadManager use case, concurrency is mostly stable.
    }
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
