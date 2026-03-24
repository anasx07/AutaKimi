import { ipcMain } from 'electron'
import { IpcChannel } from '../types/ipc'
import { extensionOrchestrator } from '../services/extension.service'
import { NetworkConfig, getEffectiveUA } from '../../common/config/network'
import { extensionRepo, settingsRepo } from '../db'
import { wrapIpc } from './utils'

export function registerExtensionHandlers() {
  ipcMain.handle(IpcChannel.EXTENSION_INSTALL, wrapIpc((_, { ext, repoUrl }: { ext: any; repoUrl: string }) => extensionOrchestrator.install(ext, repoUrl)))

  interface ExecuteExtensionArgs {
    pkg: string;
    code: string;
    contextArgs: Record<string, any>;
  }

  ipcMain.handle(IpcChannel.EXECUTE_EXTENSION, wrapIpc(async (_, { pkg, code, contextArgs }: ExecuteExtensionArgs) => {
      console.log(`Executing isolated script for pkg: ${pkg}`)
      
      let bypassCf = true
      let ua: string = NetworkConfig.DEFAULT_UA
      let baseUrl = ''

      try {
        const ext = await extensionRepo.getByPkg(pkg)
        if (ext) baseUrl = ext.baseUrl || ''
        
        bypassCf = (await settingsRepo.get('bypass_cloudflare')) === 'true'
        const rowUa = await settingsRepo.get('user_agent')
        ua = getEffectiveUA((rowUa === 'Default' || !rowUa) ? undefined : rowUa)
      } catch (e) { }

      const enhancedArgs = {
        ...contextArgs,
        _bypassCloudflare: bypassCf,
        _userAgent: ua,
        _baseUrl: baseUrl
      }

      return extensionOrchestrator.runInSandbox(code, enhancedArgs)
  }))

  ipcMain.handle(IpcChannel.DETECT_THEME, wrapIpc(async (_, url) => {
    const bypassCf = (await settingsRepo.get('bypass_cloudflare')) === 'true'
    return extensionOrchestrator.detectTheme(url, bypassCf)
  }))
}
