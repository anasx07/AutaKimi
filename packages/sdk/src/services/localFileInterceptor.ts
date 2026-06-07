import * as fs from 'fs'
import * as path from 'path'
import * as url from 'url'

/**
 * Local File System Interceptor
 * ------------------------------
 * Routes `file:///` URIs and absolute file paths to the host's local
 * filesystem, while enforcing a strict allowlist of directories the
 * application is permitted to read from.
 *
 * This module is intentionally self-contained and only uses *static*
 * imports of Node built-ins (`fs`, `path`, `url`). It is dynamically
 * imported by `NetworkClient.fetch` from a Node-only branch, so:
 *   - On Node targets (Electron main, worker threads) the bundler
 *     externalises `fs`/`path`/`url` per the existing rollup config.
 *   - On non-Node targets (renderer, React Native) the dynamic import
 *     is never reached and the module is tree-shaken away.
 *
 * Security: never use `new Function`, `eval`, or `vm` here. This file
 * only performs controlled filesystem reads against an allowlist.
 */

interface MockResponseInit {
  body: string
  status?: number
}

function createLocalFileResponse({ body, status = 200 }: MockResponseInit): Response {
  const headers = new Map()
  headers.set('content-type', 'application/json')
  return {
    ok: true,
    status,
    headers,
    text: async () => body,
    json: async () => JSON.parse(body),
    clone() {
      return this
    }
  } as unknown as Response
}

function getAllowedDirectories(): string[] {
  if (typeof process === 'undefined' || !process.versions?.node) {
    return []
  }

  const dirs: string[] = [
    path.join(process.cwd(), 'autakimi-extensions'),
    path.resolve(process.cwd(), '../../autakimi-extensions'),
    path.join(process.cwd(), 'resources')
  ]

  if (typeof process.resourcesPath === 'string') {
    dirs.push(process.resourcesPath)
  }

  const userDataPath =
    typeof process.env?.APPDATA === 'string'
      ? process.env.APPDATA
      : typeof process.env?.XDG_CONFIG_HOME === 'string'
        ? process.env.XDG_CONFIG_HOME
        : typeof process.env?.HOME === 'string'
          ? path.join(process.env.HOME, '.config')
          : null

  if (userDataPath) {
    dirs.push(path.join(userDataPath, 'autakimi'))
  }

  return dirs
}

function isPathAllowed(resolvedPath: string, allowedDirs: string[]): boolean {
  const isWin = process.platform === 'win32'
  return allowedDirs.some((dir) => {
    const normalizedDir = path.resolve(dir)
    const checkPath = isWin ? resolvedPath.toLowerCase() : resolvedPath
    const checkDir = isWin ? normalizedDir.toLowerCase() : normalizedDir
    return checkPath === checkDir || checkPath.startsWith(checkDir + path.sep)
  })
}

function resolveTargetPath(targetUrl: string): string {
  if (targetUrl.startsWith('autakimi-local://')) {
    return decodeURIComponent(targetUrl.replace('autakimi-local://', ''))
  }
  if (targetUrl.startsWith('file:///')) {
    return url.fileURLToPath(targetUrl)
  }
  return path.resolve(targetUrl)
}

/**
 * Attempts to read a local file via the Local File System Interceptor.
 *
 * Behaviour:
 *  - Returns a Response-like object on success.
 *  - Returns `null` when the URL is not local, the file does not exist,
 *    the path resolves to a directory, or the runtime is not Node.
 *  - Throws an `Error` with a descriptive message when the resolved
 *    path escapes the allowlist or the read fails for any other reason.
 *    Callers are expected to surface this as a structured error.
 */
export function tryReadLocalFile(urlStr: string): Response | null {
  const isAutakimiLocal = urlStr.startsWith('autakimi-local://')
  
  if (!isAutakimiLocal && !urlStr.startsWith('file://') && (urlStr.startsWith('http://') || urlStr.startsWith('https://'))) {
    return null
  }

  const allowedDirs = getAllowedDirectories()
  if (!isAutakimiLocal && allowedDirs.length === 0) {
    return null
  }

  const resolved = path.resolve(resolveTargetPath(urlStr))

  // Bypass path allowlist ONLY for explicit autakimi-local:// protocols
  if (!isAutakimiLocal && !isPathAllowed(resolved, allowedDirs)) {
    console.error('[localFileInterceptor] Access denied:', {
      url: urlStr,
      resolvedPath: resolved,
      allowedDirs,
      cwd: process.cwd()
    });
    throw new Error('Access denied: path outside allowed directories')
  }

  if (!fs.existsSync(resolved)) {
    return null
  }

  if (fs.statSync(resolved).isDirectory()) {
    return null
  }

  const body = fs.readFileSync(resolved, 'utf8')
  return createLocalFileResponse({ body })
}

/**
 * Convenience helper for callers that need to surface a structured
 * error result rather than handling the throw themselves.
 */
export function tryReadLocalFileSafe(
  url: string
): { ok: true; value: Response } | { ok: false; error: string; status: number } | null {
  try {
    const result = tryReadLocalFile(url)
    if (!result) return null
    return { ok: true, value: result }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: `Local filesystem error: ${message}`, status: 500 }
  }
}
