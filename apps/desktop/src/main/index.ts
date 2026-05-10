import './pre-init'

import { app, shell, BrowserWindow, ipcMain, protocol, session, net } from 'electron'
import { join } from 'path'
import { NetworkConfig } from '@common/config/network'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { ServiceRegistry } from './services/service.registry'
import { DownloadManager } from './services/download.service'
import { autoUpdater } from 'electron-updater'
import icon from '../../resources/icon.png?asset'
import { TrayManager } from './tray'

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    if (!mainWindow.isVisible()) mainWindow.show()
    mainWindow.focus()
  }
})

// Disable Chromium automation detection flags (required for Cloudflare bypass)
app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled')

import { NetworkService } from '@common/services/network'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { CacheManager } from './services/cache.service'
import { mangaCacheRepo } from './db'

// Register Services
import db, { runCleanupRoutine } from './db'
import { extensionOrchestrator } from './services/extension.service'
import { identityService } from './services/identity.service'
import { syncServer } from './services/sync-server.service'
import { cloudflareService } from './services/cloudflare.service'
ServiceRegistry.register(identityService)
ServiceRegistry.register(syncServer)
ServiceRegistry.register(cloudflareService)
ServiceRegistry.register(DownloadManager.getInstance())
ServiceRegistry.register(extensionOrchestrator)
import { registerDatabaseHandlers } from './ipc/database'
import { registerExtensionHandlers } from './ipc/extensions'
import { registerNetworkHandlers } from './ipc/network'
import { registerWindowHandlers } from './ipc/window'
import { registerDownloadHandlers } from './ipc/downloads'
import { registerSyncHandlers } from './ipc/sync'
import { registerSourceHandlers } from './ipc/sources'
import { IpcChannel } from './types/ipc'
import { stateRegistry } from './services/state.service'

protocol.registerSchemesAsPrivileged([
  { scheme: 'autakimi-cache', privileges: { bypassCSP: true, secure: true, supportFetchAPI: true } }
])

let mainWindow: BrowserWindow | null = null
let windowState = {
  width: 1000,
  height: 750,
  x: undefined as number | undefined,
  y: undefined as number | undefined,
  isMaximized: false
}

