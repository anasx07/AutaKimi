import './pre-init'

import { app, BrowserWindow, ipcMain, protocol, session, net } from 'electron'
import { join } from 'path'
import { NetworkConfig } from '@common/config/network'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { ServiceRegistry } from './services/service.registry'
import { downloadManager } from './services/download.service'
import { autoUpdater } from 'electron-updater'
import icon from '../../resources/icon.png?asset'
import { trayManager } from './tray'

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

import { networkClient } from '@common'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { cacheManager } from './services/cache.service'
import {
  buildOriginAllowlist,
  detectImageMimeType,
  isAllowedImageContentType,
  isIconUrl,
  isPathInside,
  validateGenericCacheUrl,
  validateIconUrl,
  MAX_GENERIC_CACHE_RESPONSE_BYTES,
  MAX_ICON_REMOTE_BYTES
} from './utils/cacheProtocol'

// Register Services
import db, { runCleanupRoutine, settingsRepo, mangaCacheRepo, extensionRepo } from './db'
import { extensionOrchestrator } from './services/extension.service'
import { identityService } from './services/identity.service'
import { syncServer } from './services/sync-server.service'
import { cloudflareService } from './services/cloudflare.service'
import { pluginManager } from './services/plugin.manager'
import { broadcastService } from './services/broadcast.service'
import { streamProxyService } from './services/stream-proxy.service'

cacheManager.setMangaRepo(mangaCacheRepo)
ServiceRegistry.register(cacheManager)
ServiceRegistry.register(broadcastService)
ServiceRegistry.register(identityService)
ServiceRegistry.register(syncServer)
ServiceRegistry.register(cloudflareService)
ServiceRegistry.register(downloadManager)
ServiceRegistry.register(extensionOrchestrator)
ServiceRegistry.register(pluginManager)
ServiceRegistry.register(streamProxyService)
import { registerDatabaseHandlers } from './ipc/database'
import { registerExtensionHandlers } from './ipc/extensions'
import { registerNetworkHandlers } from './ipc/network'
import { registerWindowHandlers } from './ipc/window'
import { registerDownloadHandlers } from './ipc/downloads'
import { registerSyncHandlers } from './ipc/sync'
import { registerSourceHandlers } from './ipc/sources'
import { registerTrackerHandlers } from './ipc/trackers'
import { registerBackupHandlers } from './ipc/backup'
import { registerHandler, wrapIpc } from './ipc/utils'
import { IpcChannel } from './types/ipc'

import { handleLocalProtocol } from './utils/localProtocol'

