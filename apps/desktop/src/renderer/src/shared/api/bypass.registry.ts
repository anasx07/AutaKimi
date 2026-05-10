/**
 * Centralized registry for tracking Cloudflare resolution states across all sources.
 * This enables background heartbeats and session maintenance.
 */

export interface BypassEntry {
  domain: string
  baseUrl: string
  resolvedAt: number
  lastUsedAt: number
}

class BypassRegistry {
  private entries = new Map<string, BypassEntry>()

  /**
   * Marks a domain as successfully resolved.
   */
  setResolved(domain: string, baseUrl: string) {
    this.entries.set(domain, {
      domain,
      baseUrl,
      resolvedAt: Date.now(),
      lastUsedAt: Date.now()
    })
  }

  /**
   * Checks if a domain is currently marked as resolved.
   */
  isResolved(domain: string): boolean {
    return this.entries.has(domain)
  }

  /**
   * Reports that a domain was successfully used for a fetch.
   * This is used to identify "active" domains that need background heartbeats.
   */
  reportPulse(domain: string) {
    const entry = this.entries.get(domain)
    if (entry) {
      entry.lastUsedAt = Date.now()
    }
  }

  /**
   * Gets all tracked resolution entries.
   */
  getEntries(): BypassEntry[] {
    return Array.from(this.entries.values())
  }

  /**
   * Removes an entry from the registry (e.g. if it persistently fails).
   */
  removeEntry(domain: string) {
    this.entries.delete(domain)
  }
}

export const bypassRegistry = new BypassRegistry()
