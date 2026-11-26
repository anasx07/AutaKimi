import { app } from 'electron'
import { autoUpdater, type UpdateInfo } from 'electron-updater'
import { spawn } from 'child_process'
import crypto from 'crypto'
import fs from 'fs'
import os from 'os'
import path from 'path'
import db from '../db'
import { broadcastService } from './broadcast.service'
import { IpcChannel } from '../types/ipc'
import { registerHandler, wrapIpc } from '../ipc/utils'

const PENDING_META_KEY = 'pending_update_meta'
const PENDING_ATTEMPT_KEY = 'pending_update_attempt'

interface PendingUpdateMeta {
  version: string
  sha512: string
}

interface PendingUpdateAttempt {
  version: string
  sha512: string
  timestamp: number
}

interface CachedUpdateInfoJson {
  fileName?: string
  sha512?: string
  isAdminRightsRequired?: boolean
}

function readDbJson<T>(key: string): T | null {
  try {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
      | { value: string }
      | undefined
    if (!row?.value) return null
    return JSON.parse(row.value) as T
  } catch {
    return null
  }
}

function writeDbJson(key: string, value: unknown): void {
  try {
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
      key,
      JSON.stringify(value)
    )
  } catch (err) {
    console.warn(`[Updater] Failed to persist ${key}:`, err)
  }
}

function deleteDbSetting(key: string): void {
  try {
    db.prepare('DELETE FROM settings WHERE key = ?').run(key)
  } catch {
    // ignore
  }
}

/**
 * Compares two semver strings numerically (ignoring optional leading 'v' or pre-release tags).
 * Returns > 0 if a > b, < 0 if a < b, 0 if equal.
 */
export function compareSemver(a: string, b: string): number {
  const parseParts = (v: string): [number, number, number] => {
    const clean = v.trim().replace(/^v/i, '').split('-')[0].split('+')[0]
    const parts = clean.split('.').map((n) => Number.parseInt(n, 10) || 0)
    return [parts[0] || 0, parts[1] || 0, parts[2] || 0]
  }
  const pa = parseParts(a)
  const pb = parseParts(b)
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i]
  }
  return 0
}

