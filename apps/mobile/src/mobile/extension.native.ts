import { NativeModules, Platform } from 'react-native'
import * as cheerio from 'cheerio'
import { MobileNetwork } from './network.native'
import { IpcResult } from '@common/types'

const { KeiyoushiBridge } = NativeModules

// ─── Network Security & Domain Allowlist ────────────────────────────────────

export const MULTI_PART_SECOND_LEVEL_TLDS = new Set([
  'co', 'com', 'org', 'net', 'edu', 'gov', 'mil', 'ac', 'ne', 'or'
])

export function getDomainBaseName(hostname: string): string {
  if (!hostname) return ''
  const parts = hostname.toLowerCase().split('.').filter(Boolean)
  if (parts.length < 2) return ''

  const lastPart = parts[parts.length - 1]
  const secondLastPart = parts[parts.length - 2]

  if (lastPart.length === 2 && MULTI_PART_SECOND_LEVEL_TLDS.has(secondLastPart)) {
    if (parts.length >= 3) {
      return parts[parts.length - 3].replace(/-/g, '')
    }
    return ''
  }

  return secondLastPart.replace(/-/g, '')
}

export const ALLOWED_STREAMING_DOMAINS = [
  'vidmoly.to', 'vidmoly.me', 'vidmoly.net', 'vidmoly.org',
  'lulustream.com', 'morencius.net', 'morencius.com',
  'voe.sx', 'voe.to', 'voe-network.net',
  'streamruby.com', 'earnvids.com',
  'vidara.org', 'firestream.net',
  'mixdrop.co', 'mixdrop.to', 'mixdrop.sx', 'mixdrop.ch', 'mixdrop.bz', 'mixdrop.ag',
  'mega.nz', 'uqload.com', 'uqload.to', 'uqload.io', 'uqload.vc',
  'sibnet.ru', 'mp4upload.com', 'sendvid.com',
  'google.com', 'ok.ru', 'vk.com', 'vkvideo.ru',
  'videa.hu',
  'dood.to', 'dood.watch', 'dood.so', 'dood.pm', 'dood.wf', 'dood.cx', 'dood.sh', 'doodstream.com',
  'filelions.to', 'filelions.site', 'filelions.live',
  'streamtape.com', 'streamtape.to', 'streamtape.net',
  'upstream.to',
  'streamwish.to', 'streamwish.com',
  'wp.com', 'googleusercontent.com'
]

export function isPrivateOrLoopbackHost(hostname: string): boolean {
  if (!hostname) return true
  const lc = hostname.toLowerCase().trim()

  if (lc === 'localhost' || lc === 'ip6-localhost' || lc === 'ip6-loopback') return true

  // IPv4 check: 4 dot-separated decimal numbers
  const ipv4Match = lc.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (ipv4Match) {
    const p0 = Number(ipv4Match[1])
    const p1 = Number(ipv4Match[2])
    const p2 = Number(ipv4Match[3])
    const p3 = Number(ipv4Match[4])
    if (p0 > 255 || p1 > 255 || p2 > 255 || p3 > 255) return true

    if (p0 === 0) return true
    if (p0 === 10) return true // 10.0.0.0/8
    if (p0 === 127) return true // 127.0.0.0/8
    if (p0 === 169 && p1 === 254) return true // 169.254.0.0/16
    if (p0 === 172 && p1 >= 16 && p1 <= 31) return true // 172.16.0.0/12
    if (p0 === 192 && p1 === 168) return true // 192.168.0.0/16
    if (p0 === 100 && p1 >= 64 && p1 <= 127) return true // 100.64.0.0/10
    if (p0 === 198 && (p1 === 18 || p1 === 19)) return true
    if (p0 === 255) return true
    return false
  }

  // IPv6 check
  if (lc.includes(':')) {
    if (lc === '::' || lc === '::1') return true
    if (lc.startsWith('fc') || lc.startsWith('fd')) return true // Unique local
    if (lc.startsWith('fe8') || lc.startsWith('fe9') || lc.startsWith('fea') || lc.startsWith('feb')) return true // Link local
    if (lc.startsWith('::ffff:')) {
      return isPrivateOrLoopbackHost(lc.slice(7))
    }
    return false
  }

  // Private / local domains
  if (
    lc.endsWith('.local') ||
    lc.endsWith('.internal') ||
    lc.endsWith('.lan') ||
    lc.endsWith('.localhost') ||
    lc.endsWith('.nip.io') ||
    lc.endsWith('.sslip.io') ||
    lc.endsWith('.localtest.me')
  ) {
    return true
  }

  return false
}

