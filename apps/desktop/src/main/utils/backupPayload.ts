import zlib from 'zlib'
import { BackupData } from '@common/types'

export const MAX_BACKUP_SIZE = 100 * 1024 * 1024 // 100 MB max backup size limit

export function serializeBackup(data: BackupData, compress = true): Buffer {
  const jsonStr = JSON.stringify(data)
  const rawBuf = Buffer.from(jsonStr, 'utf-8')
  if (!compress) {
    return rawBuf
  }
  return zlib.gzipSync(rawBuf)
}

export function deserializeBackup(rawBuffer: Buffer): BackupData {
  let jsonStr: string
  if (rawBuffer.length >= 2 && rawBuffer[0] === 0x1f && rawBuffer[1] === 0x8b) {
    try {
      jsonStr = zlib
        .gunzipSync(rawBuffer, { maxOutputLength: MAX_BACKUP_SIZE })
        .toString('utf-8')
    } catch (gzErr: any) {
      if (gzErr?.code === 'ERR_BUFFER_TOO_LARGE' || gzErr?.name === 'RangeError') {
        throw new Error(
          'Backup file exceeds maximum allowed decompressed size of 100MB (potential gzip bomb)'
        )
      }
      throw gzErr
    }
  } else {
    if (rawBuffer.length > MAX_BACKUP_SIZE) {
      throw new Error('Backup file exceeds maximum allowed size of 100MB')
    }
    jsonStr = rawBuffer.toString('utf-8')
  }

  const data: BackupData = JSON.parse(jsonStr)
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid backup file format: Root is not an object')
  }

  return data
}
