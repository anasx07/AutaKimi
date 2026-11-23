import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import {
  createCbzArchive,
  listCbzEntries,
  readCbzEntry,
  crc32
} from '../apps/desktop/src/main/utils/cbz'

describe('CBZ Archive Utility', () => {
  let tmpDir: string
  let cbzPath: string

  beforeAll(async () => {
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'autakimi-cbz-test-'))
    cbzPath = path.join(tmpDir, 'test-chapter.cbz')
  })

  afterAll(async () => {
    try {
      await fs.promises.rm(tmpDir, { recursive: true, force: true })
    } catch {}
  })

  it('computes correct CRC32 values', () => {
    const data = Buffer.from('123456789', 'utf-8')
    // Standard CRC32 of '123456789' is 0xcbf43926 (3421780262)
    expect(crc32(data)).toBe(0xcbf43926)

    const empty = Buffer.alloc(0)
    expect(crc32(empty)).toBe(0)
  })

  it('creates, lists, and reads uncompressed STORE .cbz archives', async () => {
    const page1Data = Buffer.from('fake page 1 image data - jpg header')
    const page2Data = Buffer.from('fake page 2 image data - png header')
    const page10Data = Buffer.from('fake page 10 image data - webp header')

    const entries = [
      { name: 'page_10.jpg', buffer: page10Data },
      { name: 'page_1.jpg', buffer: page1Data },
      { name: 'page_2.jpg', buffer: page2Data }
    ]

    // Create archive
    await createCbzArchive(entries, cbzPath)
    expect(fs.existsSync(cbzPath)).toBe(true)

    // List entries (should be naturally sorted)
    const listed = await listCbzEntries(cbzPath)
    expect(listed.length).toBe(3)
    expect(listed[0].name).toBe('page_1.jpg')
    expect(listed[1].name).toBe('page_2.jpg')
    expect(listed[2].name).toBe('page_10.jpg')

    // Read individual entries
    const readPage1 = await readCbzEntry(cbzPath, 'page_1.jpg')
    expect(readPage1).not.toBeNull()
    expect(readPage1?.toString('utf-8')).toBe(page1Data.toString('utf-8'))

    const readPage10 = await readCbzEntry(cbzPath, 'page_10.jpg')
    expect(readPage10).not.toBeNull()
    expect(readPage10?.toString('utf-8')).toBe(page10Data.toString('utf-8'))

    // Non-existent entry returns null
    const missing = await readCbzEntry(cbzPath, 'non_existent.jpg')
    expect(missing).toBeNull()
  })
})
