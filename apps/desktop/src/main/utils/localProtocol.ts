import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import { is } from '@electron-toolkit/utils'
import { settingsRepo } from '../db'
import { isPathInside } from './cacheProtocol'
import { readCbzEntry } from './cbz'

const ALLOWED_EXTENSIONS = new Set([
  '.json',
  '.js',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.svg',
  '.gif',
  '.cbz'
])

async function getAllowedDirectories(): Promise<string[]> {
  const allowed: string[] = []

  try {
    const userDataPath = app.getPath('userData')
    allowed.push(userDataPath)
  } catch {}

  if (is.dev) {
    allowed.push(process.cwd())
  } else if (process.resourcesPath) {
    allowed.push(path.join(process.resourcesPath, 'extensions'))
    allowed.push(path.join(process.resourcesPath, 'icons'))
  }

  try {
    const reposJson = await settingsRepo.get('source_repositories')
    if (reposJson) {
      const repos = JSON.parse(reposJson)
      if (Array.isArray(repos)) {
        for (const repo of repos) {
          if (typeof repo === 'string' && repo.toLowerCase().startsWith('autakimi-local://')) {
            let clean = repo.replace(/^autakimi-local:\/\//i, '').split('?')[0].split('#')[0]
            let resolved = path.resolve(decodeURIComponent(clean))
            if (fs.existsSync(resolved) && !fs.statSync(resolved).isDirectory()) {
              resolved = path.dirname(resolved)
            }
            allowed.push(resolved)
          }
        }
      }
    }
  } catch {}

  return allowed
}

/**
 * Native Electron Net Protocol Handler for `autakimi-local://` scheme.
 * Routes local developer extension paths and handles directory-to-manifest normalization safely.
 * Strictly sandboxed to authorized directories to prevent arbitrary filesystem access.
 */
export async function handleLocalProtocol(request: Request): Promise<Response> {
  const rawUrl = request.url

  try {
    // 1. Strip protocol prefix and decode target path
    let rawPath = rawUrl.replace(/^autakimi-local:\/\//i, '')
    // Remove query parameters or hash if present
    rawPath = rawPath.split('?')[0].split('#')[0]

    // Prevent null-byte injection and path traversal sequences
    if (rawPath.includes('\0') || rawPath.includes('..')) {
      return new Response('Forbidden: directory traversal or null byte detected', { status: 403 })
    }

    let decoded = decodeURIComponent(rawPath)
    if (process.platform === 'win32' && /^\/[a-zA-Z]:/.test(decoded)) {
      decoded = decoded.slice(1)
    }
    let resolvedPath = path.resolve(decoded)

    // 2. Validate that the resolved path is strictly inside an allowed directory
    const allowedDirs = await getAllowedDirectories()
    const isAllowed = allowedDirs.some((dir) => isPathInside(resolvedPath, dir))

    if (!isAllowed) {
      console.warn(`[autakimi-local] Blocked unauthorized path access: ${resolvedPath}`)
      return new Response('Forbidden: access outside authorized directories is prohibited', { status: 403 })
    }

    // 2.1 CBZ Archive Entry Resolution: check if targeting an entry inside a .cbz archive
    const cbzMatch = resolvedPath.match(/^(.+?\.cbz)[/\\](.+)$/i)
    if (cbzMatch) {
      const cbzPath = path.resolve(cbzMatch[1])
      const entryName = cbzMatch[2].replace(/\\/g, '/')

      if (!allowedDirs.some((dir) => isPathInside(cbzPath, dir))) {
        return new Response('Forbidden: CBZ archive is outside authorized directories', { status: 403 })
      }

      if (!fs.existsSync(cbzPath) || !fs.statSync(cbzPath).isFile()) {
        return new Response('Not Found: CBZ archive does not exist', { status: 404 })
      }

      const entryExt = path.extname(entryName).toLowerCase()
      if (!ALLOWED_EXTENSIONS.has(entryExt)) {
        return new Response('Forbidden: file extension inside CBZ not allowed', { status: 403 })
      }

      const entryBuffer = await readCbzEntry(cbzPath, entryName)
      if (!entryBuffer) {
        return new Response('Not Found: Page entry not found in CBZ archive', { status: 404 })
      }

      const mimeType =
        entryExt === '.png'
          ? 'image/png'
          : entryExt === '.jpg' || entryExt === '.jpeg'
            ? 'image/jpeg'
            : entryExt === '.webp'
              ? 'image/webp'
              : entryExt === '.gif'
                ? 'image/gif'
                : 'application/octet-stream'

      return new Response(new Uint8Array(entryBuffer), {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'Access-Control-Allow-Origin': '*',
          'X-Content-Type-Options': 'nosniff',
          'Cache-Control': 'public, max-age=31536000, immutable'
        }
      })
    }

    // 3. Path Resolution Normalization: Auto-resolve directory URIs to manifest indices
    if (fs.existsSync(resolvedPath)) {
      if (fs.statSync(resolvedPath).isDirectory()) {
        const manifestPath = path.join(resolvedPath, 'manifest.json')
        const templatesPath = path.join(resolvedPath, 'templates.json')

        if (fs.existsSync(manifestPath)) {
          resolvedPath = manifestPath
        } else if (fs.existsSync(templatesPath)) {
          resolvedPath = templatesPath
        } else {
          return new Response('Not Found: No manifest.json or templates.json in directory', { status: 404 })
        }
      }
    } else {
      return new Response('Not Found: Local path does not exist', { status: 404 })
    }

    // Double check that normalized path is still inside allowed directories
    if (!allowedDirs.some((dir) => isPathInside(resolvedPath, dir))) {
      return new Response('Forbidden: target file is outside authorized directories', { status: 403 })
    }

    // 4. File extension allowlist
    const ext = path.extname(resolvedPath).toLowerCase()
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return new Response('Forbidden: file extension not allowed', { status: 403 })
    }

    // 5. Read and serve the normalized local file
    const content = fs.readFileSync(resolvedPath)
    const mimeType = ext === '.json'
      ? 'application/json'
      : ext === '.js'
        ? 'application/javascript'
        : ext === '.png'
          ? 'image/png'
          : ext === '.jpg' || ext === '.jpeg'
            ? 'image/jpeg'
            : ext === '.webp'
              ? 'image/webp'
              : ext === '.svg'
                ? 'image/svg+xml'
                : 'text/plain'

    return new Response(content, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Access-Control-Allow-Origin': '*',
        'X-Content-Type-Options': 'nosniff'
      }
    })
  } catch (err: any) {
    console.error('[autakimi-local] Protocol error:', err.message)
    return new Response(`Internal Error: ${err.message}`, { status: 500 })
  }
}
