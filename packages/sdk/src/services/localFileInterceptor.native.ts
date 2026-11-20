/**
 * React Native / Mobile Stub for Local File System Interceptor.
 * Metro automatically resolves .native.ts files over .ts files for mobile targets.
 * On mobile, local files are handled via Expo FileSystem or native bridges.
 */

import { Result } from '../types/result'

export function registerAllowedDirectory(dir: string): void {
  // No-op on mobile
}

export function tryReadLocalFile(urlStr: string): any {
  return null
}

export function tryReadLocalFileSafe(
  url: string
): Result<any> | null {
  return null
}