// ─── Base64 & String Encodings ──────────────────────────────────────────────

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='

export function btoa(input: any): string {
  const str = String(input)
  let output = ''
  for (
    let block = 0, charCode = 0, i = 0, map = B64_CHARS;
    str.charAt(i | 0) || ((map = '='), i % 1);
    output += map.charAt(63 & (block >> (8 - (i % 1) * 8)))
  ) {
    charCode = str.charCodeAt((i += 3 / 4))
    if (charCode > 0xff) {
      throw new Error("'btoa' failed: The string to be encoded contains characters outside of the Latin1 range.")
    }
    block = (block << 8) | charCode
  }
  return output
}

export function atob(input: any): string {
  const str = String(input).replace(/[=]+$/, '')
  if (str.length % 4 === 1) {
    throw new Error("'atob' failed: The string to be decoded is not correctly encoded.")
  }
  let output = ''
  for (
    let bc = 0, bs = 0, buffer = 0, idx = 0;
    (buffer = str.charCodeAt(idx++));
    ~buffer && ((bs = bc % 4 ? bs * 64 + buffer : buffer), bc++ % 4)
      ? (output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6))))
      : 0
  ) {
    buffer = B64_CHARS.indexOf(String.fromCharCode(buffer))
  }
  return output
}

function stringToUtf8Bytes(str: string): Uint8Array {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(str)
  }
  const utf8: number[] = []
  for (let i = 0; i < str.length; i++) {
    let charcode = str.charCodeAt(i)
    if (charcode < 0x80) utf8.push(charcode)
    else if (charcode < 0x800) {
      utf8.push(0xc0 | (charcode >> 6), 0x80 | (charcode & 0x3f))
    } else if (charcode < 0xd800 || charcode >= 0xe000) {
      utf8.push(0xe0 | (charcode >> 12), 0x80 | ((charcode >> 6) & 0x3f), 0x80 | (charcode & 0x3f))
    } else {
      i++
      charcode = 0x10000 + (((charcode & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff))
      utf8.push(
        0xf0 | (charcode >> 18),
        0x80 | ((charcode >> 12) & 0x3f),
        0x80 | ((charcode >> 6) & 0x3f),
        0x80 | (charcode & 0x3f)
      )
    }
  }
  return new Uint8Array(utf8)
}

function utf8BytesToString(bytes: Uint8Array | number[]): string {
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder('utf-8').decode(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes))
  }
  let encoded = ''
  for (let i = 0; i < bytes.length; i++) {
    encoded += '%' + (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16)
  }
  try {
    return decodeURIComponent(encoded)
  } catch {
    let str = ''
    for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i])
    return str
  }
}

// ─── SafeBuffer Implementation ──────────────────────────────────────────────

