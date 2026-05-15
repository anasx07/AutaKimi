export interface ActiveTaskState {
  mangaId: string
  chapterId: string
  status: 'downloading' | 'completed' | 'error' | 'paused' | 'canceled'
  cached: number
  total: number
  error?: string
  mangaTitle?: string
  chapterTitle?: string
  type: 'manga' | 'anime'
}

export interface CloudflareBypassState {
  domain: string
  baseUrl: string
  resolvedAt: number
  lastUsedAt: number
  status: 'active' | 'expiring' | 'resolved'
}

export interface SystemState {
  activeDownloads: Record<string, ActiveTaskState>
  cloudflareBypasses: Record<string, CloudflareBypassState>
  activeBypass: { domain: string; url: string } | null
  // Add more background state categories here as the app grows
}


export type StateUpdateEvent = {
  type: 'active_tasks_update'
  task: ActiveTaskState
} | {
  type: 'cf_bypass_update'
  bypass: CloudflareBypassState
} | {
  type: 'full_state_update'
  state: SystemState
}
