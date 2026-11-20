import { IpcChannel } from '@common/types/ipc'
import { broadcastService } from './broadcast.service'
import { SystemState, ActiveTaskState, StateUpdateEvent } from '@common/types/state'

export class StateRegistryService {
  private state: SystemState = {
    activeDownloads: {},
    cloudflareBypasses: {},
    activeBypass: null
  }

  constructor() {}

  public getState(): SystemState {
    return this.state
  }

  /**
   * Sets the currently active bypass (for UI overlay).
   */
  public setActiveBypass(bypass: { domain: string; url: string } | null): void {
    this.state.activeBypass = bypass
    this.broadcast({
      type: 'full_state_update',
      state: this.state
    })
  }

  /**
   * Updates or adds a Cloudflare bypass state.
   */
  public updateBypassState(bypass: { domain: string; baseUrl: string; resolvedAt?: number; lastUsedAt?: number; status?: 'active' | 'expiring' | 'resolved' }): void {
    const existing = this.state.cloudflareBypasses[bypass.domain]
    
    this.state.cloudflareBypasses[bypass.domain] = {
      domain: bypass.domain,
      baseUrl: bypass.baseUrl,
      resolvedAt: bypass.resolvedAt ?? (existing?.resolvedAt ?? Date.now()),
      lastUsedAt: bypass.lastUsedAt ?? (existing?.lastUsedAt ?? Date.now()),
      status: bypass.status ?? 'resolved'
    }

    this.broadcast({
      type: 'cf_bypass_update',
      bypass: this.state.cloudflareBypasses[bypass.domain]
    })
  }

  /**
   * Removes a bypass entry.
   */
  public removeBypassState(domain: string): void {
    if (this.state.cloudflareBypasses[domain]) {
      delete this.state.cloudflareBypasses[domain]
      this.broadcast({
        type: 'full_state_update',
        state: this.state
      })
    }
  }

  /**
   * High-level helper for download status updates
   */
  public updateDownloadState(
    mangaId: string,
    chapterId: string,
    status: string,
    cached = 0,
    total = 0,
    error?: string,
    type: 'manga' | 'anime' = 'manga',
    mangaTitle?: string,
    chapterTitle?: string
  ): void {
    const taskStatus: ActiveTaskState['status'] =
      status === 'start' || status === 'progress' ? 'downloading' : (status as any)

    this.updateDownloadTask({
      mangaId,
      chapterId,
      status: taskStatus,
      cached,
      total,
      error,
      type,
      mangaTitle,
      chapterTitle
    })
  }

  private taskRemovalTimeouts = new Map<string, any>()

  /**
   * Updates an active download task and broadcasts the change.
   */
  public updateDownloadTask(task: ActiveTaskState): void {
    const key = `${task.mangaId}:${task.chapterId}`
    this.state.activeDownloads[key] = {
      ...this.state.activeDownloads[key],
      ...task
    }

    this.broadcast({
      type: 'active_tasks_update',
      task: this.state.activeDownloads[key]
    })

    // If task is final, we might want to keep it in registry for a bit or let UI handle removal
    const currentStatus = this.state.activeDownloads[key].status
    if (currentStatus === 'completed' || currentStatus === 'error' || currentStatus === 'canceled') {
      console.log(`[StateRegistry] Task moved to terminal state: ${key} (${currentStatus})`)
      
      if (this.taskRemovalTimeouts.has(key)) {
        clearTimeout(this.taskRemovalTimeouts.get(key))
      }

      const timeout = setTimeout(() => {
        this.taskRemovalTimeouts.delete(key)
        this.removeDownloadTask(task.mangaId, task.chapterId)
      }, 30000)
      this.taskRemovalTimeouts.set(key, timeout)
    } else {
      if (this.taskRemovalTimeouts.has(key)) {
        clearTimeout(this.taskRemovalTimeouts.get(key))
        this.taskRemovalTimeouts.delete(key)
      }
    }
  }

  /**
   * Removes a task from the registry (e.g., when dismissed by UI).
   */
  public removeDownloadTask(mangaId: string, chapterId: string): void {
    const key = `${mangaId}:${chapterId}`
    if (this.taskRemovalTimeouts.has(key)) {
      clearTimeout(this.taskRemovalTimeouts.get(key))
      this.taskRemovalTimeouts.delete(key)
    }
    if (this.state.activeDownloads[key]) {
      delete this.state.activeDownloads[key]
      console.log(`[StateRegistry] Task removed: ${key}`)
      
      // We don't necessarily need to broadcast removal if the UI initiated it,
      // but if the backend cleans up, we should notify.
      this.broadcast({
          type: 'full_state_update',
          state: this.state
      })
    }
  }

  private broadcast(event: StateUpdateEvent): void {
    broadcastService.send(IpcChannel.SYSTEM_STATE_UPDATE, event)
  }
}

export const stateRegistry = new StateRegistryService()
