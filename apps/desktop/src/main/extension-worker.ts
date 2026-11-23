import { parentPort } from 'worker_threads'
import vm from 'vm'
import crypto from 'crypto'
import * as cheerio from 'cheerio'
import { networkClient } from '@common'
import { NetworkConfig } from '@common/config/network'
import {
  isPrivateOrLoopbackHost,
  getDomainBaseName
} from './utils/cacheProtocol'

const ALLOWED_STREAMING_DOMAINS = [
  'vidmoly.to', 'vidmoly.me', 'vidmoly.net', 'vidmoly.org',
  'lulustream.com', 'morencius.net', 'morencius.com',
  'voe.sx', 'voe.to', 'voe-network.net',
  'streamruby.com', 'earnvids.com',
  'vidara.org', 'firestream.net',
  'mixdrop.co', 'mixdrop.to', 'mixdrop.sx', 'mixdrop.ch', 'mixdrop.bz', 'mixdrop.ag',
  'mega.nz', 'uqload.com', 'uqload.to', 'uqload.io', 'uqload.vc',
  'sibnet.ru', 'mp4upload.com', 'sendvid.com',
  'google.com', 'ok.ru', 'vk.com', 'vkvideo.ru',
  'videa.hu', 'videas.hu', 'yonaplay.net', '4shared.com', 'hgcloud.to',
  'mediafire.com', 'workupload.com', 'gofile.io',
  'dood.to', 'dood.watch', 'dood.so', 'dood.pm', 'dood.wf', 'dood.cx', 'dood.sh', 'doodstream.com',
  'filelions.to', 'filelions.site', 'filelions.live',
  'streamtape.com', 'streamtape.to', 'streamtape.net',
  'upstream.to',
  'streamwish.to', 'streamwish.com',
  'wp.com', 'googleusercontent.com'
]

/**
 * Worker thread script for executing extension code in an isolated VM.
 * This worker is persistent and processes jobs via IPC messages.
 *
 * Caching & Performance optimizations:
 *  - Bootstrap runtime script (URL, URLSearchParams, SafeBuffer, etc.) is compiled ONCE per worker.
 *  - vm.Context is reused per extension package (pkg) to prevent re-allocation overhead
 *    while ensuring complete memory isolation across distinct extensions.
 *  - Compiled vm.Script for each extension is cached by SHA-256 hash to eliminate
 *    repeated V8 compilation overhead across requests.
 */
if (!parentPort) {
  throw new Error('This file must be run inside a Worker thread.')
}

// Tracks in-flight delegated fetches: fetchId → resolver
const pendingFetches = new Map<
  string,
  (res: {
    ok: boolean
    status: number
    text: () => Promise<string>
    json: () => Promise<unknown>
  }) => void
>()

function makeSafeFn<T extends (...args: any[]) => any>(fn: T): T {
  Object.setPrototypeOf(fn, null)
  Object.defineProperty(fn, 'constructor', { value: undefined, writable: false, configurable: false })
  return fn
}

// ─── Module-scoped static bridge functions (allocated once) ─────────────────
const rawConsoleLog = makeSafeFn((...args: unknown[]) => console.log('[Worker-VM]:', ...args))
const rawConsoleError = makeSafeFn((...args: unknown[]) => console.error('[Worker-VM Error]:', ...args))
const rawCheerioLoad = makeSafeFn((html: string) => cheerio.load(html))

const rawParseUrl = makeSafeFn((url: string, base?: string) => {
  try {
    const parsed = new URL(url, base)
    return {
      href: parsed.href,
      origin: parsed.origin,
      protocol: parsed.protocol,
      host: parsed.host,
      hostname: parsed.hostname,
      port: parsed.port,
      pathname: parsed.pathname,
      search: parsed.search,
      hash: parsed.hash
    }
  } catch (e: any) {
    return { error: e.message }
  }
})

