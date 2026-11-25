import { IpcChannel } from '../types/ipc'
import { extensionOrchestrator } from '../services/extension.service'
import { NetworkConfig, getEffectiveUA } from '@common/config/network'
import { extensionRepo, settingsRepo } from '../db'
import { extractBasePkg } from '@common/services/repoIdentity'
import { registerHandler, wrapIpc } from './utils'
import { cloudflareService } from '../services/cloudflare.service'

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
      let { pkg, code, contextArgs, taskId } = args
      if (typeof pkg !== 'string') {
        throw new Error('Invalid pkg parameter')
      }
      if (!code) {
        const ext = await extensionRepo.getByPkg(pkg)
        if (ext && ext.code) {
          code = ext.code
        }
      }
      if (typeof code !== 'string') {
        throw new Error('Invalid code parameter')
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
      let rowUa: string | null = null

      try {
        const basePkg = extractBasePkg(pkg)
        const cleanPkg = basePkg.replace(/^ma\.autakimi\.extension\./, '')
        const fullPkg = basePkg.startsWith('ma.autakimi.extension.')
          ? basePkg
          : `ma.autakimi.extension.${basePkg}`

        const ext =
          (await extensionRepo.getByPkg(pkg)) ||
          (await extensionRepo.getByPkg(fullPkg)) ||
          (await extensionRepo.getByPkg(cleanPkg)) ||
          (await extensionRepo.getByPkg(basePkg))
        if (ext) baseUrl = ext.baseUrl || ''

        const domainOverride =
          (await settingsRepo.get(`domain_override_${pkg}`)) ||
          (await settingsRepo.get(`domain_override_${fullPkg}`)) ||
          (await settingsRepo.get(`domain_override_${cleanPkg}`)) ||
          (await settingsRepo.get(`domain_override_${basePkg}`))

        if (domainOverride && domainOverride.trim() !== '') {
          baseUrl = domainOverride.trim()
          console.log(`[ExtIPC] Applied domain override for ${pkg}: ${baseUrl}`)
        }

        console.log(`[ExtIPC] baseUrl: ${baseUrl}`)

        const bypassSetting = await settingsRepo.get('bypass_cloudflare')
        bypassCf = bypassSetting !== 'false'
        rowUa = await settingsRepo.get('user_agent')
        ua = getEffectiveUA(rowUa === 'Default' || !rowUa ? undefined : rowUa)
        console.log(`[ExtIPC] bypassCf: ${bypassCf}, ua: ${ua.slice(0, 40)}...`)
      } catch (e) {
        console.warn('[ExtIPC] Error reading settings:', e)
      }

      // Read CF credentials from CloudflareService (which uses session.fromPartition('persist:cloudflare'))
      let cfCookies = ''
      if (bypassCf && baseUrl) {
        try {
          const creds = await cloudflareService.getCredentials(baseUrl)
          cfCookies = creds.cookies
          if (creds.userAgent && (!rowUa || rowUa === 'Default')) {
            ua = creds.userAgent
          }
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
        baseUrl: baseUrl,
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
      const bypassSetting = await settingsRepo.get('bypass_cloudflare')
      const bypassCf = bypassSetting !== 'false'
      return extensionOrchestrator.detectTheme(url, bypassCf)
    })
  )
}
