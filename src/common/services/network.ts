/**
 * Unified Result type for robust error handling
 */
export type Result<T, E = string> = 
  | { ok: true; value: T }
  | { ok: false; error: E; status?: number };

/**
 * Shared Network Utilities for both Main and Renderer processes.
 */
export const NetworkService = {
  /**
   * Robust Fetch with Exponential Backoff retry logic.
   */
  fetchWithRetry: async (
    url: string, 
    init?: any, 
    attempts = 3, 
    delay = 1000,
    fetchFn: any = fetch
  ): Promise<any> => {
    return NetworkService.executeWithRetry(
      () => fetchFn(url, init),
      (res) => !res.ok && (res.status >= 500 || res.status === 429),
      attempts,
      delay
    );
  },

  /**
   * Generic retry logic for any async function returning a Result-like object
   */
  executeWithRetry: async <T>(
    fn: () => Promise<T>,
    shouldRetry: (res: any) => boolean,
    attempts = 3,
    delay = 1000
  ): Promise<T> => {
    let lastResult: T;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        lastResult = await fn();
        if (!shouldRetry(lastResult)) {
          return lastResult;
        }
      } catch (error: any) {
        if (attempt === attempts) throw error;
        lastResult = { ok: false, error: error.message } as any;
      }

      if (attempt < attempts) {
        const wait = delay * Math.pow(2, attempt - 1);
        console.warn(`[Network] Attempt ${attempt} failed, retrying in ${wait}ms...`);
        await new Promise(resolve => setTimeout(resolve, wait));
      }
    }
    return lastResult!;
  }
};