const rawAtob = makeSafeFn((str: string) => Buffer.from(String(str), 'base64').toString('binary'))
const rawBtoa = makeSafeFn((str: string) => Buffer.from(String(str), 'binary').toString('base64'))
const rawStringToUtf8Bytes = makeSafeFn((str: string) => Array.from(Buffer.from(String(str), 'utf8')))
const rawUtf8BytesToString = makeSafeFn((bytes: number[]) => Buffer.from(bytes).toString('utf8'))

// ─── Bootstrap Runtime (compiled once per worker thread) ────────────────────
const BOOTSTRAP_CODE = `
  var safeCheerio = {
    load: function(html) {
      return __rawCheerioLoad(html);
    }
  };
  var safeRequire = function(moduleName) {
    if (moduleName === 'cheerio') {
      return safeCheerio;
    }
    throw new Error('Dynamic require of "' + moduleName + '" is not supported');
  };
  globalThis.require = safeRequire;
  globalThis.cheerio = safeCheerio;

  var safeConsole = {
    log: function(...args) {
      __rawConsoleLog(...args);
    },
    error: function(...args) {
      __rawConsoleError(...args);
    }
  };
  globalThis.console = safeConsole;

  var atob = function(str) { return __rawAtob(String(str)); };
  var btoa = function(str) { return __rawBtoa(String(str)); };
  globalThis.atob = atob;
  globalThis.btoa = btoa;

  class URLSearchParams {
    constructor(init) {
      this._map = new Map();
      if (typeof init === 'string') {
        var s = init.startsWith('?') ? init.slice(1) : init;
        if (s) {
          var pairs = s.split('&');
          for (var i = 0; i < pairs.length; i++) {
            var pair = pairs[i].split('=');
            var k = decodeURIComponent(pair[0] || '');
            var v = decodeURIComponent(pair[1] || '');
            this.append(k, v);
          }
        }
      } else if (init && typeof init === 'object') {
        var keys = Object.keys(init);
        for (var i = 0; i < keys.length; i++) {
          this.append(keys[i], String(init[keys[i]]));
        }
      }
    }
    append(key, value) {
      var arr = this._map.get(key) || [];
      arr.push(String(value));
      this._map.set(key, arr);
    }
    get(key) {
      var arr = this._map.get(key);
      return arr && arr.length > 0 ? arr[0] : null;
    }
    getAll(key) {
      return this._map.get(key) || [];
    }
    has(key) {
      return this._map.has(key);
    }
    set(key, value) {
      this._map.set(key, [String(value)]);
    }
    delete(key) {
      this._map.delete(key);
    }
    toString() {
      var parts = [];
      this._map.forEach(function(vals, k) {
        vals.forEach(function(v) {
          parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
        });
      });
      return parts.join('&');
    }
  }
  globalThis.URLSearchParams = URLSearchParams;

  class URL {
    constructor(url, base) {
      var res = __rawParseUrl(String(url), base ? String(base) : undefined);
      if (res.error) throw new TypeError(res.error);
      this.href = res.href;
      this.origin = res.origin;
      this.protocol = res.protocol;
      this.host = res.host;
      this.hostname = res.hostname;
      this.port = res.port;
      this.pathname = res.pathname;
      this.search = res.search;
      this.hash = res.hash;
      this.searchParams = new URLSearchParams(res.search);
    }
    toString() { return this.href; }
    toJSON() { return this.href; }
  }
  globalThis.URL = URL;

  class SafeBuffer extends Uint8Array {
    constructor(arg, encodingOrOffset, length) {
      if (typeof arg === 'number') {
        super(arg);
      } else if (typeof arg === 'string') {
        var enc = (encodingOrOffset || 'utf8').toLowerCase();
        if (enc === 'base64') {
          var bin = __rawAtob(arg);
          super(bin.length);
          for (var i = 0; i < bin.length; i++) this[i] = bin.charCodeAt(i);
        } else if (enc === 'hex') {
          var len = Math.floor(arg.length / 2);
          super(len);
          for (var i = 0; i < len; i++) this[i] = parseInt(arg.substr(i * 2, 2), 16);
        } else {
          var bin = __rawStringToUtf8Bytes(arg);
          super(bin.length);
          for (var i = 0; i < bin.length; i++) this[i] = bin[i];
        }
      } else if (Array.isArray(arg) || arg instanceof Uint8Array) {
        super(arg);
      } else {
        super();
      }
    }

    toString(encoding) {
      var enc = (encoding || 'utf8').toLowerCase();
      if (enc === 'base64') {
        var bin = '';
        for (var i = 0; i < this.length; i++) bin += String.fromCharCode(this[i]);
        return __rawBtoa(bin);
      }
      if (enc === 'hex') {
        var hex = '';
        for (var i = 0; i < this.length; i++) hex += (this[i] < 16 ? '0' : '') + this[i].toString(16);
        return hex;
      }
      if (enc === 'binary' || enc === 'latin1') {
        var str = '';
        for (var i = 0; i < this.length; i++) str += String.fromCharCode(this[i]);
        return str;
      }
      return __rawUtf8BytesToString(Array.from(this));
    }
  }

  SafeBuffer.from = function(arg, encodingOrOffset, length) {
    return new SafeBuffer(arg, encodingOrOffset, length);
  };
  SafeBuffer.isBuffer = function(obj) {
    return obj instanceof Uint8Array || (obj && obj._isBuffer === true);
  };
  SafeBuffer.alloc = function(size, fill, encoding) {
    var b = new SafeBuffer(size);
    if (fill !== undefined) b.fill(fill);
    return b;
  };
  SafeBuffer.allocUnsafe = function(size) {
    return new SafeBuffer(size);
  };
  SafeBuffer.byteLength = function(string, encoding) {
    return new SafeBuffer(string, encoding).length;
  };
  SafeBuffer.concat = function(list, totalLength) {
    if (!Array.isArray(list)) return new SafeBuffer(0);
    var tot = typeof totalLength === 'number' ? totalLength : list.reduce(function(acc, b) { return acc + (b.length || 0); }, 0);
    var out = new SafeBuffer(tot);
    var offset = 0;
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      out.set(item, offset);
      offset += item.length;
      if (offset >= tot) break;
    }
    return out;
  };

  globalThis.Buffer = SafeBuffer;

  // Protect prototype access without breaking method overrides in libraries (e.g. Cheerio)
  Object.preventExtensions(Object.prototype);
  Object.preventExtensions(Function.prototype);
`

