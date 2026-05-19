import { BrowserWindow, shell } from 'electron'
import { IpcChannel } from '../types/ipc'
import { registerHandler, wrapIpc, isValidUrl } from './utils'
import { cloudflareService } from '../services/cloudflare.service'

export function registerWindowHandlers() {
  registerHandler(
    IpcChannel.WINDOW_MINIMIZE,
    wrapIpc(async (event) => {
      BrowserWindow.fromWebContents(event.sender)?.minimize()
    })
  )

  registerHandler(
    IpcChannel.WINDOW_MAXIMIZE,
    wrapIpc(async (event) => {
      BrowserWindow.fromWebContents(event.sender)?.maximize()
    })
  )

  registerHandler(
    IpcChannel.WINDOW_RESTORE,
    wrapIpc(async (event) => {
      BrowserWindow.fromWebContents(event.sender)?.unmaximize()
    })
  )

  registerHandler(
    IpcChannel.WINDOW_CLOSE,
    wrapIpc(async (event) => {
      BrowserWindow.fromWebContents(event.sender)?.close()
    })
  )

  registerHandler(
    IpcChannel.WINDOW_IS_MAXIMIZED,
    wrapIpc(async (event) => {
      return BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false
    })
  )

  registerHandler(
    IpcChannel.WINDOW_UPDATE_OVERLAY,
    wrapIpc(async (event, options: { color: string; symbolColor: string }) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (win && process.platform === 'win32') {
        win.setTitleBarOverlay(options)
      }
    })
  )

  registerHandler(
    IpcChannel.OPEN_EXTERNAL,
    wrapIpc(async (_, url: string) => {
      if (!isValidUrl(url)) throw new Error('Invalid URL: only http/https is allowed')
      await shell.openExternal(url)
    })
  )

  registerHandler(
    IpcChannel.OPEN_INTERNAL_BROWSER,
    wrapIpc(async (_, url: string) => {
      if (!isValidUrl(url)) throw new Error('Invalid URL')

      const allowedHost = new URL(url).hostname

      const win = new BrowserWindow({
        width: 1024,
        height: 768,
        title: 'Web View',
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
          // No partition — uses session.defaultSession so cookies are shared with net.fetch
        }
      })

      // Block navigations that leave the original host (prevents phishing redirects)
      win.webContents.on('will-navigate', (event, navUrl) => {
        if (!isValidUrl(navUrl) || new URL(navUrl).hostname !== allowedHost) {
          event.preventDefault()
          shell.openExternal(navUrl).catch((e) => console.error('[Window] Failed to open external URL:', e))
        }
      })

      // Block new windows entirely — open them externally instead
      win.webContents.setWindowOpenHandler(({ url: newUrl }) => {
        if (isValidUrl(newUrl))
          shell.openExternal(newUrl).catch((e) => console.error('[Window] Failed to open external URL:', e))
        return { action: 'deny' }
      })

      win.loadURL(url)
    })
  )

  registerHandler(
    IpcChannel.CF_BYPASS,
    wrapIpc(async (_, url: string, silent: boolean = false) => {
      if (!isValidUrl(url)) throw new Error('Invalid URL')
      // For backward compat: just fetch HTML to trigger bypass, return success boolean
      const html = await cloudflareService.fetchHtmlViaBrowser(url, silent)
      return html !== null
    })
  )

  registerHandler(
    IpcChannel.CF_FETCH_HTML,
    wrapIpc(async (_, url: string, silent: boolean = false) => {
      if (!isValidUrl(url)) throw new Error('Invalid URL')
      return cloudflareService.fetchHtmlViaBrowser(url, silent)
    })
  )
}

