import { IpcChannel } from '../types/ipc'
import { extensionOrchestrator } from '../services/extension.service'
import { NetworkConfig, getEffectiveUA } from '@common/config/network'
import { extensionRepo, settingsRepo } from '../db'
import { registerHandler, wrapIpc } from './utils'

export function registerExtensionHandlers() {
  registerHandler(
    IpcChannel.EXTENSION_INSTALL,
    wrapIpc((_, ext: any, repoUrl: string) => {
      if (!ext || typeof ext !== 'object') throw new Error('Invalid extension data')
      if (typeof repoUrl !== 'string') throw new Error('Invalid repository URL')
      return extensionOrchestrator.install(ext, repoUrl)
    })
  )

  interface ExecuteExtensionArgs {
    pkg: string
    code: string
    contextArgs: Record<string, any>
    taskId?: string
  }

  registerHandler(
    IpcChannel.EXECUTE_EXTENSION,
    wrapIpc(async (_, args: ExecuteExtensionArgs) => {
      if (!args || typeof args !== 'object') throw new Error('Invalid execution arguments')
      const { pkg, code, contextArgs, taskId } = args
      if (typeof pkg !== 'string' || typeof code !== 'string') {
        throw new Error('Invalid pkg or code parameter')
      }
      if (contextArgs && typeof contextArgs !== 'object') {
        throw new Error('Invalid contextArgs parameter')
      }
      if (taskId !== undefined && typeof taskId !== 'string') {
        throw new Error('Invalid taskId parameter')
      }
      console.log(`[ExtIPC] Executing pkg: ${pkg}, activeFeed: ${contextArgs?.activeFeed}`)

      let bypassCf = true
      let ua: string = NetworkConfig.DEFAULT_UA
      let baseUrl = ''

      try {
        const ext = await extensionRepo.getByPkg(pkg)
        if (ext) baseUrl = ext.baseUrl || ''
        console.log(`[ExtIPC] baseUrl: ${baseUrl}`)

        bypassCf = (await settingsRepo.get('bypass_cloudflare')) === 'true'
        const rowUa = await settingsRepo.get('user_agent')
        ua = getEffectiveUA(rowUa === 'Default' || !rowUa ? undefined : rowUa)
        console.log(`[ExtIPC] bypassCf: ${bypassCf}, ua: ${ua.slice(0, 40)}...`)
      } catch (e) {
        console.warn('[ExtIPC] Error reading settings:', e)
      }

      // Read CF cookies from the default session and pass as a string
      let cfCookies = ''
      if (bypassCf && baseUrl) {
        try {
          const { session } = await import('electron')
          const cookies = await session.defaultSession.cookies.get({
            domain: new URL(baseUrl).hostname
          })
          cfCookies = cookies.map((c) => `${c.name}=${c.value}`).join('; ')
          console.log(
            `[ExtIPC] CF cookies for ${new URL(baseUrl).hostname}: ${cfCookies ? cfCookies.slice(0, 60) + '...' : '(none)'}`
          )
        } catch (e) {
          console.warn('[ExtIPC] Failed to read CF cookies:', e)
        }
      }

      const enhancedArgs = {
        ...contextArgs,
        _bypassCloudflare: bypassCf,
        _userAgent: ua,
        _baseUrl: baseUrl,
        _cfCookies: cfCookies
      }

      console.log('[ExtIPC] Sending to sandbox...')
      const result = await extensionOrchestrator.runInSandbox(pkg, code, enhancedArgs, taskId)
      console.log(
        `[ExtIPC] Sandbox result: items=${result?.data?.length ?? 'N/A'}, error=${result?.error ?? 'none'}`
      )
      return result
    })
  )

  registerHandler(
    IpcChannel.CANCEL_EXTENSION_EXECUTION,
    wrapIpc(async (_, taskId: string) => {
      if (typeof taskId !== 'string') throw new Error('Invalid taskId parameter')
      return extensionOrchestrator.cancelExtension(taskId)
    })
  )

  registerHandler(
    IpcChannel.DETECT_THEME,
    wrapIpc(async (_, url) => {
      if (typeof url !== 'string') throw new Error('Invalid URL')
      const bypassCf = (await settingsRepo.get('bypass_cloudflare')) === 'true'
      return extensionOrchestrator.detectTheme(url, bypassCf)
    })
  )
}

