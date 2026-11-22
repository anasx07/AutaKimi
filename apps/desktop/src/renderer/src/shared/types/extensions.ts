export interface Extension {
  name: string
  pkg: string
  version: string
  lang: string
  icon?: string
  nsfw?: boolean
  hasReadme?: boolean
  hasChangelog?: boolean
  status?: string
  isFullySupported?: boolean
  type?: 'manga' | 'anime'
}

export interface RepoResponse {
  extensions?: Extension[]
  error?: string
}
