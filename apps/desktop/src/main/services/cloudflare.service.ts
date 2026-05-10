import { BrowserWindow, session, Cookie } from 'electron'
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
    const domain = new URL(url).hostname
    const cookies = await this.cfSession.cookies.get({ domain })
    const cookieString = cookies.map((c) => `${c.name}=${c.value}`).join('; ')
    return {
      userAgent: this.cfSession.getUserAgent(),
      cookies: cookieString
    }
  }

  /**
   * Opens a visible BrowserWindow for the user to solve a Cloudflare challenge.
   */
  async resolveChallenge(url: string): Promise<Result<{ userAgent: string; cookies: string }>> {
    return new Promise((resolve) => {
      const win = new BrowserWindow({
        width: 800,
        height: 600,
        show: true, // MUST be true for user interaction
        title: 'AutaKimi - Verification Required',
        webPreferences: {
          session: this.cfSession
        }
      })

      // Inform the user
      win.loadURL(url)

      const checkInterval = setInterval(async () => {
        if (win.isDestroyed()) {
          clearInterval(checkInterval)
          resolve({ ok: false, error: 'Window closed by user' })
          return
        }

        const cookies = await this.cfSession.cookies.get({ url })
        const clearance = cookies.find((c) => c.name === 'cf_clearance')

        if (clearance) {
          clearInterval(checkInterval)
          const cookieString = cookies.map((c) => `${c.name}=${c.value}`).join('; ')
          const credentials = {
            userAgent: this.cfSession.getUserAgent(),
            cookies: cookieString
          }
          win.close()
          resolve({ ok: true, value: credentials })
        }
      }, 2000)

      win.on('closed', () => {
        clearInterval(checkInterval)
        resolve({ ok: false, error: 'Window closed before challenge was solved' })
      })
    })
  }
}

export const cloudflareService = CloudflareService.getInstance()
