export interface Extension {
  pkg: string;
  name: string;
  lang: string;
  icon: string;
  baseUrl: string;
  version: string;
  nsfw?: boolean;
  repoUrl?: string;
  repoName?: string;
  repoColor?: string;
  catalogKey?: string;
  isKeiyoushi?: boolean;
  code?: string;
  status?: string;
  isFullySupported?: boolean;
}
