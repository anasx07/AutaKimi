import { WebContents } from 'electron'
import { AppService, ServicePriority } from './service.registry'

/**
 * Centralized service for broadcasting events from Main to Renderer.
 * Manages the WebContents lifecycle and prevents stale references.
 */
export class BroadcastService implements AppService {
  public priority = ServicePriority.CORE
  private webContents: WebContents | null = null

  constructor() {}

  /**
   * Updates the WebContents reference. 
   * Call this whenever the main window is created or recreated.
   */
  public setWebContents(webContents: WebContents): void {
    this.webContents = webContents
    console.log('[BroadcastService] WebContents reference updated.')
  }

  public async initialize(): Promise<void> {}

  public async shutdown(): Promise<void> {
    this.webContents = null
  }

  /**
   * Sends an IPC event to the renderer if the window is available.
   */
  public send(channel: string, ...args: any[]): void {
    if (!this.webContents || this.webContents.isDestroyed()) {
      return
    }
    
    try {
      this.webContents.send(channel, ...args)
    } catch (err) {
      console.error(`[BroadcastService] Failed to send on channel ${channel}:`, err)
    }
  }
}

export const broadcastService = new BroadcastService()
