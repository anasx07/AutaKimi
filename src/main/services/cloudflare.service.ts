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

  private sendStatus(status: 'started' | 'completed' | 'failed', domain?: string): void {
    try {
      const { BrowserWindow } = require('electron')
      BrowserWindow.getAllWindows().forEach(win => {
        if (!win.isDestroyed()) {
          win.webContents.send('cf:status', { status, domain })
        }
      })
    } catch (e) {
      console.error('[CloudflareService] Failed to send status:', e)
    }
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
        // Get UA from map if it's a window, otherwise use the last known cleaned UA (stored at -1)
        const ua = (wcId !== undefined ? this.activeWindows.get(wcId) : null) || this.activeWindows.get(-1) || session.defaultSession.getUserAgent()
        
        details.requestHeaders['Sec-CH-UA'] = `"Google Chrome";v="${chromeVer}", "Chromium";v="${chromeVer}", "Not_A Brand";v="8"`
        details.requestHeaders['Sec-CH-UA-Mobile'] = '?0'
        details.requestHeaders['Sec-CH-UA-Platform'] = '"Windows"'
        details.requestHeaders['User-Agent'] = ua

        callback({ requestHeaders: details.requestHeaders })
      }
    )

    this.cfSession.webRequest.onHeadersReceived(
      { urls: ['*://*/*'] },
      (_details, callback) => {
        // Always strip CSP for the bypass session to allow script injection
        const h = { ...(_details.responseHeaders || {}) }
        delete h['content-security-policy']
        delete h['Content-Security-Policy']
        callback({ responseHeaders: h })
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
    if (typeof html !== 'string' || !html || html.length < 200) return false
    
    // Cloudflare challenges always have specific markers and almost never have a real page title
    const lower = html.toLowerCase()
    
    // 1. Success markers - if these exist, it's not a challenge anymore
    if (lower.includes('success!') || lower.includes('verified!')) return false

    // 2. Content check: If it looks like a real page with actual manga content, it's NOT a challenge
    // Even if it has CF scripts in the header for tracking/security.
    const hasMangaContent = (
      lower.includes('wp-manga-chapter-img') || // Chapter images
      lower.includes('summary__content') ||    // Manga summary
      lower.includes('post-title') ||          // Series title
      lower.includes('li class="wp-manga-chapter"') || // Chapter list
      lower.includes('class="reading-content"') ||    // Reader container
      (lower.includes('<body') && lower.includes('<footer')) // Basic structure
    )

    if (hasMangaContent && html.length > 2000) {
      return false
    }

    // 3. Specific Cloudflare challenge markers
    const isCf = lower.includes('challenges.cloudflare.com') ||
                 lower.includes('window._cf_chl_opt') ||
                 lower.includes('__cf_chl_rt_sig') ||
                 lower.includes('id="cf-challenge"') ||
                 lower.includes('id="challenge-form"') ||
                 lower.includes('name="cf_chl_tk"') ||
                 (lower.includes('<title>just a moment...</title>'))

    return isCf
  }

  private setupWindow(): BrowserWindow {
    const win = new BrowserWindow({
      width: 500,
      height: 650,
      show: false,
      title: 'Cloudflare Verification',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true, // Restored for security principle
        sandbox: false,          // Allow deeper patching if needed
        session: this.cfSession
      }
    })

    const cleanUA = win.webContents.getUserAgent()
      .replace(/\s*Electron\/\S+/g, '')
      .replace(/\s*AutaKimi\/\S+/g, '')
    
    this.activeWindows.set(win.webContents.id, cleanUA)
    this.activeWindows.set(-1, cleanUA) // Global fallback

    win.webContents.on('dom-ready', () => {
      // Idempotent stealth script
      win.webContents.executeJavaScript(`
        (function() {
          if (window.__cfStealth) return;
          window.__cfStealth = true;
          
          const hideProperty = (obj, prop, value) => {
            Object.defineProperty(obj, prop, {
              get: () => value,
              enumerable: true,
              configurable: true
            });
          };

          hideProperty(navigator, 'webdriver', false);
          hideProperty(navigator, 'languages', ['en-US', 'en', 'ar']);
          hideProperty(navigator, 'plugins', [
            { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
            { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' }
          ]);
          
          if (window.chrome && !window.chrome.runtime) {
            window.chrome.runtime = undefined;
          }
        })();
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
    
    // 1. Optimistic check: try a direct fetch if we have a valid cookie
    const existingCookie = await this.getClearanceCookie(domain)
    if (existingCookie && (existingCookie.expirationDate || 0) > Date.now() / 1000) {
      console.log(`[CloudflareService] Found valid cf_clearance for ${domain}, trying optimistic fetch...`)
      try {
        // Use this.cfSession.fetch directly to ensure it uses the clearance cookies
        // and doesn't pollute the default session with unnecessary data.
        const response = await this.cfSession.fetch(targetUrl, {
          headers: {
            'User-Agent': this.activeWindows.get(-1) || session.defaultSession.getUserAgent(),
            'Referer': new URL(targetUrl).origin
          }
        })
        const html = await response.text()
        if (html && !this.isCfChallengePage(html)) {
          console.log(`[CloudflareService] ✓ Optimistic fetch successful for ${domain}`)
          // Sync successful clearance back to default session for other potential readers (like images)
          await this.syncCookiesToDefaultSession(domain)
          return html
        }
        console.log(`[CloudflareService] ! Optimistic fetch hit challenge, opening browser...`)
      } catch (e) {
        console.warn(`[CloudflareService] ! Optimistic fetch failed, opening browser...`, e)
      }
    }

    this.sendStatus('started', domain)
    const win = this.setupWindow()
    console.log(`[CloudflareService] Opening browser for ${targetUrl}`)

    const result = await this.loadAndExtract(win, targetUrl, domain)
    
    if (result) {
      this.sendStatus('completed', domain)
      await this.syncCookiesToDefaultSession(domain)
    } else {
      this.sendStatus('failed', domain)
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
        
        // Hide immediately to avoid showing the target site in the popup
        try { if (!win.isDestroyed()) win.hide() } catch { /* ignore */ }

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
          
          // Hide immediately when cookie is obtained
          try { if (!win.isDestroyed()) win.hide() } catch { /* ignore */ }

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
        if (!resolved && !win.isDestroyed() && !cookieObtained) {
          const html = await win.webContents.executeJavaScript('document.documentElement.outerHTML').catch(() => '')
          if (!html || this.isCfChallengePage(html)) {
            win.setTitle(`Cloudflare Verification — ${domain}`)
            win.show()
            win.focus()
          }
        }
      }, 15000)

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
