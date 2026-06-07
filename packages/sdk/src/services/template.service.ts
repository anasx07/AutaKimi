import { networkClient } from './network'
import { repositoryService } from './repository.service'

export interface ScrapingTemplate {
  id: string
  name: string
  generate(baseUrl: string, ua: string): string
}

export class TemplateService {
  private static instance: TemplateService
  private templates = new Map<string, ScrapingTemplate>()

  public static getInstance(): TemplateService {
    if (!TemplateService.instance) {
      TemplateService.instance = new TemplateService()
    }
    return TemplateService.instance
  }

  /**
   * Fetches template definitions from multiple remote JSON files
   */
  async loadAllRepositories(urls: string[]): Promise<{ success: boolean; totalCount: number }> {
    let totalCount = 0
    for (const url of urls) {
      try {
        const manifest = await repositoryService.resolveManifest(url)
        const fetchUrl = `${manifest.baseUrl}${manifest.templates}`
        const res = await this.fetchTemplates(fetchUrl)
        if (res.success) totalCount += res.count
      } catch (e) {
        console.error(`[TemplateService] Error resolving manifest for ${url}:`, e)
      }
    }
    return { success: true, totalCount }
  }

  /**
   * Fetches template definitions from a remote JSON file
   */
  async fetchTemplates(url: string): Promise<{ success: boolean; count: number; error?: string }> {
    try {
      const res = await networkClient.fetch(url)
      if (!res.ok) throw new Error(`Failed to fetch templates: ${res.error}`)
      
      const response = res.value
      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}: Failed to retrieve file`)
      }

      const contentType = response.headers.get('content-type') || ''
      if (contentType.includes('text/html')) {
        throw new Error('Expected JSON response, but received HTML. Please make sure the URL points to a valid templates.json file.')
      }

      const data = await response.json()
      if (!data.templates || !Array.isArray(data.templates)) {
        throw new Error('Invalid template repository format')
      }

      for (const item of data.templates) {
        this.registerDynamicTemplate(item)
      }

      return { success: true, count: data.templates.length }
    } catch (err: any) {
      console.error('[TemplateService] Fetch failed:', err)
      return { success: false, count: 0, error: err.message }
    }
  }

  /**
   * Registers a template from a dynamic JSON definition
   */
  private registerDynamicTemplate(def: { id: string; name: string; generator: string }) {
    try {
      this.templates.set(def.id, {
        id: def.id,
        name: def.name,
        generate: (baseUrl: string, ua: string) => {
          // 1. Extract the content inside the backticks of the return statement.
          // A standard generator looks like: "return `content`"
          const match = def.generator.match(/return\s*`([\s\S]*)`/);
          if (!match) {
            throw new Error('Invalid template generator format: must return a backtick string.');
          }
          let content = match[1];

          // 2. Perform safe, non-eval substitution for known placeholders
          content = content.replace(/\${JSON\.stringify\(baseUrl\)}/g, JSON.stringify(baseUrl));
          content = content.replace(/\${JSON\.stringify\(ua\)}/g, JSON.stringify(ua));
          content = content.replace(/\${baseUrl}/g, baseUrl);
          content = content.replace(/\${ua}/g, ua);

          // 3. Resolve any escaped backticks inside the JSON definition
          content = content.replace(/\\`/g, '`');

          return content;
        }
      })
      
      console.log(`[TemplateService] Registered template: ${def.name}`)
    } catch (err) {
      console.error(`[TemplateService] Failed to register template ${def.name}:`, err)
    }
  }

  getTemplate(id: string): ScrapingTemplate | undefined {
    return this.templates.get(id)
  }

  getAllTemplates(): ScrapingTemplate[] {
    return Array.from(this.templates.values())
  }
}

export const templateService = TemplateService.getInstance()
