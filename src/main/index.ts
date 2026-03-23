import { app, shell, BrowserWindow, ipcMain, protocol } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import icon from '../../resources/icon.png?asset'

// Set app name before importing db to ensure correct userData path
app.name = 'LManwa'

import { NetworkService } from '../common/services/network'
import path from 'path'
import { DiskCache } from './cache/DiskCache'
import crypto from 'crypto'
import { registerDatabaseHandlers } from './ipc/database'
import { registerExtensionHandlers } from './ipc/extensions'
import { registerNetworkHandlers } from './ipc/network'
import { registerWindowHandlers } from './ipc/window'
import { registerDownloadHandlers } from './ipc/downloads'

protocol.registerSchemesAsPrivileged([
  { scheme: 'lmanwa-cache', privileges: { bypassCSP: true, secure: true, supportFetchAPI: true } }
])

const MAX_CACHE_SIZE = 500 * 1024 * 1024 // 500MB
export let imageCache: DiskCache;



function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    ...(process.platform === 'win32' ? {
      titleBarOverlay: {
        color: '#09090b',
        symbolColor: '#f4f4f5',
        height: 32
      }
    } : {}),
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
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
app.whenReady().then(() => {
  imageCache = new DiskCache(path.join(app.getPath('userData'), 'image_cache'), MAX_CACHE_SIZE)

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

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

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  // === Cache Protocol Handler ===
  protocol.handle('lmanwa-cache', async (request) => {
    try {
      const url = request.url.replace('lmanwa-cache://', 'https://')
      const hash = crypto.createHash('md5').update(url).digest('hex')

      const buffer = await imageCache.get(hash)
      if (buffer) return new Response(new Uint8Array(buffer))

      const response = await NetworkService.fetchWithRetry(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': new URL(url).origin + '/'
        }
      }, 3, 1000, fetch) // Standard fetch is fine here
      
      const resBuffer = Buffer.from(await response.arrayBuffer())
      await imageCache.set(hash, resBuffer)
      
      return new Response(new Uint8Array(resBuffer))
    } catch (error) {
      console.error('Cache Protocol Error:', error)
      return new Response('Error loading resource', { status: 500 })
    }
  })

  // Initialize auto updater
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'anasx07',
    repo: 'LManwa-Release',
    private: false
  })
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  
  autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    console.error('Failed to check for updates:', err)
  })

  createWindow()

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

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
