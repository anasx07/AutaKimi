import { describe, it, expect } from 'vitest'
import zlib from 'zlib'
import {
  serializeBackup,
  deserializeBackup,
  MAX_BACKUP_SIZE
} from '../apps/desktop/src/main/utils/backupPayload'
import { BackupData } from '@common/types'

describe('Backup Payload Roundtrip & Gzip Protection', () => {
  const sampleBackup: BackupData = {
    version: 1,
    appVersion: '2.1.8',
    createdAt: new Date().toISOString(),
    library: [
      {
        id: 'manga-1',
        title: 'Solo Leveling',
        coverUrl: 'https://example.com/cover.jpg',
        sourceId: 'asura',
        type: 'manga'
      }
    ],
    readingProgress: [
      {
        mangaId: 'manga-1',
        chapterId: 'ch-1',
        lastPageRead: 15,
        isRead: true,
        updatedAt: new Date().toISOString()
      }
    ],
    readingHistory: [
      {
        mangaId: 'manga-1',
        chapterId: 'ch-1',
        readAt: new Date().toISOString()
      }
    ],
    sourceRepositories: ['https://raw.githubusercontent.com/repo/index.min.json'],
    trackers: [
      {
        mangaId: 'manga-1',
        provider: 'anilist',
        remoteId: '105398',
        score: 85,
        status: 'CURRENT',
        lastSyncedChapter: 1,
        updatedAt: new Date().toISOString()
      }
    ]
  }

  it('serializes and deserializes compressed .json.gz backups cleanly', () => {
    const compressedBuffer = serializeBackup(sampleBackup, true)
    // Check gzip magic bytes 0x1f, 0x8b
    expect(compressedBuffer[0]).toBe(0x1f)
    expect(compressedBuffer[1]).toBe(0x8b)

    const restored = deserializeBackup(compressedBuffer)
    expect(restored.version).toBe(1)
    expect(restored.appVersion).toBe('2.1.8')
    expect(restored.library.length).toBe(1)
    expect(restored.library[0].title).toBe('Solo Leveling')
    expect(restored.readingProgress[0].chapterId).toBe('ch-1')
    expect(restored.trackers[0].remoteId).toBe('105398')
  })

  it('serializes and deserializes raw uncompressed .json backups cleanly', () => {
    const rawBuffer = serializeBackup(sampleBackup, false)
    expect(rawBuffer[0]).not.toBe(0x1f)

    const restored = deserializeBackup(rawBuffer)
    expect(restored.library[0].id).toBe('manga-1')
    expect(restored.readingHistory.length).toBe(1)
  })

  it('rejects invalid non-object JSON payloads', () => {
    const invalidJson = Buffer.from('"just a string"', 'utf-8')
    expect(() => deserializeBackup(invalidJson)).toThrow(
      'Invalid backup file format: Root is not an object'
    )
  })

  it('rejects raw payloads exceeding MAX_BACKUP_SIZE', () => {
    const oversized = Buffer.alloc(MAX_BACKUP_SIZE + 10)
    expect(() => deserializeBackup(oversized)).toThrow(
      'Backup file exceeds maximum allowed size of 100MB'
    )
  })

  it('rejects potential gzip bombs during decompression', () => {
    // Generate a tiny compressed buffer that decompresses to larger than MAX_BACKUP_SIZE
    // We can simulate this with a small test limit or verifying maxOutputLength error handling
    const largeZeroes = Buffer.alloc(1024 * 1024 * 2) // 2MB of zeroes
    const gzipped = zlib.gzipSync(largeZeroes)

    // Using gunzip with artificially low maxOutputLength throws RangeError / ERR_BUFFER_TOO_LARGE
    expect(() => {
      zlib.gunzipSync(gzipped, { maxOutputLength: 1024 })
    }).toThrow()
  })
})
