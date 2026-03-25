import { BrowserWindow, session, Cookie } from 'electron'

/**
 * CloudflareService: Fetches HTML from CF-protected sites via BrowserWindow.
 * 
 * Optimized to avoid global session leaks and handle concurrent bypasses.
 * Uses lazy initialization to avoid Electron "app not ready" errors.
 */
export class CloudflareService {
  private static instance: CloudflareService
  private _cfSession?: Electron.Session
  private activeWindows = new Map<number, string>() // webContentsId -> UserAgent
  private listenersReady = false

  public static getInstance(): CloudflareService {
    if (!CloudflareService.instance) {
      CloudflareService.instance = new CloudflareService()
    }
    return CloudflareService.instance
  }

  private get cfSession(): Electron.Session {
    if (!this._cfSession) {
      this._cfSession = session.fromPartition('persist:cloudflare')
      this.setupSharedListeners()
    }
    return this._cfSession
  }

  constructor() {}

  private setupSharedListeners(): void {
    if (this.listenersReady) return
    this.listenersReady = true
    
    const chromeVer = process.versions.chrome.split('.')[0] || '130'

    this.cfSession.webRequest.onBeforeSendHeaders(
      { urls: ['*://*/*'] },
      (details, callback) => {
        const wcId = details.webContentsId
        if (wcId !== undefined) {
          const ua = this.activeWindows.get(wcId)
          if (ua) {
            details.requestHeaders['Sec-CH-UA'] = `"Google Chrome";v="${chromeVer}", "Chromium";v="${chromeVer}", "Not_A Brand";v="8"`
            details.requestHeaders['Sec-CH-UA-Mobile'] = '?0'
            details.requestHeaders['Sec-CH-UA-Platform'] = '"Windows"'
            details.requestHeaders['User-Agent'] = ua
          }
        }
        callback({ requestHeaders: details.requestHeaders })
      }
    )

    this.cfSession.webRequest.onHeadersReceived(
      { urls: ['*://*/*'] },
      (details, callback) => {
        const wcId = details.webContentsId
        if (wcId !== undefined && this.activeWindows.has(wcId)) {
          const h = { ...(details.responseHeaders || {}) }
          delete h['content-security-policy']
          delete h['Content-Security-Policy']
          callback({ responseHeaders: h })
        } else {
          callback({})
        }
      }
    )
  }

  private getDomain(url: string): string {
    try {
      return new URL(url).hostname
    } catch {
      return url
    }
  }

  private async getClearanceCookie(domain: string): Promise<Cookie | null> {
    try {
      const cookies = await this.cfSession.cookies.get({})
      for (const cookie of cookies) {
        if (cookie.name === 'cf_clearance' && 
           (cookie.domain === domain || cookie.domain === `.${domain}`)) {
          return cookie
        }
      }
      return null
    } catch {
      return null
    }
  }

  private async syncCookiesToDefaultSession(domain: string): Promise<void> {
    try {
      const cookies = await this.cfSession.cookies.get({ domain })
      for (const cookie of cookies) {
        const { name, value, domain: d, path, secure, httpOnly, expirationDate } = cookie
        if (!d) continue

        await session.defaultSession.cookies.set({
          url: `https://${d.startsWith('.') ? d.substring(1) : d}${path}`,
          name,
          value,
          domain: d,
          path,
          secure,
          httpOnly,
          expirationDate: expirationDate || undefined
        })
      }
      console.log(`[CloudflareService] Sync'd cookies for ${domain} to default session`)
    } catch (e) {
      console.warn('[CloudflareService] Cookie sync failed:', e)
    }
  }

  private isCfChallengePage(html: string): boolean {
    if (typeof html !== 'string' || !html) return false
    const lower = html.toLowerCase()
    return (lower.includes('cf_chl') ||
      lower.includes('challenges.cloudflare.com') ||
      lower.includes('verifying you are human') ||
      lower.includes('performing security verification') ||
      lower.includes('jschl') ||
      lower.includes('__cf_chl')) && 
      !lower.includes('success!') && 
      !lower.includes('verified!')
  }

  private setupWindow(): BrowserWindow {
    const win = new BrowserWindow({
      width: 500,
      height: 650,
      show: false,
      title: 'Cloudflare Verification',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        session: this.cfSession
      }
    })

    const cleanUA = win.webContents.getUserAgent()
      .replace(/\s*Electron\/\S+/g, '')
      .replace(/\s*LManwa\/\S+/g, '')
    
