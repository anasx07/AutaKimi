import * as FileSystem from 'expo-file-system/legacy'
import * as DocumentPicker from 'expo-document-picker'
import * as Sharing from 'expo-sharing'
import pako from 'pako'
import { BackupData, IpcResult } from '@common/types'
import { MobileDB } from './db.native'

const MAX_BACKUP_SIZE = 100 * 1024 * 1024 // 100 MB max allowed decompressed size

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 8192
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode.apply(null, chunk as any)
  }
  return btoa(binary)
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function decodeUtf8(bytes: Uint8Array): string {
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder('utf-8').decode(bytes)
  }
  let binary = ''
  const chunkSize = 8192
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode.apply(null, chunk as any)
  }
  return decodeURIComponent(escape(binary))
}

export const MobileBackup = {
  /**
   * Dumps mobile library, reading_progress, reading_history, source_repositories, and trackers
   * into a compressed .json.gz file and triggers native file sharing / saving.
   */
  async exportBackup(): Promise<
    IpcResult<{
      success: boolean
      canceled?: boolean
      filePath?: string
      counts?: {
        library: number
        readingProgress: number
        readingHistory: number
        sourceRepositories: number
        trackers: number
      }
      error?: string
    }>
  > {
    try {
      const backupData: BackupData = await MobileDB.exportBackupData()
      const jsonStr = JSON.stringify(backupData)

      // Gzip compress backup data matching desktop zlib format
      const compressedBytes = pako.gzip(jsonStr)
      const base64Data = uint8ArrayToBase64(compressedBytes)

      const now = new Date()
      const dateStr = now.toISOString().split('T')[0]
      const filename = `autakimi-backup-${dateStr}.json.gz`
      const fileUri = `${FileSystem.cacheDirectory}${filename}`

      await FileSystem.writeAsStringAsync(fileUri, base64Data, {
        encoding: FileSystem.EncodingType.Base64
      })

      // Prompt native Share / Save sheet
      const canShare = await Sharing.isAvailableAsync()
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/gzip',
          dialogTitle: 'Export AutaKimi Backup',
          UTI: 'org.gnu.gnu-zip-archive'
        })
      }

      return {
        ok: true,
        value: {
          success: true,
          filePath: fileUri,
          counts: {
            library: backupData.library.length,
            readingProgress: backupData.readingProgress.length,
            readingHistory: backupData.readingHistory.length,
            sourceRepositories: backupData.sourceRepositories.length,
            trackers: backupData.trackers ? backupData.trackers.length : 0
          }
        }
      }
    } catch (err: any) {
      console.error('[MobileBackup] Export failed:', err)
      return {
        ok: false,
        error: err.message || 'Export failed'
      }
    }
  },

  /**
   * Prompts user to pick a .json.gz or .json backup file and restores it into MobileDB
   * within an atomic SQLite transaction.
   */
  async importBackup(): Promise<
    IpcResult<{
      success: boolean
      canceled?: boolean
      counts?: {
        library: number
        readingProgress: number
        readingHistory: number
        sourceRepositories: number
        trackers: number
      }
      error?: string
    }>
  > {
    try {
      const pickerResult = await DocumentPicker.getDocumentAsync({
        type: [
          'application/gzip',
          'application/json',
          'application/x-gzip',
          'application/octet-stream',
          '*/*'
        ],
        copyToCacheDirectory: true
      })

      if (pickerResult.canceled || !pickerResult.assets || pickerResult.assets.length === 0) {
        return {
          ok: true,
          value: { success: false, canceled: true }
        }
      }

      const asset = pickerResult.assets[0]
      const fileUri = asset.uri

      // Read file bytes as Base64
      const base64Data = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64
      })

      const rawBytes = base64ToUint8Array(base64Data)

      // Decompress if gzipped (magic bytes: 0x1f, 0x8b) with gzip bomb protection
      let jsonStr: string
      if (rawBytes.length >= 2 && rawBytes[0] === 0x1f && rawBytes[1] === 0x8b) {
        try {
          jsonStr = pako.ungzip(rawBytes, { to: 'string' })
          if (jsonStr.length > MAX_BACKUP_SIZE) {
            throw new Error('Backup file exceeds maximum allowed decompressed size of 100MB')
          }
        } catch (gzErr: any) {
          throw new Error(`Decompression failed: ${gzErr.message}`)
        }
      } else {
        if (rawBytes.length > MAX_BACKUP_SIZE) {
          throw new Error('Backup file exceeds maximum allowed size of 100MB')
        }
        jsonStr = decodeUtf8(rawBytes)
      }

      const backup: BackupData = JSON.parse(jsonStr)
      if (!backup || typeof backup !== 'object') {
        throw new Error('Invalid backup file: root is not an object')
      }

      const restoredCounts = await MobileDB.restoreBackup(backup)

      return {
        ok: true,
        value: {
          success: true,
          counts: restoredCounts
        }
      }
    } catch (err: any) {
      console.error('[MobileBackup] Import failed:', err)
      return {
        ok: false,
        error: err.message || 'Import failed'
      }
    }
  }
}
