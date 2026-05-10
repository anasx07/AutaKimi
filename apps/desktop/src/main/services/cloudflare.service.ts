import { BrowserWindow, session } from 'electron'
import { IBypassProvider, Result, networkClient } from '@common'
import { AppService } from './service.registry'

export class CloudflareService implements IBypassProvider, AppService {
  private static instance: CloudflareService
  private _cfSession?: Electron.Session

  public static getInstance(): CloudflareService {
    if (!CloudflareService.instance) {
      CloudflareService.instance = new CloudflareService()
    }
    return CloudflareService.instance
  }

  private get cfSession(): Electron.Session {
    if (!this._cfSession) {
      this._cfSession = session.fromPartition('persist:cloudflare')
      // Ensure we have a realistic user agent
      this._cfSession.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    }
    return this._cfSession
  }

  async initialize(): Promise<void> {
    networkClient.setProvider(this)
  }

  async shutdown(): Promise<void> {
    // No specific shutdown needed
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
  async fetchHtmlViaBrowser(url: string): Promise<string | null> {
    const res = await this.resolveChallenge(url)
    if (res.ok) {
       const response = await networkClient.fetch(url)
       if (response.ok) return await response.value.text()
    }
    return null
  }

  /**
   * Opens a visible BrowserWindow for the user to solve a Cloudflare challenge.
   */
  async resolveChallenge(url: string): Promise<Result<{ userAgent: string; cookies: string }>> {
    return new Promise((resolve) => {
      const win = new BrowserWindow({
        width: 800,
        height: 600,
        show: true,
        title: 'AutaKimi - Verification Required',
        alwaysOnTop: true, // Keep it visible for the user
        webPreferences: {
          session: this.cfSession,
          nodeIntegration: false,
          contextIsolation: true
        }
      })

      // Remove menu to keep it clean
      win.setMenuBarVisibility(false)

      win.loadURL(url)

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

          // Check if we are no longer on a challenge page
          const title = win.getTitle()
          const isSolved = clearance || (!title.includes('Cloudflare') && !title.includes('Just a moment') && title !== '')

          if (isSolved) {
            console.log('[CloudflareService] Challenge solved, closing window.')
            clearInterval(checkInterval)
            
            const cookieString = cookies.map((c) => `${c.name}=${c.value}`).join('; ')
            const credentials = {
              userAgent: this.cfSession.getUserAgent(),
              cookies: cookieString
            }

            // Small delay to ensure cookies are fully persisted
            setTimeout(() => {
              if (!win.isDestroyed()) win.close()
              resolve({ ok: true, value: credentials })
            }, 1000)
          }
        } catch (e) {
          // Ignore errors during polling
        }
      }, 1500)

      // Safety timeout (2 minutes)
      const safetyTimeout = setTimeout(() => {
        if (!win.isDestroyed()) {
          clearInterval(checkInterval)
          win.close()
          resolve({ ok: false, error: 'Challenge timed out' })
        }
      }, 120000)

      win.on('closed', () => {
        clearInterval(checkInterval)
        clearTimeout(safetyTimeout)
      })
    })
  }
}

export const cloudflareService = CloudflareService.getInstance()
