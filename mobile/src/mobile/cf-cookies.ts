const cfCookies: Record<string, string> = {}
let bypassResolver: ((value: string | null) => void) | null = null
let bypassUrl: string | null = null

export const CfCookieStore = {
  get(domain: string): string | null {
    return cfCookies[domain] || null
  },

  set(domain: string, cookie: string) {
    cfCookies[domain] = cookie
  },

  remove(domain: string) {
    delete cfCookies[domain]
  },

  clear() {
    Object.keys(cfCookies).forEach(k => delete cfCookies[k])
  },

  getAll(): Record<string, string> {
    return { ...cfCookies }
  }
}

export const CfBypassFlow = {
  get pendingUrl(): string | null {
    return bypassUrl
  },

  get isPending(): boolean {
    return bypassResolver !== null
  },

  start(url: string): Promise<string | null> {
    const domain = new URL(url).hostname
    return new Promise(resolve => {
      bypassResolver = resolve
      bypassUrl = url
    })
  },

  complete(cookie: string | null) {
    if (cookie && bypassUrl) {
      const domain = new URL(bypassUrl).hostname
      CfCookieStore.set(domain, cookie)
    }
    if (bypassResolver) {
      bypassResolver(cookie)
    }
    bypassResolver = null
    bypassUrl = null
  },

  cancel() {
    this.complete(null)
  }
}
