import fs from 'fs'
import path from 'path'
import zlib from 'zlib'

// Precomputed CRC32 Lookup Table
const crcTable = new Uint32Array(256)
for (let i = 0; i < 256; i++) {
  let c = i
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  }
  crcTable[i] = c >>> 0
}

export function crc32(buffer: Uint8Array): number {
  let crc = -1
  for (let i = 0; i < buffer.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buffer[i]) & 0xff]
  }
  return (crc ^ -1) >>> 0
}

export interface CbzEntry {
  name: string
  method: number // 0 = STORE, 8 = DEFLATE
  compressedSize: number
  uncompressedSize: number
  localHeaderOffset: number
  dataOffset?: number
}

interface CbzIndex {
  mtimeMs: number
  entries: Map<string, CbzEntry>
  sortedNames: string[]
}

// In-memory LRU cache for parsed CBZ central directories
const indexCache = new Map<string, CbzIndex>()
const MAX_CACHE_ENTRIES = 50

/**
 * Creates a standard Comic Book ZIP (.cbz) archive using STORE (uncompressed) method.
 * Zero CPU compression overhead, lightning-fast random page access.
 */
export async function createCbzArchive(
  entries: Array<{ name: string; buffer: Buffer }>,
  outputPath: string
): Promise<void> {
  const tmpPath = `${outputPath}.${Date.now()}.tmp`
  const dir = path.dirname(outputPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  // Pre-calculate buffers and central directory records
  const localChunks: Buffer[] = []
  const cdRecords: Array<{
    name: string
    nameBuf: Buffer
    crc: number
    size: number
    offset: number
  }> = []

  let currentOffset = 0
  const now = new Date()
  const dosTime =
    ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xffff
  const dosDate =
    (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xffff

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name.replace(/\\/g, '/'), 'utf-8')
    const dataBuf = entry.buffer
    const crc = crc32(dataBuf)
    const size = dataBuf.length

    // Local File Header (30 bytes + name length)
    const localHeader = Buffer.alloc(30)
    localHeader.writeUInt32LE(0x04034b50, 0) // Local header signature
    localHeader.writeUInt16LE(20, 4) // Version needed (2.0)
    localHeader.writeUInt16LE(0, 6) // General purpose bit flag
    localHeader.writeUInt16LE(0, 8) // Compression method: 0 (STORE)
    localHeader.writeUInt16LE(dosTime, 10)
    localHeader.writeUInt16LE(dosDate, 12)
    localHeader.writeUInt32LE(crc, 14)
    localHeader.writeUInt32LE(size, 18) // Compressed size
    localHeader.writeUInt32LE(size, 22) // Uncompressed size
    localHeader.writeUInt16LE(nameBuf.length, 26)
    localHeader.writeUInt16LE(0, 28) // Extra field length

    cdRecords.push({
      name: entry.name,
      nameBuf,
      crc,
      size,
      offset: currentOffset
    })

    localChunks.push(localHeader, nameBuf, dataBuf)
    currentOffset += 30 + nameBuf.length + size
  }

  // Central Directory
  const cdOffset = currentOffset
  const cdChunks: Buffer[] = []

  for (const record of cdRecords) {
    const cdHeader = Buffer.alloc(46)
    cdHeader.writeUInt32LE(0x02014b50, 0) // Central directory signature
    cdHeader.writeUInt16LE(20, 4) // Version made by
    cdHeader.writeUInt16LE(20, 6) // Version needed
    cdHeader.writeUInt16LE(0, 8) // General purpose bit flag
    cdHeader.writeUInt16LE(0, 10) // Compression method: 0 (STORE)
    cdHeader.writeUInt16LE(dosTime, 12)
    cdHeader.writeUInt16LE(dosDate, 14)
    cdHeader.writeUInt32LE(record.crc, 16)
    cdHeader.writeUInt32LE(record.size, 20)
    cdHeader.writeUInt32LE(record.size, 24)
    cdHeader.writeUInt16LE(record.nameBuf.length, 28)
    cdHeader.writeUInt16LE(0, 30) // Extra field length
    cdHeader.writeUInt16LE(0, 32) // Comment length
    cdHeader.writeUInt16LE(0, 34) // Disk number start
    cdHeader.writeUInt16LE(0, 36) // Internal file attributes
    cdHeader.writeUInt32LE(0, 38) // External file attributes
    cdHeader.writeUInt32LE(record.offset, 42) // Local header offset

    cdChunks.push(cdHeader, record.nameBuf)
    currentOffset += 46 + record.nameBuf.length
  }

  const cdSize = currentOffset - cdOffset

  // End of Central Directory Record (22 bytes)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0) // EOCD signature
  eocd.writeUInt16LE(0, 4) // Disk number
  eocd.writeUInt16LE(0, 6) // Start disk
  eocd.writeUInt16LE(entries.length, 8) // Total entries on disk
  eocd.writeUInt16LE(entries.length, 10) // Total entries in CD
  eocd.writeUInt32LE(cdSize, 12) // Size of CD
  eocd.writeUInt32LE(cdOffset, 16) // Offset of start of CD
  eocd.writeUInt16LE(0, 20) // Comment length

  const fullArchive = Buffer.concat([...localChunks, ...cdChunks, eocd])
  await fs.promises.writeFile(tmpPath, fullArchive)
  await fs.promises.rename(tmpPath, outputPath)

  // Invalidate any cached index for this file
  indexCache.delete(outputPath)
}