function createWindow(): void {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    ...(process.platform === 'win32'
      ? {
          titleBarOverlay: {
            color: '#09090b',
            symbolColor: '#f4f4f5',
            height: 32
          }
        }
      : {}),
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      devTools: is.dev
    }
  })

  if (windowState.isMaximized) {
    mainWindow.maximize()
  }

  let saveTimeout: NodeJS.Timeout | null = null
  const saveState = () => {
    if (saveTimeout) clearTimeout(saveTimeout)
    saveTimeout = setTimeout(() => {
      if (!mainWindow) return
      let bounds: { x: number; y: number; width: number; height: number }
      try {
        bounds = mainWindow.getBounds()
      } catch (e) {
        return
      }
      const isMax = mainWindow.isMaximized()
      const state = {
        width: isMax ? windowState.width : bounds.width,
        height: isMax ? windowState.height : bounds.height,
        x: isMax ? windowState.x : bounds.x,
        y: isMax ? windowState.y : bounds.y,
        isMaximized: isMax
      }
      try {
        db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
          'window_state',
          JSON.stringify(state)
        )
        windowState = state
      } catch (e) {
        console.error('Failed to save window state:', e)
      }
    }, 500)
  }

  mainWindow.on('move', saveState)

  // System Tray Initialization
  TrayManager.getInstance().createTray(mainWindow, icon)

  // Handle window close (minimize to tray)
  mainWindow.on('close', (event) => {
    // If the app is quitting (via tray or system quit), let it close
    if ((app as any).isQuitting) {
      TrayManager.getInstance().destroy()
      return
    }

    // Check setting (synchronous DB read for immediate event handling)
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('minimize_to_tray') as
      | { value: string }
      | undefined
    const minimizeToTray = row ? row.value !== 'false' : true

    if (minimizeToTray) {
      event.preventDefault()
      mainWindow?.hide()
    } else {
      TrayManager.getInstance().destroy()
    }
  })

  mainWindow?.on('ready-to-show', () => {
    mainWindow?.show()
    // Inject webContents to downloadManager for IPC events
    if (mainWindow) {
      DownloadManager.getInstance().setWebContents(mainWindow.webContents)
      syncServer.setWebContents(mainWindow.webContents)
      stateRegistry.setWebContents(mainWindow.webContents)
    }
    setImmediate(() => {
      runCleanupRoutine()
    })
  })

  mainWindow?.webContents?.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Initialize Services
  await ServiceRegistry.initializeAll()

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.codixy.autakimi')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Register Modular IPC Handlers
  registerDatabaseHandlers()
  registerExtensionHandlers()
  registerNetworkHandlers()
  registerWindowHandlers()
  registerDownloadHandlers()
  registerSyncHandlers()
  registerSourceHandlers()

  // Initialize CacheManager
  const cacheManager = CacheManager.getInstance()

  // Connect Manga Cache Repo
  cacheManager.setMangaRepo(mangaCacheRepo)
  ServiceRegistry.register(cacheManager)

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  // === Cache Protocol Handler ===
  protocol.handle('autakimi-cache', async (request) => {
    try {
      const url = request.url.replace('autakimi-cache://', 'https://')

      // Prioritize local extension icons (match /icon/, /icons/, or /local-icon/)
      if (
        (url.includes('/icons/') || url.includes('/icon/') || url.includes('/local-icon/')) &&
        url.endsWith('.png')
      ) {
        const filename = path.basename(url)
        const localIconPath = is.dev
          ? path.join(
              process.cwd(),
              'src',
              'renderer',
              'src',
              'app',
              'assets',
              'Extensionicon',
              filename
            )
          : path.join(process.resourcesPath, 'Extensionicon', filename)

        try {
          if (fs.existsSync(localIconPath)) {
            return new Response(fs.readFileSync(localIconPath))
          }
        } catch (e) {
          console.error('Local icon load failed:', e)
        }

        // Block remote icon fetching
        return new Response('Icon not found locally', { status: 404 })
      }

      const hash = crypto.createHash('md5').update(url).digest('hex')
      const imageCache = CacheManager.getInstance().getImageCache()

      const buffer = await imageCache.get(hash)
      if (buffer) return new Response(new Uint8Array(buffer))

      let origin = 'https://'
      try {
        origin = new URL(url).origin + '/'
      } catch {
        /* ignore */
      }

      const response = await NetworkService.fetchWithRetry(
        url,
        {
          headers: {
            'User-Agent': session.defaultSession.getUserAgent(),
            Referer: origin
          }
        },
        NetworkConfig.DEFAULT_RETRY_ATTEMPTS,
        NetworkConfig.DEFAULT_RETRY_DELAY,
        net.fetch
      )

      if (!response.ok) return new Response('Error loading resource', { status: response.status })

      const resBuffer = Buffer.from(await response.arrayBuffer())
      await imageCache.set(hash, resBuffer)

      return new Response(new Uint8Array(resBuffer))
    } catch (error) {
      console.error('Cache Protocol Error:', error)
      return new Response('Error loading resource', { status: 500 })
    }
  })

  // Initialize auto updater
  autoUpdater.logger = console
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'anasx07',
    repo: 'AutaKimi-Release',
    private: false
  })
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  // Update events
  autoUpdater.on('checking-for-update', () => {
    mainWindow?.webContents.send(IpcChannel.APP_UPDATE, { status: 'checking' })
  })
  autoUpdater.on('update-available', () => {
    mainWindow?.webContents.send(IpcChannel.APP_UPDATE, { status: 'available' })
  })
  autoUpdater.on('update-not-available', () => {
    mainWindow?.webContents.send(IpcChannel.APP_UPDATE, { status: 'idle' })
  })
  autoUpdater.on('download-progress', (progressObj) => {
    mainWindow?.webContents.send(IpcChannel.APP_UPDATE, {
      status: 'downloading',
      progress: progressObj
    })
  })
  autoUpdater.on('update-downloaded', () => {
    mainWindow?.webContents.send(IpcChannel.APP_UPDATE, { status: 'downloaded' })
  })
  autoUpdater.on('error', (err) => {
    mainWindow?.webContents.send(IpcChannel.APP_UPDATE, { status: 'error', error: err.message })
  })

  ipcMain.handle(IpcChannel.INSTALL_UPDATE, () => {
    autoUpdater.quitAndInstall()
  })

  ipcMain.handle(IpcChannel.CHECK_FOR_UPDATE, () => {
    autoUpdater.checkForUpdatesAndNotify()
  })

  ipcMain.on(IpcChannel.GET_VERSION, (event) => {
    event.returnValue = app.getVersion()
  })

  autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    console.error('Failed to check for updates:', err)
  })

  // Load window state
  try {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('window_state') as
      | { value: string }
      | undefined
    if (row?.value) {
      const saved = JSON.parse(row.value)
      if (saved && typeof saved === 'object') {
        windowState = { ...windowState, ...saved }
      }
    }
  } catch (e) {
    console.error('Failed to load window state:', e)
  }

  createWindow()
  cacheManager.setWebContents(mainWindow.webContents)

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', async (event) => {
  event.preventDefault()
  await ServiceRegistry.shutdownAll()
  app.exit()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