function resolvePendingCacheDir(): string | null {
  try {
    const cacheBase =
      process.platform === 'win32'
        ? process.env['LOCALAPPDATA'] || path.join(os.homedir(), 'AppData', 'Local')
        : process.platform === 'darwin'
          ? path.join(os.homedir(), 'Library', 'Caches')
          : process.env['XDG_CACHE_HOME'] || path.join(os.homedir(), '.cache')

    let cacheDirName = `${app.getName()}-updater`
    const appUpdateConfigPath = path.join(process.resourcesPath, 'app-update.yml')
    if (fs.existsSync(appUpdateConfigPath)) {
      const yml = fs.readFileSync(appUpdateConfigPath, 'utf-8')
      const match = yml.match(/^updaterCacheDirName:\s*(.+)$/m)
      if (match?.[1]) {
        const parsed = match[1].trim().replace(/^['"]|['"]$/g, '')
        if (parsed) cacheDirName = parsed
      }
    }

    return path.join(cacheBase, cacheDirName, 'pending')
  } catch {
    return null
  }
}

function computeFileSha512Base64(filePath: string): string {
  const hash = crypto.createHash('sha512')
  const fd = fs.openSync(filePath, 'r')
  try {
    const buffer = Buffer.allocUnsafe(1024 * 1024)
    let bytesRead = 0
    while ((bytesRead = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) {
      hash.update(buffer.subarray(0, bytesRead))
    }
    return hash.digest('base64')
  } finally {
    fs.closeSync(fd)
  }
}

function resolveInfoSha512(info: UpdateInfo): string {
  const fileSha = info.files?.find((f) => typeof f.sha512 === 'string' && f.sha512)?.sha512
  return fileSha || (info as { sha512?: string }).sha512 || ''
}

/**
 * Option A Pre-Launch Fallback:
 * If a previous update was downloaded and verified, but autoInstallOnAppQuit did not
 * apply it (e.g., force close / OS shutdown / crash), verify integrity on disk and
 * launch the cached installer immediately before creating any window.
 *
 * Returns true if the installer was launched and startup should abort so the app updates.
 */
export function installPendingUpdateOnStartup(): boolean {
  if (!app.isPackaged || process.platform !== 'win32') return false

  try {
    const meta = readDbJson<PendingUpdateMeta>(PENDING_META_KEY)
    if (!meta?.version || !meta?.sha512) return false

    const currentVersion = app.getVersion()
    if (compareSemver(currentVersion, meta.version) >= 0) {
      // Already running the downloaded version or newer — clean stale tracking state
      deleteDbSetting(PENDING_META_KEY)
      deleteDbSetting(PENDING_ATTEMPT_KEY)
      return false
    }

    // Guard against infinite restart loops if the OS/user aborted or failed installation
    const prevAttempt = readDbJson<PendingUpdateAttempt>(PENDING_ATTEMPT_KEY)
    if (prevAttempt?.version === meta.version && prevAttempt?.sha512 === meta.sha512) {
      console.warn(
        `[Updater] Pre-launch install already attempted for v${meta.version}; skipping auto-launch to prevent loop.`
      )
      return false
    }

    const pendingDir = resolvePendingCacheDir()
    if (!pendingDir) return false

    const updateInfoPath = path.join(pendingDir, 'update-info.json')
    if (!fs.existsSync(updateInfoPath)) return false

    const cachedInfo = JSON.parse(fs.readFileSync(updateInfoPath, 'utf-8')) as CachedUpdateInfoJson
    if (!cachedInfo?.fileName || cachedInfo.sha512 !== meta.sha512) return false

    // Prevent path traversal via cached update-info.json
    const safeFileName = path.basename(cachedInfo.fileName)
    if (safeFileName !== cachedInfo.fileName) return false

    const installerPath = path.join(pendingDir, safeFileName)
    if (!fs.existsSync(installerPath)) return false

    const actualSha512 = computeFileSha512Base64(installerPath)
    if (actualSha512 !== meta.sha512) {
      console.warn('[Updater] Pending installer SHA-512 mismatch; skipping pre-launch install.')
      deleteDbSetting(PENDING_META_KEY)
      return false
    }

    // Record attempt synchronously before spawning so we never loop even if installer exits
    writeDbJson(PENDING_ATTEMPT_KEY, {
      version: meta.version,
      sha512: meta.sha512,
      timestamp: Date.now()
    } satisfies PendingUpdateAttempt)

    const installerArgs = ['--updated', '--force-run']
    const elevatePath = path.join(process.resourcesPath, 'elevate.exe')
    const useElevation = Boolean(cachedInfo.isAdminRightsRequired) && fs.existsSync(elevatePath)

    const child = useElevation
      ? spawn(elevatePath, [installerPath, ...installerArgs], {
          detached: true,
          stdio: 'ignore'
        })
      : spawn(installerPath, installerArgs, {
          detached: true,
          stdio: 'ignore'
        })
    child.unref()

    console.info(
      `[Updater] Launching cached v${meta.version} update before opening AutaKimi...`
    )
    app.releaseSingleInstanceLock()
    app.exit(0)
    return true
  } catch (err) {
    console.warn('[Updater] Pre-launch pending update check failed:', err)
    return false
  }
}

type AppUpdatePayload = {
  status: string
  version?: string
  manual?: boolean
  progress?: {
    percent: number
    bytesPerSecond: number
    total: number
    transferred: number
  }
  error?: string
}

let latestUpdatePayload: AppUpdatePayload | null = null

function emitAppUpdate(payload: AppUpdatePayload): void {
  latestUpdatePayload = payload
  broadcastService.send(IpcChannel.APP_UPDATE, payload)
}

/**
 * Re-sends the latest update payload after renderer load so an early
 * `downloaded` state is never missed if broadcast occurred pre-mount.
 */
export function replayUpdateStateToRenderer(): void {
  if (latestUpdatePayload && latestUpdatePayload.status === 'downloaded') {
    broadcastService.send(IpcChannel.APP_UPDATE, latestUpdatePayload)
  }
}

/**
 * Configures electron-updater events, IPC handlers, and startup background update check.
 */
export function initializeAutoUpdater(): void {
  let isManualCheck = false

  autoUpdater.logger = console
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'anasx07',
    repo: 'AutaKimi',
    private: false
  })
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.autoRunAppAfterInstall = true

  autoUpdater.on('checking-for-update', () => {
    emitAppUpdate({
      status: 'checking',
      manual: isManualCheck
    })
  })

  autoUpdater.on('update-available', (info) => {
    emitAppUpdate({
      status: 'available',
      version: info?.version,
      manual: isManualCheck
    })
  })

  autoUpdater.on('update-not-available', () => {
    isManualCheck = false
    deleteDbSetting(PENDING_META_KEY)
    deleteDbSetting(PENDING_ATTEMPT_KEY)
    emitAppUpdate({
      status: 'idle',
      manual: false
    })
  })

  autoUpdater.on('download-progress', (progressObj) => {
    emitAppUpdate({
      status: 'downloading',
      progress: progressObj,
      manual: isManualCheck
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    const manual = isManualCheck
    isManualCheck = false
    const version = info?.version
    const sha512 = info ? resolveInfoSha512(info) : ''

    if (version && sha512) {
      const prevAttempt = readDbJson<PendingUpdateAttempt>(PENDING_ATTEMPT_KEY)
      if (prevAttempt && (prevAttempt.version !== version || prevAttempt.sha512 !== sha512)) {
        deleteDbSetting(PENDING_ATTEMPT_KEY)
      }
      writeDbJson(PENDING_META_KEY, { version, sha512 } satisfies PendingUpdateMeta)
    }

    emitAppUpdate({
      status: 'downloaded',
      version,
      manual
    })
  })

  autoUpdater.on('error', (err) => {
    const manual = isManualCheck
    isManualCheck = false
    emitAppUpdate({
      status: 'error',
      error: err.message,
      manual
    })
  })

  registerHandler(
    IpcChannel.INSTALL_UPDATE,
    wrapIpc(async () => {
      deleteDbSetting(PENDING_ATTEMPT_KEY)
      autoUpdater.quitAndInstall(false, true)
    })
  )

  registerHandler(
    IpcChannel.CHECK_FOR_UPDATE,
    wrapIpc(async () => {
      isManualCheck = true
      try {
        await autoUpdater.checkForUpdatesAndNotify()
      } catch (err) {
        isManualCheck = false
        throw err
      }
    })
  )

  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify().catch((err) => {
      console.error('Failed to check for updates:', err)
    })
  }, 2000)
}
