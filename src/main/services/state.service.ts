import { WebContents } from 'electron'
import { IpcChannel } from '../../common/types/ipc'
import { SystemState, ActiveTaskState, StateUpdateEvent } from '../../common/types/state'

export class StateRegistryService {
  private static instance: StateRegistryService
  private webContents: WebContents | null = null
  
  private state: SystemState = {
    activeDownloads: {}
  }

  public static getInstance(): StateRegistryService {
    if (!StateRegistryService.instance) {
      StateRegistryService.instance = new StateRegistryService()
    }
    return StateRegistryService.instance
  }

  public setWebContents(webContents: WebContents): void {
    this.webContents = webContents
  }

  public getState(): SystemState {
    return this.state
  }

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
    if (task.status === 'completed' || task.status === 'error' || task.status === 'canceled') {
      console.log(`[StateRegistry] Task moved to terminal state: ${key} (${task.status})`)
    }
  }

  /**
   * Removes a task from the registry (e.g., when dismissed by UI).
   */
  public removeDownloadTask(mangaId: string, chapterId: string): void {
    const key = `${mangaId}:${chapterId}`
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
    if (this.webContents) {
      this.webContents.send(IpcChannel.SYSTEM_STATE_UPDATE, event)
    }
  }
}

export const stateRegistry = StateRegistryService.getInstance()