const BOOTSTRAP_SCRIPT = new vm.Script(BOOTSTRAP_CODE, { filename: 'bootstrap-runtime.js' })

// ─── LRU Caches for vm.Context and compiled vm.Script ───────────────────────
const MAX_CONTEXTS = 25
const contextCache = new Map<string, vm.Context>()

function getOrCreateContext(pkg: string): vm.Context {
  if (!pkg) {
    const sandbox: Record<string, unknown> = {
      __rawConsoleLog: rawConsoleLog,
      __rawConsoleError: rawConsoleError,
      __rawCheerioLoad: rawCheerioLoad,
      __rawParseUrl: rawParseUrl,
      __rawAtob: rawAtob,
      __rawBtoa: rawBtoa,
      __rawStringToUtf8Bytes: rawStringToUtf8Bytes,
      __rawUtf8BytesToString: rawUtf8BytesToString
    }
    const context = vm.createContext(sandbox)
    BOOTSTRAP_SCRIPT.runInContext(context)
    return context
  }

  const existing = contextCache.get(pkg)
  if (existing) {
    contextCache.delete(pkg)
    contextCache.set(pkg, existing)
    return existing
  }

  const sandbox: Record<string, unknown> = {
    __rawConsoleLog: rawConsoleLog,
    __rawConsoleError: rawConsoleError,
    __rawCheerioLoad: rawCheerioLoad,
    __rawParseUrl: rawParseUrl,
    __rawAtob: rawAtob,
    __rawBtoa: rawBtoa,
    __rawStringToUtf8Bytes: rawStringToUtf8Bytes,
    __rawUtf8BytesToString: rawUtf8BytesToString
  }
  const context = vm.createContext(sandbox)
  BOOTSTRAP_SCRIPT.runInContext(context)

  if (contextCache.size >= MAX_CONTEXTS) {
    const oldestKey = contextCache.keys().next().value
    if (oldestKey) contextCache.delete(oldestKey)
  }

  contextCache.set(pkg, context)
  return context
}