    this.activeWindows.set(win.webContents.id, cleanUA)

    win.webContents.on('dom-ready', () => {
      win.webContents.executeJavaScript(`
        if (!window.__cfPatch) {
          window.__cfPatch = true;
          Object.defineProperty(navigator, 'webdriver', { get: () => false });
          Object.defineProperty(navigator, 'plugins', {
            get: () => [
              { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
              { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
            ]
          });
          Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en', 'ar'] });
          if (window.chrome) window.chrome.runtime = undefined;
        }
      `).catch(() => {})
    })

    return win
  }

  private cleanupWindow(win: BrowserWindow): void {
    try {
      this.activeWindows.delete(win.webContents.id)
      if (!win.isDestroyed()) {
        setTimeout(() => { if (!win.isDestroyed()) win.close() }, 500)
      }
    } catch { /* ignore */ }
  }

  async fetchHtmlViaBrowser(targetUrl: string): Promise<string | null> {
    const domain = this.getDomain(targetUrl)
    
    // Optimistic check: maybe we already have the cookie?
    const existingCookie = await this.getClearanceCookie(domain)
    if (existingCookie && (existingCookie.expirationDate || 0) > Date.now() / 1000) {
      console.log(`[CloudflareService] Found valid cf_clearance for ${domain}, proceeding...`)
    }

    const win = this.setupWindow()
    console.log(`[CloudflareService] Opening browser for ${targetUrl}`)

    const result = await this.loadAndExtract(win, targetUrl, domain)
    
    if (result) {
      await this.syncCookiesToDefaultSession(domain)
    }

    this.cleanupWindow(win)
    return result
  }

  private async loadAndExtract(win: BrowserWindow, url: string, domain: string): Promise<string | null> {
    return new Promise<string | null>((resolve) => {
      let resolved = false
      let cookieObtained = false
      let lastNavigatedUrl = ''

      const done = (html: string | null) => {
        if (resolved) return
        resolved = true
        clearInterval(pollTimer)
        clearTimeout(showTimer)
        clearTimeout(hardTimeout)
        resolve(html)
      }

      win.webContents.on('did-navigate', (_e, navUrl) => {
        lastNavigatedUrl = navUrl
      })
      win.webContents.on('did-navigate-in-page', (_e, navUrl) => {
        lastNavigatedUrl = navUrl
      })

      win.webContents.on('dom-ready', async () => {
        if (resolved) return
        await new Promise(r => setTimeout(r, 800))
        if (resolved) return

        try {
          const html = await win.webContents.executeJavaScript('document.documentElement.outerHTML')
          if (typeof html !== 'string' || html.length < 500) return

          if (this.isCfChallengePage(html)) {
            console.log(`[CloudflareService] Still on CF challenge page... (Length: ${html.length})`)
            return
          }

          console.log(`[CloudflareService] ✓ Extracted ${html.length} chars from ${lastNavigatedUrl || url}`)
          done(html)
        } catch { /* wait */ }
      })

      const pollTimer = setInterval(async () => {
        if (resolved) return
        const cookie = await this.getClearanceCookie(domain)
        if (!cookieObtained && cookie) {
          cookieObtained = true
          console.log(`[CloudflareService] ✓ cf_clearance obtained for ${domain}`)
          
          // Sync User-Agent globally to ensure images and future requests work
          const ua = this.activeWindows.get(win.webContents.id)
          if (ua) {
            session.defaultSession.setUserAgent(ua)
          }

          // Force a navigation to the target URL now that we have the cookie
          if (!win.isDestroyed()) {
            win.loadURL(url).catch(() => {})
          }
        }
      }, 1000)

      const showTimer = setTimeout(async () => {
        if (!resolved && !win.isDestroyed()) {
          const html = await win.webContents.executeJavaScript('document.documentElement.outerHTML').catch(() => '')
          if (!html || this.isCfChallengePage(html)) {
            win.setTitle(`Cloudflare Verification — ${domain}`)
            win.show()
            win.focus()
          }
        }
      }, 5000)

      const hardTimeout = setTimeout(() => {
        console.warn(`[CloudflareService] ✗ Timed out for ${domain}`)
        done(null)
      }, 90000)

      win.on('closed', () => { if (!resolved) done(null) })
      win.loadURL(url)
    })
  }
}

export const cloudflareService = CloudflareService.getInstance()
