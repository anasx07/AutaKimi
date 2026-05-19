import { DatabaseService } from './database.service'
import { NetworkBridge } from './network.service'
import { BypassService } from './bypass.service'
import { ExtensionService } from './extension.service'
import { DownloadService } from './download.service'
import { WindowService } from './window.service'
import { SystemService } from './system.service'
import { SourceService } from './source.service'
import { PluginService } from './plugin.service'
import { SyncService } from './sync.service'

/**
 * @deprecated Use domain-specific services (DatabaseService, WindowService, etc.) directly.
 * This facade is maintained for backward compatibility.
 */
export const DataService = {
  // System & Updates
  init: SystemService.init,
  getSystemState: SystemService.getSystemState,
  onSystemStateUpdate: SystemService.onSystemStateUpdate,
  checkForUpdates: SystemService.checkForUpdates,
  installUpdate: SystemService.installUpdate,
  onAppUpdate: SystemService.onAppUpdate,
  onCacheInvalidate: SystemService.onCacheInvalidate,
  detectTheme: SystemService.detectTheme,
  clearCache: SystemService.clearCache,
  clearCookies: SystemService.clearCookies,
  openExternal: WindowService.openExternal,
  openInternalBrowser: WindowService.openInternalBrowser,
  get version() {
    return SystemService.version
  },
  get platform() {
    return SystemService.platform
  },

  // Database
  db: DatabaseService,

  // Network
  ...NetworkBridge,

  // Extensions
  ...ExtensionService,

  // Cloudflare Bypass
  ...BypassService,

  // Domain Objects
  window: WindowService,
  download: DownloadService,
  sources: SourceService,
  plugins: PluginService,
  sync: SyncService
}

export {
  DatabaseService,
  NetworkBridge,
  BypassService,
  ExtensionService,
  DownloadService,
  WindowService,
  SystemService,
  SourceService,
  PluginService,
  SyncService
}