interface CachedScript {
  script: vm.Script
  hash: string
}

const MAX_SCRIPTS = 50
const scriptCache = new Map<string, CachedScript>()

function getOrCompileScript(pkg: string, code: string): vm.Script {
  const hash = crypto.createHash('sha256').update(code).digest('hex')
  const cacheKey = pkg || hash

  const cached = scriptCache.get(cacheKey)
  if (cached) {
    if (cached.hash === hash) {
      scriptCache.delete(cacheKey)
      scriptCache.set(cacheKey, cached)
      return cached.script
    } else {
      // Code changed for this package: invalidate both cached script and cached context
      scriptCache.delete(cacheKey)
      if (pkg) {
        contextCache.delete(pkg)
      }
    }
  }

  const wrappedCode = `(async function __extensionRunner(params, fetch, cheerio, console, Buffer, atob, btoa, URL, URLSearchParams, require) {\n${code}\n})`
  const script = new vm.Script(wrappedCode, {
    filename: `extension-${pkg || 'anon'}.js`,
    lineOffset: -1
  })

  if (scriptCache.size >= MAX_SCRIPTS) {
    const oldestKey = scriptCache.keys().next().value
    if (oldestKey) scriptCache.delete(oldestKey)
  }

  scriptCache.set(cacheKey, { script, hash })
  return script
}