export class SafeBuffer extends Uint8Array {
  constructor(arg: any, encodingOrOffset?: any, length?: any) {
    if (typeof arg === 'number') {
      super(arg)
    } else if (typeof arg === 'string') {
      const enc = (encodingOrOffset || 'utf8').toLowerCase()
      if (enc === 'base64') {
        const bin = atob(arg)
        super(bin.length)
        for (let i = 0; i < bin.length; i++) this[i] = bin.charCodeAt(i)
      } else if (enc === 'hex') {
        const len = Math.floor(arg.length / 2)
        super(len)
        for (let i = 0; i < len; i++) this[i] = parseInt(arg.substr(i * 2, 2), 16)
      } else {
        const bin = stringToUtf8Bytes(arg)
        super(bin.length)
        for (let i = 0; i < bin.length; i++) this[i] = bin[i]
      }
    } else if (Array.isArray(arg) || arg instanceof Uint8Array) {
      super(arg)
    } else {
      super()
    }
  }

  toString(encoding?: string): string {
    const enc = (encoding || 'utf8').toLowerCase()
    if (enc === 'base64') {
      let bin = ''
      for (let i = 0; i < this.length; i++) bin += String.fromCharCode(this[i])
      return btoa(bin)
    }
    if (enc === 'hex') {
      let hex = ''
      for (let i = 0; i < this.length; i++) hex += (this[i] < 16 ? '0' : '') + this[i].toString(16)
      return hex
    }
    if (enc === 'binary' || enc === 'latin1') {
      let str = ''
      for (let i = 0; i < this.length; i++) str += String.fromCharCode(this[i])
      return str
    }
    return utf8BytesToString(this)
  }

  static from(arg: any, encodingOrOffset?: any, length?: any): SafeBuffer {
    return new SafeBuffer(arg, encodingOrOffset, length)
  }

  static isBuffer(obj: any): boolean {
    return obj instanceof Uint8Array || (obj && obj._isBuffer === true)
  }

  static alloc(size: number, fill?: number, _encoding?: string): SafeBuffer {
    const b = new SafeBuffer(size)
    if (fill !== undefined) b.fill(fill)
    return b
  }

  static allocUnsafe(size: number): SafeBuffer {
    return new SafeBuffer(size)
  }

  static byteLength(string: string, encoding?: string): number {
    return new SafeBuffer(string, encoding).length
  }

  static concat(list: Uint8Array[], totalLength?: number): SafeBuffer {
    if (!Array.isArray(list)) return new SafeBuffer(0)
    const tot =
      typeof totalLength === 'number'
        ? totalLength
        : list.reduce((acc, b) => acc + (b.length || 0), 0)
    const out = new SafeBuffer(tot)
    let offset = 0
    for (let i = 0; i < list.length; i++) {
      const item = list[i]
      out.set(item, offset)
      offset += item.length
      if (offset >= tot) break
    }
    return out
  }
}

// ─── URL & URLSearchParams Implementation ───────────────────────────────────

export class URLSearchParams {
  private _map = new Map<string, string[]>()

  constructor(init?: any) {
    if (typeof init === 'string') {
      const s = init.startsWith('?') ? init.slice(1) : init
      if (s) {
        const pairs = s.split('&')
        for (let i = 0; i < pairs.length; i++) {
          const pair = pairs[i].split('=')
          const k = decodeURIComponent(pair[0] || '')
          const v = decodeURIComponent(pair[1] || '')
          this.append(k, v)
        }
      }
    } else if (init && typeof init === 'object') {
      const keys = Object.keys(init)
      for (let i = 0; i < keys.length; i++) {
        this.append(keys[i], String(init[keys[i]]))
      }
    }
  }

  append(key: string, value: string): void {
    const arr = this._map.get(key) || []
    arr.push(String(value))
    this._map.set(key, arr)
  }

  get(key: string): string | null {
    const arr = this._map.get(key)
    return arr && arr.length > 0 ? arr[0] : null
  }

  getAll(key: string): string[] {
    return this._map.get(key) || []
  }

  has(key: string): boolean {
    return this._map.has(key)
  }

  set(key: string, value: string): void {
    this._map.set(key, [String(value)])
  }

  delete(key: string): void {
    this._map.delete(key)
  }

  toString(): string {
    const parts: string[] = []
    this._map.forEach((vals, k) => {
      vals.forEach((v) => {
        parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(v))
      })
    })
    return parts.join('&')
  }
}

