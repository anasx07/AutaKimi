export interface Extension {
  name: string
  pkg: string
  version: string
  lang: string
  icon?: string
  nsfw?: boolean
  hasReadme?: boolean
  hasChangelog?: boolean
}

export interface RepoResponse {
  extensions?: Extension[]
  error?: string
}
