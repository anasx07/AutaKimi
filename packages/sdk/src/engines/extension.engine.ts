import { templateService } from '../templates'
import { NetworkConfig } from '../config/network'

export interface IExtensionPlatform {
  fetch(url: string, init?: any, bypassCf?: boolean): Promise<{ ok: boolean; status: number; text(): Promise<string>; json(): Promise<any> }>
  runSandbox(code: string, params: Record<string, any>): Promise<any>
  getSetting(key: string): Promise<string | null>
  upsertExtension(ext: {
    pkg: string
    installedAt: string
    code: string
    name: string
    baseUrl?: string
    lang?: string
    icon: string
    version: string
  }): Promise<void>
}

export class ExtensionEngine {
  constructor(private platform: IExtensionPlatform) {}

  async detectTheme(url: string, bypassCf = true): Promise<string> {
    const check = async (testUrl: string) => {
      try {
        const response = await this.platform.fetch(
          testUrl,
          {
            headers: { 'User-Agent': NetworkConfig.DEFAULT_UA }
          },
          bypassCf
        )
        const html = await response.text()
        
        // Dynamic detection: Loop through loaded templates and check for their markers
        // For now, we still have some hardcoded logic but it's based on loaded templates
        if (templateService.getTemplate('madara') && (
          html.includes('madara') ||
          html.includes('wp-content/themes/madara') ||
          html.includes('Madara')
        )) return 'madara'

        if (templateService.getTemplate('mangastream') && (
          html.includes('mangastream') ||
          html.includes('wp-content/themes/mangastream') ||
          html.includes('class="bsx"') ||
          html.includes('class="listupd"')
        )) return 'mangastream'

      } catch (e) {
        console.warn(`[ExtensionEngine] detectTheme error on ${testUrl}:`, e)
      }
      return 'unknown'
    }

    let theme = await check(url)
    if (theme === 'unknown') {
      const cleanUrl = url.replace(/\/$/, '')
      theme = await check(`${cleanUrl}/series`)
      if (theme === 'unknown') theme = await check(`${cleanUrl}/manga`)
    }
    return theme
  }

  async install(ext: any, repoUrl: string): Promise<{ success: boolean }> {
    const KEI_REPO = 'https://raw.githubusercontent.com/keiyoushi/extensions-source/main'
    const baseUrl = repoUrl === 'local' ? KEI_REPO : repoUrl.replace('/index.min.json', '')
    let code = ''

    const bypassCf = (await this.platform.getSetting('bypass_cloudflare')) === 'true'

    try {
      const response = await this.platform.fetch(`${baseUrl}/js/${ext.pkg}.js`, {}, bypassCf)
      if (response.ok) code = await response.text()
    } catch (e) {}

    if (!code) {
      const extBaseUrl = ext.sources?.[0]?.baseUrl
      if (extBaseUrl) {
        const theme = await this.detectTheme(extBaseUrl, bypassCf)
        const template = templateService.getTemplate(theme)
        if (template) code = template.generate(extBaseUrl, NetworkConfig.DEFAULT_UA)
      }
    }

    // Use a clean local-only URL format (this is a convention handled by the cache protocol)
    const iconUrl = `autakimi-cache://local-icon/${ext.pkg}.png`

    await this.platform.upsertExtension({
      pkg: ext.pkg,
      installedAt: new Date().toISOString(),
      code,
      name: ext.name,
      baseUrl: ext.sources?.[0]?.baseUrl,
      lang: ext.lang,
      icon: iconUrl,
      version: ext.version
    })

    return { success: true }
  }

  async execute(_pkg: string, code: string, params: Record<string, any> = {}): Promise<any> {
      return this.platform.runSandbox(code, params)
  }
}
