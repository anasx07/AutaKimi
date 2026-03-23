import { ipcMain, BrowserWindow, shell } from 'electron'
import { IpcChannel } from '../types/ipc'

export function registerWindowHandlers() {
  ipcMain.handle(IpcChannel.WINDOW_MINIMIZE, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.minimize()
  })

  ipcMain.handle(IpcChannel.WINDOW_MAXIMIZE, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.maximize()
  })

  ipcMain.handle(IpcChannel.WINDOW_RESTORE, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.unmaximize()
  })

  ipcMain.handle(IpcChannel.WINDOW_CLOSE, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.close()
  })

  ipcMain.handle(IpcChannel.WINDOW_IS_MAXIMIZED, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return win?.isMaximized() ?? false
  })

  ipcMain.handle(IpcChannel.WINDOW_UPDATE_OVERLAY, (event, options: { color: string, symbolColor: string }) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win && process.platform === 'win32') {
      try {
        win.setTitleBarOverlay(options)
      } catch(e) {
        console.warn('Failed to set title bar overlay:', e)
      }
    }
  })

  ipcMain.handle(IpcChannel.OPEN_EXTERNAL, async (_, url: string) => {
    await shell.openExternal(url)
  })
}