// ─── Per-Request Fetch Builder ──────────────────────────────────────────────
function createRawFetch(params: Record<string, any>, taskSignal: AbortSignal) {
  return makeSafeFn(async (url: string, init?: RequestInit) => {
    // ── Security: strictly require valid HTTP or HTTPS protocol ──────────
    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      throw new Error(`Security Exception: invalid URL: ${url}`)
    }
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new Error(`Security Exception: only HTTP and HTTPS protocols are allowed: ${url}`)
    }

    const reqHost = parsedUrl.hostname.toLowerCase()

    // ── Security: SSRF / Local network access protection ─────────────────
    if (isPrivateOrLoopbackHost(reqHost)) {
      throw new Error(
        `Security Exception: Access to private or loopback network address is forbidden (${reqHost})`
      )
    }

    // ── Combine user-provided signal (if any) with the task timeout signal ──
    let signal: AbortSignal = taskSignal
    if (init && init.signal) {
      const userSignal = init.signal as AbortSignal
      if (typeof AbortSignal.any === 'function') {
        signal = AbortSignal.any([userSignal, taskSignal])
      } else {
        const combined = new AbortController()
        if (userSignal.aborted) combined.abort(userSignal.reason)
        else if (taskSignal.aborted) combined.abort(taskSignal.reason)
        else {
          userSignal.addEventListener('abort', () => combined.abort(userSignal.reason), { once: true })
          taskSignal.addEventListener('abort', () => combined.abort(taskSignal.reason), { once: true })
        }
        signal = combined.signal
      }
    }

    if (signal.aborted) {
      throw signal.reason || new Error('Fetch aborted')
    }

    // ── Security: restrict to the extension's registered domain (safe against multi-part TLDs) ──
    const baseUrl = params._baseUrl as string | undefined
    if (baseUrl) {
      let allowedParsed: URL
      try {
        allowedParsed = new URL(baseUrl)
      } catch {
        throw new Error(`Security Exception: invalid baseUrl: ${baseUrl}`)
      }

      const allowedHost = allowedParsed.hostname.toLowerCase().replace(/^www\./, '')

      // Exact match or true subdomain (e.g. cdn.domain.co.uk for domain.co.uk)
      let isMatch = reqHost === allowedHost || reqHost.endsWith('.' + allowedHost)

      // Also allow common mirror / alternative TLDs for the same site (e.g. ristoanime.cc vs ristoanime.com)
      if (!isMatch) {
        const reqBaseName = getDomainBaseName(reqHost)
        const allowedBaseName = getDomainBaseName(allowedHost)
        if (
          reqBaseName &&
          allowedBaseName &&
          reqBaseName.length > 2 &&
          allowedBaseName.length > 2 &&
          reqBaseName === allowedBaseName
        ) {
          isMatch = true
        }
      }

      // Allow common media / streaming delivery and video host domains
      if (!isMatch) {
        isMatch = ALLOWED_STREAMING_DOMAINS.some(
          (d) => reqHost === d || reqHost.endsWith('.' + d)
        )
      }

      if (!isMatch) {
        throw new Error(
          `Security Exception: fetch "${reqHost}" not allowed for extension registered to "${allowedHost}"`
        )
      }
    }

    const bypassCf = params._bypassCloudflare as boolean
    const cfCookies = params._cfCookies as string | undefined

    const delegateToMain = (): Promise<{
      ok: boolean
      status: number
      text: () => Promise<string>
      json: () => Promise<unknown>
    }> => {
      if (signal.aborted) {
        return Promise.reject(signal.reason || new Error('Fetch aborted'))
      }

      const fetchId = Math.random().toString(36).slice(2)
      console.log(`[Worker-VM] Delegating fetch to main (CF bypass fallback): ${url}`)
      return new Promise<{
        ok: boolean
        status: number
        text: () => Promise<string>
        json: () => Promise<unknown>
      }>((resolve, reject) => {
        const onAbort = () => {
          pendingFetches.delete(fetchId)
          reject(signal.reason || new Error('Fetch aborted'))
        }
        signal.addEventListener('abort', onAbort, { once: true })

        pendingFetches.set(fetchId, (res) => {
          signal.removeEventListener('abort', onAbort)
          resolve(res)
        })

        // Sanitize init to ensure it's serializable
        const sanitizedInit: any = { ...init }
        if (init && init.headers) {
          sanitizedInit.headers = JSON.parse(JSON.stringify(init.headers))
        }

        parentPort!.postMessage({ type: 'WORKER_FETCH', fetchId, url, init: sanitizedInit })
      })
    }

    // ── Strategy 1 (Fast-Path): direct fetch with injected CF cookies ─────────────
    const extraHeaders: Record<string, string> = {
      'User-Agent': (params._userAgent as string) || NetworkConfig.DEFAULT_UA,
      ...((init as any)?.headers || {})
    }
    if (cfCookies) {
      extraHeaders['Cookie'] = cfCookies
      console.log(`[Worker-VM] Fast-path fetch with injected CF cookies: ${url}`)
    } else {
      console.log(`[Worker-VM] Fast-path fetch (no CF cookies): ${url}`)
    }

    try {
      const res = await networkClient.fetch(url, {
        ...init,
        signal,
        headers: extraHeaders,
        attempts: 1,
        delay: 500
      })

      if (!res.ok) {
        if (bypassCf && (res.status === 403 || res.status === 503)) {
          if (signal.aborted) throw signal.reason || new Error('Fetch aborted')
          console.warn(`[Worker-VM] Fast-path received HTTP ${res.status}. Falling back to main process solver: ${url}`)
          return await delegateToMain()
        }
        throw new Error(res.error)
      }

      const response = res.value
      if (bypassCf && (response.status === 403 || response.status === 503)) {
        if (signal.aborted) throw signal.reason || new Error('Fetch aborted')
        console.warn(`[Worker-VM] Fast-path response is HTTP ${response.status}. Falling back to main process solver: ${url}`)
        return await delegateToMain()
      }

      const body = await response.text()
      const lowerBody = body.toLowerCase()
      const isAntiBotChallenge =
        body.includes('challenges.cloudflare.com') ||
        body.includes('cf-browser-verification') ||
        lowerBody.includes('just a moment') ||
        lowerBody.includes('one moment') ||
        lowerBody.includes('attention required') ||
        lowerBody.includes('verifying you are human') ||
        lowerBody.includes('cf-turnstile') ||
        lowerBody.includes('checking your browser') ||
        body.includes('لحظة واحدة من فضلك') ||
        body.includes('التحقق من أنك إنسان') ||
        body.includes('جاري التحقق') ||
        body.includes('يرجى الانتظار')

      if (isAntiBotChallenge) {
        if (signal.aborted) throw signal.reason || new Error('Fetch aborted')
        console.warn(`[Worker-VM] Anti-bot challenge detected in body. Falling back to main process solver: ${url}`)
        return await delegateToMain()
      }

      console.log(
        `[Worker-VM] Response: status=${response.status} bodyLen=${body.length} url=${url}`
      )
      return {
        ok: response.ok,
        status: response.status,
        text: async () => body,
        json: async () => JSON.parse(body)
      }
    } catch (e: unknown) {
      if (signal.aborted) {
        throw signal.reason || e
      }
      if (bypassCf) {
        console.warn(`[Worker-VM] Fast-path fetch error for ${url}. Falling back to main process solver:`, e)
        return await delegateToMain()
      }
      console.error(`[Worker-VM] Fetch error for ${url}:`, e)
      throw e
    }
  })
}

