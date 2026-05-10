import { DataService } from './data.service'
import { bypassRegistry } from './bypass.registry'

/**
 * Background service that proactively maintains Cloudflare sessions.
 * It identifies "active but expiring" sessions and refreshes them silently
 * in a hidden background browser window.
 */
class BypassHeartbeatService {
  private intervalId: any = null
  private isProcessing = false

  /**
   * Starts the background heartbeat loop.
   */
  start() {
    if (this.intervalId) return
    console.log('[BypassHeartbeat] Starting background maintenance service...')
    
    // Check every 5 minutes
    this.intervalId = setInterval(() => this.processHeartbeats(), 5 * 60 * 1000)
    
    // Trigger initial check after a short delay
    setTimeout(() => this.processHeartbeats(), 10000)
  }

  /**
   * Stops the background heartbeat loop.
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  private async processHeartbeats() {
    if (this.isProcessing) return
    this.isProcessing = true

    try {
      const entries = bypassRegistry.getEntries()
      const now = Date.now()

      for (const entry of entries) {
        const timeSinceUsed = now - entry.lastUsedAt
        const timeSinceResolved = now - entry.resolvedAt

        /**
         * Refresh Policy:
         * 1. Domain must have been used in the last 15 minutes (Active).
         * 2. Domain was resolved more than 45 minutes ago (Expiring).
         */
        const isActive = timeSinceUsed < 15 * 60 * 1000
        const isExpiring = timeSinceResolved > 45 * 60 * 1000

        if (isActive && isExpiring) {
          console.log(`[BypassHeartbeat] Preemptively refreshing session for ${entry.domain}...`)
          try {
            // Trigger a silent bypass in the background. 
            // The domain lock in DataService will ensure this doesn't conflict with active user tasks.
            await DataService.cfBypass(entry.baseUrl, true)
            
            // Re-mark as resolved to update the timestamp
            bypassRegistry.setResolved(entry.domain, entry.baseUrl)
          } catch (e) {
            console.warn(`[BypassHeartbeat] Background refresh failed for ${entry.domain}:`, e)
          }
        }
      }
    } catch (err) {
      console.error('[BypassHeartbeat] Heartbeat loop error:', err)
    } finally {
      this.isProcessing = false
    }
  }
}

export const bypassHeartbeatService = new BypassHeartbeatService()
