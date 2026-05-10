export interface FetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  headers?: Record<string, string>
  body?: string | FormData | URLSearchParams
  bypassCf?: boolean
  silent?: boolean
  attempts?: number
  delay?: number
  page?: number
  [key: string]: any // Allow for extra dynamic args used by some sources
}

export interface FetchResult {
  data: string
  status: number
  ok: boolean
}