// ─── Main task handler ────────────────────────────────────────────────────────
parentPort.on(
  'message',
  async (message: { id: string; code: string; params: Record<string, any>; pkg?: string; type?: string }) => {
    // Skip non-task messages (e.g. FETCH_REPLY) — handled by the second listener
    if (message.type) return

    const { id, code, params, pkg } = message

    // Validate that code is a plain string before doing anything with it
    if (typeof code !== 'string') {
      parentPort!.postMessage({ id, error: 'Invalid extension code: expected a string.' })
      return
    }

    const timeoutMs = typeof params?._timeoutMs === 'number' ? params._timeoutMs : 25000
    const abortController = new AbortController()
    let timeoutId: NodeJS.Timeout | undefined

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        abortController.abort(new Error(`Extension execution timed out after ${timeoutMs}ms`))
        reject(new Error(`Extension execution timed out after ${timeoutMs}ms`))
      }, timeoutMs)
    })

    try {
      const packageKey = pkg || ''
      const context = getOrCreateContext(packageKey)
      const script = getOrCompileScript(packageKey, code)

      const rawFetch = createRawFetch(params, abortController.signal)
      const safeParams = JSON.parse(JSON.stringify(params))

      ;(context as any).fetch = rawFetch

      try {
        const runnerFn = script.runInContext(context, { timeout: timeoutMs })
        const executionPromise = Promise.resolve().then(() =>
          runnerFn(
            safeParams,
            rawFetch,
            (context as any).cheerio,
            (context as any).console,
            (context as any).Buffer,
            (context as any).atob,
            (context as any).btoa,
            (context as any).URL,
            (context as any).URLSearchParams,
            (context as any).require
          )
        )

        const result = await Promise.race([executionPromise, timeoutPromise])

        console.log(
          `[Worker-VM] Extension success for ${id}: items=${result?.data?.length ?? 'N/A'}`
        )
        parentPort!.postMessage({ id, result })
      } finally {
        if (timeoutId) clearTimeout(timeoutId)
        delete (context as any).fetch
      }
    } catch (error: unknown) {
      if (timeoutId) clearTimeout(timeoutId)
      abortController.abort()
      const msg = error instanceof Error ? error.message : String(error)
      console.error(`[Worker-VM] Extension error for ${id}: ${msg}`)
      parentPort!.postMessage({ id, error: msg })
    }
  }
)

// ─── FETCH_REPLY handler ──────────────────────────────────────────────────────
// Receives serializable data from the main process and reconstructs
// a response-like object with working text()/json() methods.
parentPort.on(
  'message',
  (msg: { type?: string; fetchId?: string; body?: string; ok?: boolean; status?: number }) => {
    if (msg.type === 'FETCH_REPLY' && msg.fetchId) {
      const resolver = pendingFetches.get(msg.fetchId)
      if (resolver) {
        pendingFetches.delete(msg.fetchId)
        const body = msg.body ?? ''
        resolver({
          ok: msg.ok ?? false,
          status: msg.status ?? 500,
          text: async () => body,
          json: async () => JSON.parse(body)
        })
      }
    }
  }
)
