export interface Extension {
  pkg: string
  name: string
  lang: string
  icon: string
  baseUrl: string
  version: string
  nsfw?: boolean
  repoUrl?: string
  code?: string
}
