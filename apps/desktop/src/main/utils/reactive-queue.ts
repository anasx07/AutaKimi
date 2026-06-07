import { Subject, BehaviorSubject, filter, take, mergeMap, from, takeUntil, switchMap, distinctUntilChanged, finalize } from 'rxjs'

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
  private concurrency$ = new BehaviorSubject<number>(3)
  private cancelSignals = new Map<string, Subject<void>>()
  private subscription: import('rxjs').Subscription | null = null

  constructor(options: QueueOptions = {}) {
    if (options.concurrency) this.concurrency$.next(options.concurrency)
    this.init()
  }

  /**
   * Initializes the reactive pipeline.
   * When concurrency changes, the pipeline is torn down and re-created
   * with the new value. Any in-flight tasks complete naturally; tasks
   * that were queued but not yet picked up carry over via the shared
   * tasks$ Subject.
   */
  private init(): void {
    if (this.subscription) {
      this.subscription.unsubscribe()
    }

    this.subscription = this.concurrency$
      .pipe(
        distinctUntilChanged(),
        switchMap((concurrency) =>
          this.tasks$.pipe(
            mergeMap((task) => {
              return this.isPaused$.pipe(
                filter((paused) => !paused),
                take(1),
                mergeMap(() => {
                  const cancel$ = this.getCancelSignal(task.id)
                  return from(task.run()).pipe(
                    takeUntil(cancel$),
                    finalize(() => {
                      this.cancelSignals.delete(task.id)
                    })
                  )
                })
              )
            }, concurrency)
          )
        )
      )
      .subscribe({
        error: (err) => {
          console.error('[ReactiveQueue] Fatal Stream Error:', err)
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
   * The pipeline is restarted with the new concurrency value.
   * In-flight tasks continue; queued tasks are picked up under the new limit.
   */
  public setConcurrency(n: number): void {
    this.concurrency$.next(n)
  }

  /**
   * Clears all pending and active cancel signals.
   */
  public clear(): void {
    this.cancelSignals.forEach((signal) => {
      signal.next()
      signal.complete()
    })
    this.cancelSignals.clear()
  }

  /**
   * Tears down the pipeline. Call when the queue is no longer needed.
   */
  public destroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe()
      this.subscription = null
    }
    this.tasks$.complete()
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
