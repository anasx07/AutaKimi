export interface FetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  headers?: Record<string, string>
  body?: string | FormData | URLSearchParams
  bypassCf?: boolean
  silent?: boolean
  attempts?: number
  delay?: number
  page?: number
  offset?: number
  limit?: number
  activeFeed?: string
  debouncedSearch?: string
}

export interface FetchResult {
  data: string
  status: number
  ok: boolean
}
