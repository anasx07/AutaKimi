import { ipcMain } from 'electron'
import { IpcChannel } from '../types/ipc'
import { extensionOrchestrator } from '../services/extension.service'
import { extensionRepo, settingsRepo } from '../db'

export function registerExtensionHandlers() {
  ipcMain.handle(IpcChannel.EXTENSION_INSTALL, async (_, { ext, repoUrl }: { ext: any; repoUrl: string }) => {
    try {
      const data = await extensionOrchestrator.install(ext, repoUrl)
      return { ok: true, value: data }
    } catch (error: any) {
      console.error('[extension:install] Error:', error)
      return { ok: false, error: error.message }
    }
  })

  interface ExecuteExtensionArgs {
    pkg: string;
    code: string;
    contextArgs: Record<string, any>;
  }

  ipcMain.handle(IpcChannel.EXECUTE_EXTENSION, async (_, { pkg, code, contextArgs }: ExecuteExtensionArgs) => {
    try {
      console.log(`Executing isolated script for pkg: ${pkg}`)
      
      let bypassCf = true
      let ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      let baseUrl = ''

      try {
        const ext = await extensionRepo.getByPkg(pkg)
        if (ext) baseUrl = ext.baseUrl || ''
        
        bypassCf = (await settingsRepo.get('bypass_cloudflare')) === 'true'
        const rowUa = await settingsRepo.get('user_agent')
        if (rowUa && rowUa !== 'Default') ua = rowUa
      } catch (e) { }

      const enhancedArgs = {
        ...contextArgs,
        _bypassCloudflare: bypassCf,
        _userAgent: ua,
        _baseUrl: baseUrl
      }

      const data = await extensionOrchestrator.runInSandbox(code, enhancedArgs)
      return { ok: true, value: data }
    } catch (error: any) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle(IpcChannel.DETECT_THEME, async (_, url) => {
    try {
      const bypassCfValue = await settingsRepo.get('bypass_cloudflare')
      const bypassCf = bypassCfValue === 'true'
      const data = await extensionOrchestrator.detectTheme(url, bypassCf)
      return { ok: true, value: data }
    } catch (error: any) {
      return { ok: false, error: error.message }
    }
  })
}