export class SafeURL {
  href: string
  origin: string
  protocol: string
  host: string
  hostname: string
  port: string
  pathname: string
  search: string
  hash: string
  searchParams: URLSearchParams

  constructor(url: any, base?: any) {
    let fullUrl = String(url)
    if (base) {
      const b = String(base)
      if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
        if (fullUrl.startsWith('//')) {
          const proto = b.startsWith('https://') ? 'https:' : 'http:'
          fullUrl = proto + fullUrl
        } else if (fullUrl.startsWith('/')) {
          const m = b.match(/^(https?:\/\/[^/]+)/)
          fullUrl = (m ? m[1] : b) + fullUrl
        } else {
          let bClean = b.replace(/\/[^/]*$/, '/')
          if (!bClean.endsWith('/')) bClean += '/'
          fullUrl = bClean + fullUrl
        }
      }
    }

    const regex = /^(https?:)\/\/(([^:/?#]+)(?::([0-9]+))?)(\/[^?#]*)?(\?[^#]*)?(#.*)?$/i
    const match = fullUrl.match(regex)
    if (!match) throw new TypeError('Invalid URL: ' + fullUrl)

    this.protocol = match[1].toLowerCase()
    this.hostname = match[3].toLowerCase()
    this.port = match[4] || ''
    this.host = match[2].toLowerCase()
    this.origin = this.protocol + '//' + this.host
    this.pathname = match[5] || '/'
    this.search = match[6] || ''
    this.hash = match[7] || ''
    this.href = this.origin + this.pathname + this.search + this.hash
    this.searchParams = new URLSearchParams(this.search)
  }

  toString(): string {
    return this.href
  }

  toJSON(): string {
    return this.href
  }
}

// ─── Mobile Extension Engine ────────────────────────────────────────────────

export const MobileExtension = {
  async loadKeiyoushiApk(apkUrl: string, className: string, pkg: string): Promise<IpcResult<any>> {
    if (Platform.OS !== 'android' || !KeiyoushiBridge) {
      return { ok: false, error: 'Keiyoushi native DEX loading is only supported on Android' }
    }
    try {
      const res = await KeiyoushiBridge.loadKeiyoushiApk(apkUrl, className, pkg)
      return { ok: true, value: res }
    } catch (e: any) {
      return { ok: false, error: e.message || String(e) }
    }
  },

  async execute(args: { pkg: string; code: string; contextArgs?: any }): Promise<IpcResult<any>> {
    const { code, contextArgs: params } = args

    const sandbox = {
      cheerio: {
        load: (html: string) => cheerio.load(html)
      },
      fetch: async (url: any, init?: { method?: string; headers?: any; body?: any }) => {
        const urlStr = typeof url === 'string' ? url : String(url)

        // 1. Strictly require HTTP or HTTPS protocol
        let parsedUrl: SafeURL
        try {
          parsedUrl = new SafeURL(urlStr)
        } catch {
          throw new Error(`Security Exception: invalid URL: ${urlStr}`)
        }
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
          throw new Error(`Security Exception: only HTTP and HTTPS protocols are allowed: ${urlStr}`)
        }

        const reqHost = parsedUrl.hostname.toLowerCase()

        // 2. SSRF / Local network access protection
        if (isPrivateOrLoopbackHost(reqHost)) {
          throw new Error(
            `Security Exception: Access to private or loopback network address is forbidden (${reqHost})`
          )
        }

        // 3. Domain allowlist check if baseUrl / params._baseUrl is provided
        const baseUrl = (params?._baseUrl || params?.baseUrl) as string | undefined
        if (baseUrl) {
          let allowedParsed: SafeURL
          try {
            allowedParsed = new SafeURL(baseUrl)
          } catch {
            throw new Error(`Security Exception: invalid baseUrl: ${baseUrl}`)
          }

          const allowedHost = allowedParsed.hostname.toLowerCase().replace(/^www\./, '')

          // Exact match or true subdomain (e.g. cdn.domain.co.uk for domain.co.uk)
          let isMatch = reqHost === allowedHost || reqHost.endsWith('.' + allowedHost)

          // Mirror / alternative TLD match
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

          // Allowed streaming & media host domains
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

        const res = await MobileNetwork.fetchText(urlStr, {
          method: (init?.method as any) || 'GET',
          headers: init?.headers,
          body: init?.body
        })

        if (!res.ok) {
          throw new Error(res.error)
        }

        const data = res.value.data
        return {
          ok: res.value.ok,
          status: res.value.status,
          text: async () => data,
          json: async () => JSON.parse(data)
        }
      },
      console: {
        log: (...args: any[]) => console.log('[Native-Sandbox]:', ...args),
        error: (...args: any[]) => console.error('[Native-Sandbox Error]:', ...args)
      },
      params: params || {}
    }

    const sanitizedCode = code ? code.replace(/\r/g, '') : ''
    console.log('[Native-Sandbox] Executing code (first 100 chars):', JSON.stringify(sanitizedCode.slice(0, 100)))
    console.log('[Native-Sandbox] Full code length:', sanitizedCode.length)

    try {
      // Hermes does NOT support the AsyncFunction constructor (await keyword is rejected
      // at parse time with "';' expected"). Instead, wrap the extension code inside an
      // async IIFE within a regular Function constructor. Hermes can parse `async function`
      // syntax in eval'd code — it just can't handle the AsyncFunction constructor itself.
      const wrappedCode = `return (async function(
  __params,
  __fetch,
  __cheerio,
  __console,
  __Buffer,
  __atob,
  __btoa,
  __URL,
  __URLSearchParams
) {
  var params = __params;
  var fetch = __fetch;
  var cheerio = __cheerio;
  var console = __console;
  var Buffer = __Buffer;
  var SafeBuffer = __Buffer;
  var atob = __atob;
  var btoa = __btoa;
  var URL = __URL;
  var URLSearchParams = __URLSearchParams;

  if (typeof globalThis !== 'undefined') {
    globalThis.Buffer = __Buffer;
    globalThis.SafeBuffer = __Buffer;
    globalThis.atob = __atob;
    globalThis.btoa = __btoa;
    globalThis.URL = __URL;
    globalThis.URLSearchParams = __URLSearchParams;
    globalThis.cheerio = __cheerio;
  }

  var require = function(m) {
    if (m === 'cheerio') return __cheerio;
    if (m === 'buffer') return { Buffer: __Buffer };
    throw new Error('Module not found in mobile sandbox: ' + m);
  };

  ${sanitizedCode}
})(__params, __fetch, __cheerio, __console, __Buffer, __atob, __btoa, __URL, __URLSearchParams);`

      const fn = new Function(
        '__params',
        '__fetch',
        '__cheerio',
        '__console',
        '__Buffer',
        '__atob',
        '__btoa',
        '__URL',
        '__URLSearchParams',
        wrappedCode
      )

      let timer: ReturnType<typeof setTimeout> | null = null
      const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`Extension execution timed out after 15000ms for ${args.pkg}`))
        }, 15000)
      })

      try {
        const executionPromise = Promise.resolve().then(() =>
          fn(
            sandbox.params,
            sandbox.fetch,
            sandbox.cheerio,
            sandbox.console,
            SafeBuffer,
            atob,
            btoa,
            SafeURL,
            URLSearchParams
          )
        )
        const result = await Promise.race([executionPromise, timeoutPromise])
        return { ok: true, value: result }
      } finally {
        if (timer) clearTimeout(timer)
      }
    } catch (err: any) {
      console.error(`[Native-Sandbox] Execution failed for ${args.pkg}:`, err)
      return { ok: false, error: err.message || String(err) }
    }
  }
}