/**
 * Parses the Central Directory of a .cbz file (cached in memory)
 */
async function getOrParseCbzIndex(cbzPath: string): Promise<CbzIndex> {
  const stat = await fs.promises.stat(cbzPath)
  const cached = indexCache.get(cbzPath)
  if (cached && cached.mtimeMs === stat.mtimeMs) {
    return cached
  }

  const fd = await fs.promises.open(cbzPath, 'r')
  try {
    const fileSize = stat.size
    if (fileSize < 22) throw new Error('File too small to be a valid ZIP archive')

    // Find EOCD (search last 1024 bytes or entire file)
    const searchLen = Math.min(fileSize, 1024 * 64)
    const searchBuf = Buffer.alloc(searchLen)
    await fd.read(searchBuf, 0, searchLen, fileSize - searchLen)

    let eocdOffset = -1
    for (let i = searchLen - 22; i >= 0; i--) {
      if (
        searchBuf[i] === 0x50 &&
        searchBuf[i + 1] === 0x4b &&
        searchBuf[i + 2] === 0x05 &&
        searchBuf[i + 3] === 0x06
      ) {
        eocdOffset = fileSize - searchLen + i
        break
      }
    }

    if (eocdOffset === -1) {
      throw new Error('EOCD signature not found in archive')
    }

    const eocdHeader = Buffer.alloc(22)
    await fd.read(eocdHeader, 0, 22, eocdOffset)
    const cdSize = eocdHeader.readUInt32LE(12)
    const cdOffset = eocdHeader.readUInt32LE(16)

    // Read Central Directory
    const cdBuf = Buffer.alloc(cdSize)
    await fd.read(cdBuf, 0, cdSize, cdOffset)

    const entries = new Map<string, CbzEntry>()
    const sortedNames: string[] = []

    let pos = 0
    while (pos + 46 <= cdSize) {
      const sig = cdBuf.readUInt32LE(pos)
      if (sig !== 0x02014b50) break

      const method = cdBuf.readUInt16LE(pos + 10)
      const compressedSize = cdBuf.readUInt32LE(pos + 20)
      const uncompressedSize = cdBuf.readUInt32LE(pos + 24)
      const nameLen = cdBuf.readUInt16LE(pos + 28)
      const extraLen = cdBuf.readUInt16LE(pos + 30)
      const commentLen = cdBuf.readUInt16LE(pos + 32)
      const localOffset = cdBuf.readUInt32LE(pos + 42)

      const name = cdBuf.toString('utf-8', pos + 46, pos + 46 + nameLen)
      const entry: CbzEntry = {
        name,
        method,
        compressedSize,
        uncompressedSize,
        localHeaderOffset: localOffset
      }

      entries.set(name.toLowerCase(), entry)
      entries.set(name, entry)
      sortedNames.push(name)

      pos += 46 + nameLen + extraLen + commentLen
    }

    // Natural sort: 000.jpg, 001.jpg, 002.jpg...
    sortedNames.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))

    const index: CbzIndex = {
      mtimeMs: stat.mtimeMs,
      entries,
      sortedNames
    }

    if (indexCache.size >= MAX_CACHE_ENTRIES) {
      const firstKey = indexCache.keys().next().value
      if (firstKey) indexCache.delete(firstKey)
    }
    indexCache.set(cbzPath, index)

    return index
  } finally {
    await fd.close()
  }
}

/**
 * Lists all file entry names inside a .cbz archive in natural display order.
 */
export async function listCbzEntries(
  cbzPath: string
): Promise<Array<{ name: string; size: number }>> {
  const index = await getOrParseCbzIndex(cbzPath)
  return index.sortedNames.map((name) => {
    const entry = index.entries.get(name)!
    return { name, size: entry.uncompressedSize }
  })
}

/**
 * Reads a single file entry from a .cbz archive into a Buffer.
 * If STORE (0), reads raw bytes instantly with zero CPU decompression.
 * If DEFLATE (8), decompresses on the fly.
 */
export async function readCbzEntry(cbzPath: string, entryName: string): Promise<Buffer | null> {
  const index = await getOrParseCbzIndex(cbzPath)
  const cleanName = entryName.replace(/\\/g, '/').toLowerCase()
  const entry = index.entries.get(cleanName) || index.entries.get(entryName)
  if (!entry) return null

  const fd = await fs.promises.open(cbzPath, 'r')
  try {
    // If dataOffset is not yet calculated, resolve it from the local header
    if (entry.dataOffset === undefined) {
      const localHead = Buffer.alloc(30)
      await fd.read(localHead, 0, 30, entry.localHeaderOffset)
      const localNameLen = localHead.readUInt16LE(26)
      const localExtraLen = localHead.readUInt16LE(28)
      entry.dataOffset = entry.localHeaderOffset + 30 + localNameLen + localExtraLen
    }

    const compressedBuf = Buffer.alloc(entry.compressedSize)
    await fd.read(compressedBuf, 0, entry.compressedSize, entry.dataOffset)

    if (entry.method === 0) {
      // STORE: Raw uncompressed image
      return compressedBuf
    } else if (entry.method === 8) {
      // DEFLATE: Decompress using raw inflate
      return zlib.inflateRawSync(compressedBuf)
    } else {
      throw new Error(`Unsupported compression method in CBZ: ${entry.method}`)
    }
  } finally {
    await fd.close()
  }
}
