import { BrowserWindow, session } from 'electron'
import { IBypassProvider, Result, networkClient } from '@common'
import { pluginService } from '@common/services/plugin.service'
import { AppService, ServicePriority } from './service.registry'
import { stateRegistry } from './state.service'
import path from 'path'

export class CloudflareService implements IBypassProvider, AppService {
  public priority = ServicePriority.NETWORK
  private _cfSession?: Electron.Session
  private _activeChallenge: Promise<Result<{ userAgent: string; cookies: string }>> | null = null
  private _heartbeatInterval: NodeJS.Timeout | null = null
  private _isProcessingHeartbeat = false

  constructor() {}

  private get cfSession(): Electron.Session {
    if (!this._cfSession) {
      this._cfSession = session.fromPartition('persist:cloudflare')
      // Use the native User-Agent but strip out Electron and App specific identifiers
      // This prevents version mismatch detection by Turnstile (where the UA claims Chrome 134 but feature-detection reveals Chrome 122)
      let targetUA = session.defaultSession.getUserAgent()
      targetUA = targetUA.replace(/Electron\/[0-9\.]+ /g, '')
      targetUA = targetUA.replace(/AutaKimi\/[0-9\.]+ /g, '')
      targetUA = targetUA.replace(/autakimi\/[0-9\.]+ /g, '')
      
      this._cfSession.setUserAgent(targetUA)

      // Add common headers and mimic standard browser behavior
      this._cfSession.webRequest.onBeforeSendHeaders((details, callback) => {
        details.requestHeaders['Accept-Language'] = 'en-US,en;q=0.9'
        
        // Strip Electron from sec-ch-ua if present
        if (details.requestHeaders['sec-ch-ua']) {
          details.requestHeaders['sec-ch-ua'] = details.requestHeaders['sec-ch-ua'].replace(/, ?"[^"]*Electron[^"]*"[^\,]*/g, '')
        }
        
        details.requestHeaders['sec-ch-ua-mobile'] = '?0'
        details.requestHeaders['sec-ch-ua-platform'] = '"Windows"'
        details.requestHeaders['Upgrade-Insecure-Requests'] = '1'
        callback({ cancel: false, requestHeaders: details.requestHeaders })
      })
    }
    return this._cfSession
  }

  async initialize(): Promise<void> {
    networkClient.setProvider(this)
    this.startHeartbeat()
  }

  async shutdown(): Promise<void> {
    if (this._heartbeatInterval) {
      clearInterval(this._heartbeatInterval)
      this._heartbeatInterval = null
    }
  }

  private startHeartbeat(): void {
    if (this._heartbeatInterval) return
    console.log('[CloudflareService] Starting background heartbeat service...')
    
    // Check every 5 minutes
    this._heartbeatInterval = setInterval(() => this.processHeartbeats(), 5 * 60 * 1000)
    
    // Initial check after 10 seconds
    setTimeout(() => this.processHeartbeats(), 10000)
  }

  private async processHeartbeats(): Promise<void> {
    if (this._isProcessingHeartbeat) return
    this._isProcessingHeartbeat = true

    try {
      const bypasses = stateRegistry.getState().cloudflareBypasses
      const now = Date.now()

      for (const domain in bypasses) {
        const entry = bypasses[domain]
        const timeSinceUsed = now - entry.lastUsedAt
        const timeSinceResolved = now - entry.resolvedAt

        // Refresh Policy:
        // 1. Domain must have been used in the last 15 minutes (Active).
        // 2. Domain was resolved more than 45 minutes ago (Expiring).
        const isActive = timeSinceUsed < 15 * 60 * 1000
        const isExpiring = timeSinceResolved > 45 * 60 * 1000

        if (isActive && isExpiring) {
          console.log(`[CloudflareService] Preemptively refreshing session for ${entry.domain}...`)
          try {
            // Trigger a silent bypass in the background
            await this.resolveChallenge(entry.baseUrl)
          } catch (e) {
            console.warn(`[CloudflareService] Background refresh failed for ${entry.domain}:`, e)
          }
        }
      }
    } catch (err) {
      console.error('[CloudflareService] Heartbeat loop error:', err)
    } finally {
      this._isProcessingHeartbeat = false
    }
  }

  /**
   * Reports that a domain was successfully used for a fetch.
   */
  public reportPulse(url: string): void {
    try {
      const domain = new URL(url).hostname
      const bypasses = stateRegistry.getState().cloudflareBypasses
      if (bypasses[domain]) {
        stateRegistry.updateBypassState({
          domain,
          baseUrl: bypasses[domain].baseUrl,
          lastUsedAt: Date.now()
        })
      }
    } catch (e) {
      // Ignore invalid URLs
    }
  }

  /**
   * Returns stored credentials for a domain.
   */
  async getCredentials(url: string): Promise<{ userAgent: string; cookies: string }> {
    try {
      const domain = new URL(url).hostname
      const cookies = await this.cfSession.cookies.get({ domain })
      const cookieString = cookies.map((c) => `${c.name}=${c.value}`).join('; ')
      return {
        userAgent: this.cfSession.getUserAgent(),
        cookies: cookieString
      }
    } catch {
      return { userAgent: '', cookies: '' }
    }
  }

