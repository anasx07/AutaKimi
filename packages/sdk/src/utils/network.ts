/**
 * Network utilities for generating stealthy browser fingerprints.
 * Design to be platform-agnostic, with userAgent injectable.
 */
export const NetworkUtils = {
  /**
   * Generates a set of modern browser headers.
   * @param baseUrl The base URL of the source
   * @param userAgent Optional User-Agent to override default
   */
  getStealthHeaders: (baseUrl: string, userAgent?: string) => {
    let referer = baseUrl
    
    try {
      const url = new URL(baseUrl)
      referer = url.origin + '/'
    } catch (e) {
      // Ignore invalid URLs
    }

    return {
      'User-Agent': userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'),
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'en-US,en;q=0.9',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
      'Referer': referer,
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Connection': 'keep-alive'
    }
  }
}
