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

export interface SystemState {
  activeDownloads: Record<string, ActiveTaskState>
  // Add more background state categories here as the app grows
  // updates: AppUpdateState
  // extensions: ExtensionLoadingState
}

export type StateUpdateEvent = {
  type: 'active_tasks_update'
  task: ActiveTaskState
} | {
  type: 'full_state_update'
  state: SystemState
}