  /**
   * Manual browser-based HTML fetch that triggers Cloudflare solving.
   */
  async fetchHtmlViaBrowser(url: string, silent: boolean = false): Promise<string | null> {
    const res = await this.resolveChallenge(url, silent)
    if (res.ok) {
       const response = await networkClient.fetch(url)
       if (response.ok) return await response.value.text()
    }
    return null
  }

  /**
   * Opens a visible BrowserWindow for the user to solve a Cloudflare challenge.
   */
  async resolveChallenge(url: string, silent: boolean = false): Promise<Result<{ userAgent: string; cookies: string }>> {
    if (this._activeChallenge) {
      console.log('[CloudflareService] Reusing active challenge for:', url)
      return this._activeChallenge
    }

    // Set active bypass in state registry for UI overlay (only if not silent)
    if (!silent) {
      try {
        const domain = new URL(url).hostname
        stateRegistry.setActiveBypass({ domain, url })
      } catch (e) {}
    }

    this._activeChallenge = new Promise((resolve) => {
      const win = new BrowserWindow({
        width: 800,
        height: 600,
        show: !silent,
        title: 'AutaKimi - Verification Required',
        alwaysOnTop: true, // Keep it visible for the user
        webPreferences: {
          preload: path.join(__dirname, '../preload/index.js'),
          session: this.cfSession,
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: false
        }
      })

      // Aggressively strip CSP and TrustedTypes headers (Case-Insensitive)
      this.cfSession.webRequest.onHeadersReceived((details, callback) => {
        const responseHeaders = { ...details.responseHeaders }
        
        for (const key in responseHeaders) {
          const lowerKey = key.toLowerCase()
          if (
            lowerKey === 'content-security-policy' ||
            lowerKey === 'content-security-policy-report-only' ||
            lowerKey === 'require-trusted-types-for' ||
            lowerKey === 'x-frame-options'
          ) {
            delete responseHeaders[key]
          }
        }
        
        callback({ cancel: false, responseHeaders })
      })

      // Handle load failures
      win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
        console.error(`[CloudflareService] Solver failed to load: ${errorCode} ${errorDescription} URL: ${validatedURL}`)
      })

      // Remove menu to keep it clean
      win.setMenuBarVisibility(false)

      // The stealth payload is now executed robustly via the preload script (index.ts)
      // which automatically configures TrustedTypes and masks the environment before
      // any Cloudflare Turnstile scripts have a chance to load.

      win.loadURL(url)
      
      const disposers: any[] = []
      const cfPlugins = pluginService.getEnabledPluginsByTarget('main-cloudflare')
      for (const plugin of cfPlugins) {
         pluginService.runPlugin(plugin.id, { win }).then(disposer => {
           if (typeof disposer === 'function') disposers.push(disposer)
         })
      }

      // Polling for clearance cookie OR successful page load
      const checkInterval = setInterval(async () => {
        if (win.isDestroyed()) {
          clearInterval(checkInterval)
          resolve({ ok: false, error: 'Window closed by user' })
          return
        }

        try {
          const cookies = await this.cfSession.cookies.get({ url })
          const clearance = cookies.find((c) => c.name === 'cf_clearance')

          // Stricter solved detection:
          // 1. Must have cf_clearance cookie
          // 2. OR the title changed away from challenge keywords AND it's a real page title
          const title = win.getTitle()
          const pageLoaded = !title.includes('Cloudflare') && 
                            !title.includes('Just a moment') && 
                            !title.includes('Verifying you are human') &&
                            title !== '' &&
                            title !== 'Just a moment...'

          if (clearance || pageLoaded) {
            console.log('[CloudflareService] Challenge solved or page bypassed, closing window.')
            clearInterval(checkInterval)
            
            const cookieString = cookies.map((c) => `${c.name}=${c.value}`).join('; ')
            const credentials = {
              userAgent: this.cfSession.getUserAgent(),
              cookies: cookieString
            }

            // Small delay to ensure cookies are fully persisted and redirects finished
            setTimeout(() => {
              this._activeChallenge = null
              stateRegistry.setActiveBypass(null) // Clear active bypass on success
              if (!win.isDestroyed()) win.close()
              
              // Register success in the state registry
              try {
                const domain = new URL(url).hostname
                stateRegistry.updateBypassState({
                  domain,
                  baseUrl: url,
                  resolvedAt: Date.now(),
                  lastUsedAt: Date.now()
                })
              } catch (e) {}

              resolve({ ok: true, value: credentials })
            }, 2000)
          }
        } catch (e) {
          // Ignore errors during polling
        }
      }, 1500)

      // Safety timeout (2 minutes)
      const safetyTimeout = setTimeout(() => {
        if (!win.isDestroyed()) {
          this._activeChallenge = null
          clearInterval(checkInterval)
          win.close()
          resolve({ ok: false, error: 'Challenge timed out' })
        }
      }, 120000)

      win.on('closed', () => {
        this._activeChallenge = null
        stateRegistry.setActiveBypass(null) // Clear active bypass on window close
        clearInterval(checkInterval)
        clearTimeout(safetyTimeout)
        disposers.forEach(d => {
          try { d() } catch(e) {}
        })
      })
    })

    return this._activeChallenge
  }
}

export const cloudflareService = new CloudflareService()