protocol.registerSchemesAsPrivileged([
  { scheme: 'autakimi-cache', privileges: { bypassCSP: true, secure: true, supportFetchAPI: true } },
  { scheme: 'autakimi-local', privileges: { bypassCSP: true, secure: true, supportFetchAPI: true, corsEnabled: true } }
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
  mainWindow.on('resize', saveState)

  // System Tray Initialization
  trayManager.createTray(mainWindow, icon)

  // Handle window close (minimize to tray)
  mainWindow.on('close', (event) => {
    // If the app is quitting (via tray or system quit), let it close
    if ((app as any).isQuitting) {
      trayManager.destroy()
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
      trayManager.destroy()
    }
  })

    mainWindow?.on('ready-to-show', () => {
      mainWindow?.show()
      // Inject webContents to BroadcastService for centralized IPC
      if (mainWindow) {
        broadcastService.setWebContents(mainWindow.webContents)
      }
      setTimeout(() => {
        runCleanupRoutine()
      }, 5000)
    })

  // Block ALL popup ads and external windows from embedded video players (Vidmoly, StreamWish, Byse, etc.)
  mainWindow?.webContents?.setWindowOpenHandler((details) => {
    console.warn('[Main] Blocked popup window from embed/player:', details.url)
    return { action: 'deny' }
  })

  // ─── Default Session Interceptors for Video Streaming & Embeds ───
  // 1. Strip frame-blocking headers (X-Frame-Options, Content-Security-Policy) so embeds load in iframes, and allow CORS
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...details.responseHeaders }
    for (const key in responseHeaders) {
      const lower = key.toLowerCase()
      if (
        lower === 'x-frame-options' ||
        lower === 'content-security-policy' ||
        lower === 'content-security-policy-report-only'
      ) {
        delete responseHeaders[key]
      }
    }
    // Allow CORS headers for media streaming and API calls
    responseHeaders['Access-Control-Allow-Origin'] = ['*']
    responseHeaders['Access-Control-Allow-Methods'] = ['GET, HEAD, OPTIONS']
    responseHeaders['Access-Control-Allow-Headers'] = ['*']
    callback({ cancel: false, responseHeaders })
  })

  // 2. Block anti-sandbox redirects (e.g. Vidmoly eblock.php which displays "The embed could not be loaded")
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    if (details.url.includes('eblock.php')) {
      return callback({ cancel: true })
    }
    callback({ cancel: false })
  })

  // 3. Ensure valid Referer header for third-party streaming video embeds
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    const requestHeaders = { ...details.requestHeaders }
    const url = details.url.toLowerCase()
    if (
      url.includes('vidmoly') ||
      url.includes('lulustream') ||
      url.includes('morencius') ||
      url.includes('mp4upload') ||
      url.includes('sendvid') ||
      url.includes('uqload') ||
      url.includes('voe.sx') ||
      url.includes('mixdrop') ||
      url.includes('streamtape')
    ) {
      const currentRef = requestHeaders['Referer']
      if (!currentRef || currentRef.includes('localhost') || currentRef.startsWith('file:')) {
        try {
          const parsed = new URL(details.url)
          requestHeaders['Referer'] = `${parsed.protocol}//${parsed.host}/`
        } catch {}
      }
    }
    callback({ cancel: false, requestHeaders })
  })

  // Prevent unauthorized top-level navigations on mainWindow
  mainWindow?.webContents?.on('will-navigate', (event, navigationUrl) => {
    const isDevUrl = is.dev && process.env['ELECTRON_RENDERER_URL'] && navigationUrl.startsWith(process.env['ELECTRON_RENDERER_URL'])
    const isLocalFile = navigationUrl.startsWith('file://')
    if (!isDevUrl && !isLocalFile) {
      event.preventDefault()
      console.warn('[Main] Blocked top-level navigation from embed/player:', navigationUrl)
    }
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
  registerTrackerHandlers()
  registerBackupHandlers()

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  // === Local Protocol Handler ===
  protocol.handle('autakimi-local', async (request) => handleLocalProtocol(request))

  // === Cache Protocol Handler ===
  protocol.handle('autakimi-cache', async (request) => {
    try {
      const rawUrl = request.url

      // Build the registered-repository and installed extensions allowlist once per request.
      const [reposJson, installedExts, allSettings] = await Promise.all([
        settingsRepo.get('source_repositories'),
        extensionRepo.getAll().catch(() => []),
        settingsRepo.getAll().catch(() => ({} as Record<string, string>))
      ])
      const repos: unknown = reposJson ? JSON.parse(reposJson) : []
      const overrideUrls = Object.entries(allSettings || {})
        .filter(([k, v]) => k.startsWith('domain_override_') && typeof v === 'string' && v.trim())
        .map(([, v]) => v as string)
      const allowlist = buildOriginAllowlist(repos, [...installedExts, ...overrideUrls])

      // Prioritize local extension icons (match /icon/, /icons/, or /local-icon/)
      if (isIconUrl(rawUrl.replace(/^autakimi-cache:\/\//i, 'https://'))) {
        const iconCheck = validateIconUrl(rawUrl)
        if (!iconCheck.ok) {
          return new Response(`Forbidden: ${iconCheck.reason}`, { status: iconCheck.status })
        }

        const filename = path.basename(iconCheck.url.toString())
        const userDataIconsDir = path.join(app.getPath('userData'), 'icons')
        if (!fs.existsSync(userDataIconsDir)) {
          fs.mkdirSync(userDataIconsDir, { recursive: true })
        }
        const cachedIconPath = path.join(userDataIconsDir, filename)

        // 1. Check userData/icons cache first (defense in depth: ensure path
        //    stays inside the icons directory even though basename + join
        //    already prevents traversal).
        try {
          if (
            isPathInside(cachedIconPath, userDataIconsDir) &&
            fs.existsSync(cachedIconPath)
          ) {
            return new Response(fs.readFileSync(cachedIconPath), {
              headers: {
                'Content-Type': 'image/png',
                'X-Content-Type-Options': 'nosniff'
              }
            })
          }
        } catch (e) {
          console.error('Cached icon load failed:', e)
        }

        // 2. Check bundled local icon (dev workspace dist/icons, icons, or resourcesPath)
        const localIconBases = is.dev
          ? [
              path.join(process.cwd(), 'autakimi-extensions', 'dist', 'icons'),
              path.join(process.cwd(), 'autakimi-extensions', 'icons'),
              path.resolve(process.cwd(), '..', 'autakimi-extensions', 'dist', 'icons'),
              path.resolve(process.cwd(), '..', 'autakimi-extensions', 'icons')
            ]
          : [
              path.join(process.resourcesPath, 'icons'),
              path.join(process.resourcesPath, 'extensions', 'icons')
            ]

        for (const localIconBase of localIconBases) {
          const localIconPath = path.join(localIconBase, filename)
          try {
            if (isPathInside(localIconPath, localIconBase) && fs.existsSync(localIconPath)) {
              return new Response(fs.readFileSync(localIconPath), {
                headers: {
                  'Content-Type': 'image/png',
                  'X-Content-Type-Options': 'nosniff'
                }
              })
            }
          } catch (e) {
            console.error('Local icon load failed:', e)
          }
        }

        // 3. Fallback: Check remote repositories for the icon, and cache it.
        //    The remote URL is constructed from the registered repo's baseUrl,
        //    so we never fetch an attacker-controlled host directly.
        if (allowlist.size > 0) {
          for (const repo of Array.isArray(repos) ? repos : []) {
            if (typeof repo !== 'string') continue
            const baseUrl = repo.endsWith('templates.json')
              ? repo.replace('templates.json', '')
              : repo.endsWith('/') ? repo : `${repo}/`

            const remoteUrl = `${baseUrl}icons/${filename}`
            try {
              const remoteCheck = validateGenericCacheUrl(remoteUrl, allowlist)
              if (!remoteCheck.ok) continue

              const res = await fetch(remoteUrl, { redirect: 'error' })
              if (res.ok) {
                const declared = res.headers.get('content-length')
                if (declared && parseInt(declared, 10) > MAX_ICON_REMOTE_BYTES) {
                  console.warn(`[autakimi-cache] Icon too large, skipping: ${remoteUrl}`)
                  continue
                }
                const buffer = await res.arrayBuffer()
                if (buffer.byteLength > MAX_ICON_REMOTE_BYTES) {
                  console.warn(`[autakimi-cache] Icon body too large, skipping: ${remoteUrl}`)
                  continue
                }

                // Cache it locally so it works offline. The cache path has
                // already been validated against the icons directory above.
                try {
                  if (isPathInside(cachedIconPath, userDataIconsDir)) {
                    fs.writeFileSync(cachedIconPath, Buffer.from(buffer))
                  }
                } catch (writeErr) {
                  console.error('[autakimi-cache] Failed to write cached icon:', writeErr)
                }

                return new Response(buffer, {
                  headers: {
                    'Content-Type': 'image/png',
                    'X-Content-Type-Options': 'nosniff'
                  }
                })
              }
            } catch (e) {
              console.error('Remote icon load failed:', e)
            }
          }
        }

        // Block remote icon fetching if all failed
        return new Response('Icon not found', { status: 404 })
      }

      // ─── Generic cache branch ──────────────────────────────────────────────
      const genericCheck = validateGenericCacheUrl(rawUrl, allowlist)
      if (!genericCheck.ok) {
        return new Response(`Forbidden: ${genericCheck.reason}`, { status: genericCheck.status })
      }
      const url = genericCheck.url.toString()

      const hash = crypto.createHash('md5').update(url).digest('hex')
      const imageCache = cacheManager.getImageCache()

      const buffer = await imageCache.get(hash)
      if (buffer) {
        const mimeType = detectImageMimeType(buffer, url)
        return new Response(new Uint8Array(buffer), {
          headers: {
            'Content-Type': mimeType,
            'X-Content-Type-Options': 'nosniff'
          }
        })
      }

      let origin = 'https://'
      try {
        origin = new URL(url).origin + '/'
      } catch {
        /* ignore */
      }

      const res = await networkClient.fetch(url, {
        headers: {
          'User-Agent': session.defaultSession.getUserAgent(),
          Referer: origin
        },
        attempts: NetworkConfig.DEFAULT_RETRY_ATTEMPTS,
        delay: NetworkConfig.DEFAULT_RETRY_DELAY,
        fetchFn: net.fetch,
        // Refuse upstream redirects so the response cannot pivot to a host
        // outside the allowlist via a 30x chain.
        redirect: 'error'
      })

      if (!res.ok) return new Response('Error loading resource', { status: res.status || 500 })
      const response = res.value

      // Reject non-image responses so the cached body cannot be used as
      // script/HTML via the bypassCSP privilege of this protocol.
      const upstreamType = response.headers.get('content-type')
      if (!isAllowedImageContentType(upstreamType)) {
        return new Response('Unsupported content type', { status: 415 })
      }

      // Enforce a size cap before fully buffering the response to prevent
      // OOM in the main process from a hostile or compromised upstream.
      const declared = response.headers.get('content-length')
      if (declared && parseInt(declared, 10) > MAX_GENERIC_CACHE_RESPONSE_BYTES) {
        return new Response('Response too large', { status: 413 })
      }
      const resBuffer = Buffer.from(await response.arrayBuffer())
      if (resBuffer.length > MAX_GENERIC_CACHE_RESPONSE_BYTES) {
        return new Response('Response too large', { status: 413 })
      }
      await imageCache.set(hash, resBuffer)

      const safeType =
        (upstreamType ? upstreamType.split(';')[0].trim() : '') ||
        detectImageMimeType(resBuffer, url)
      return new Response(new Uint8Array(resBuffer), {
        headers: {
          'Content-Type': safeType,
          'X-Content-Type-Options': 'nosniff'
        }
      })
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
    repo: 'AutaKimi',
    private: false
  })
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  // Update events
  autoUpdater.on('checking-for-update', () => {
    broadcastService.send(IpcChannel.APP_UPDATE, { status: 'checking' })
  })
  autoUpdater.on('update-available', () => {
    broadcastService.send(IpcChannel.APP_UPDATE, { status: 'available' })
  })
  autoUpdater.on('update-not-available', () => {
    broadcastService.send(IpcChannel.APP_UPDATE, { status: 'idle' })
  })
  autoUpdater.on('download-progress', (progressObj) => {
    broadcastService.send(IpcChannel.APP_UPDATE, {
      status: 'downloading',
      progress: progressObj
    })
  })
  autoUpdater.on('update-downloaded', () => {
    broadcastService.send(IpcChannel.APP_UPDATE, { status: 'downloaded' })
  })
  autoUpdater.on('error', (err) => {
    broadcastService.send(IpcChannel.APP_UPDATE, { status: 'error', error: err.message })
  })

  registerHandler(IpcChannel.INSTALL_UPDATE, wrapIpc(async () => {
    autoUpdater.quitAndInstall()
  }))

  registerHandler(IpcChannel.CHECK_FOR_UPDATE, wrapIpc(async () => {
    autoUpdater.checkForUpdatesAndNotify()
  }))

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

let isShuttingDown = false

app.on('before-quit', async (event) => {
  if (isShuttingDown) return

  event.preventDefault()
  isShuttingDown = true
  ;(app as any).isQuitting = true

  try {
    await ServiceRegistry.shutdownAll()
  } catch (err) {
    console.error('Error during ServiceRegistry shutdown:', err)
  }

  app.quit()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
