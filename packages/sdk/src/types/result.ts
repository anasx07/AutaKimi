export type Result<T, E = string> =
  | { ok: true; value: T; error?: undefined; status?: number }
  | { ok: false; error: E; value?: undefined; status?: number }
