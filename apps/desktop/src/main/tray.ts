import { app, Menu, Tray, BrowserWindow, nativeImage } from 'electron'

export class TrayManager {
  private static instance: TrayManager
  private tray: Tray | null = null
  private mainWindow: BrowserWindow | null = null

  private constructor() {}

  public static getInstance(): TrayManager {
    if (!TrayManager.instance) {
      TrayManager.instance = new TrayManager()
    }
    return TrayManager.instance
  }

  public createTray(mainWindow: BrowserWindow, iconPath: string): void {
    this.mainWindow = mainWindow

    // Create native image for tray
    const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
    this.tray = new Tray(icon)

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show App',
        click: () => this.showWindow()
      },
      { type: 'separator' },
      {
        label: 'Quit AutaKimi',
        click: () => {
          ;(app as any).isQuitting = true
          app.quit()
        }
      }
    ])

    this.tray.setToolTip('AutaKimi')
    this.tray.setContextMenu(contextMenu)

    this.tray.on('double-click', () => {
      this.showWindow()
    })
  }

  public showWindow(): void {
    if (this.mainWindow) {
      if (this.mainWindow.isMinimized()) this.mainWindow.restore()
      this.mainWindow.show()
      this.mainWindow.focus()
    }
  }

  public destroy(): void {
    if (this.tray) {
      this.tray.destroy()
      this.tray = null
    }
  }
}
