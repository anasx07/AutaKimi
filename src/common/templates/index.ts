export interface ScrapingTemplate {
  name: string
  generate(baseUrl: string): string
}

const templates = new Map<string, ScrapingTemplate>()

export function registerTemplate(template: ScrapingTemplate) {
  templates.set(template.name, template)
}

export function getTemplate(name: string): ScrapingTemplate | undefined {
  return templates.get(name)
}

// Import and register templates
import { MadaraTemplate } from './madara'
import { MangaStreamTemplate } from './mangastream'

registerTemplate(MadaraTemplate)
registerTemplate(MangaStreamTemplate)
