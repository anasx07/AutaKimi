import { networkClient } from './network'

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
      const res = await this.fetchTemplates(url)
      if (res.success) totalCount += res.count
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
      
      const data = await res.value.json()
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
      // Create a dynamic function from the generator string
      // The string should look like: "return `const baseUrl = ${JSON.stringify(baseUrl)}; ...`"
      const generatorFn = new Function('baseUrl', 'ua', def.generator)
      
      this.templates.set(def.id, {
        id: def.id,
        name: def.name,
        generate: (baseUrl: string, ua: string) => generatorFn(baseUrl, ua)
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
