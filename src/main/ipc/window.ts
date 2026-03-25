import { ipcMain, BrowserWindow, shell } from 'electron'
import { IpcChannel } from '../types/ipc'
import { wrapIpc, isValidUrl } from './utils'
import { cloudflareService } from '../services/cloudflare.service'

export function registerWindowHandlers() {
  ipcMain.handle(IpcChannel.WINDOW_MINIMIZE, wrapIpc(async (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  }))

  ipcMain.handle(IpcChannel.WINDOW_MAXIMIZE, wrapIpc(async (event) => {
    BrowserWindow.fromWebContents(event.sender)?.maximize()
  }))

  ipcMain.handle(IpcChannel.WINDOW_RESTORE, wrapIpc(async (event) => {
    BrowserWindow.fromWebContents(event.sender)?.unmaximize()
  }))

  ipcMain.handle(IpcChannel.WINDOW_CLOSE, wrapIpc(async (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  }))

  ipcMain.handle(IpcChannel.WINDOW_IS_MAXIMIZED, wrapIpc(async (event) => {
    return BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false
  }))

  ipcMain.handle(IpcChannel.WINDOW_UPDATE_OVERLAY, wrapIpc(async (event, options: { color: string, symbolColor: string }) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win && process.platform === 'win32') {
      win.setTitleBarOverlay(options)
    }
  }))

  ipcMain.handle(IpcChannel.OPEN_EXTERNAL, wrapIpc(async (_, url: string) => {
    if (!isValidUrl(url)) throw new Error('Invalid URL: only http/https is allowed')
    await shell.openExternal(url)
  }))


  ipcMain.handle(IpcChannel.OPEN_INTERNAL_BROWSER, wrapIpc(async (_, url: string) => {
    if (!isValidUrl(url)) throw new Error('Invalid URL')

    const allowedHost = new URL(url).hostname

    const win = new BrowserWindow({
      width: 1024,
      height: 768,
      title: 'Web View',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        // No partition — uses session.defaultSession so cookies are shared with net.fetch
      }
    })

    // Block navigations that leave the original host (prevents phishing redirects)
    win.webContents.on('will-navigate', (event, navUrl) => {
      if (!isValidUrl(navUrl) || new URL(navUrl).hostname !== allowedHost) {
        event.preventDefault()
        shell.openExternal(navUrl).catch(() => {})
      }
    })

    // Block new windows entirely — open them externally instead
    win.webContents.setWindowOpenHandler(({ url: newUrl }) => {
      if (isValidUrl(newUrl)) shell.openExternal(newUrl).catch(() => {})
      return { action: 'deny' }
    })

    win.loadURL(url)
  }))


  ipcMain.handle(IpcChannel.CF_BYPASS, wrapIpc(async (_, url: string) => {
    if (!isValidUrl(url)) throw new Error('Invalid URL')
    // For backward compat: just fetch HTML to trigger bypass, return success boolean
    const html = await cloudflareService.fetchHtmlViaBrowser(url)
    return html !== null
  }))

  ipcMain.handle(IpcChannel.CF_FETCH_HTML, wrapIpc(async (_, url: string) => {
    if (!isValidUrl(url)) throw new Error('Invalid URL')
    return cloudflareService.fetchHtmlViaBrowser(url)
  }))
}
