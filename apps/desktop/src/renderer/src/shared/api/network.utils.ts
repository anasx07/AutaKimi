/**
 * Network utilities for generating stealthy browser fingerprints.
 * These headers are designed to match a real Chrome/Electron session to avoid Cloudflare detection.
 */
export const NetworkUtils = {
  /**
   * Generates a set of modern browser headers that match the current Electron environment.
   * Includes Sec-Fetch metadata which is critical for Cloudflare V2/V3.
   */
  getStealthHeaders: (baseUrl: string) => {
    let referer = baseUrl
    
    try {
      const url = new URL(baseUrl)
      referer = url.origin + '/'
    } catch (e) {
      // Ignore invalid URLs
    }

    return {
      'User-Agent': navigator.userAgent,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'en-US,en;q=0.9',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none', // Initial request identity
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
      'Referer': referer,
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Connection': 'keep-alive'
    }
  }
}
