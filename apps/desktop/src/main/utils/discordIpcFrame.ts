import path from 'path'

export const DISCORD_IPC_OPCODES = {
  HANDSHAKE: 0,
  FRAME: 1,
  CLOSE: 2,
  PING: 3,
  PONG: 4
} as const

export function encodeDiscordRpcFrame(opcode: number, payload: unknown): Buffer {
  const data = Buffer.from(JSON.stringify(payload), 'utf8')
  const header = Buffer.alloc(8)
  header.writeInt32LE(opcode, 0)
  header.writeInt32LE(data.length, 4)
  return Buffer.concat([header, data])
}

export interface DecodedDiscordRpcFrame {
  opcode: number
  data: any
}

export function decodeDiscordRpcFrames(buffer: Buffer): {
  frames: DecodedDiscordRpcFrame[]
  remainder: Buffer
} {
  const frames: DecodedDiscordRpcFrame[] = []
  let offset = 0

  while (offset + 8 <= buffer.length) {
    const opcode = buffer.readInt32LE(offset)
    const length = buffer.readInt32LE(offset + 4)
    if (length < 0 || offset + 8 + length > buffer.length) {
      break
    }

    const rawJson = buffer.subarray(offset + 8, offset + 8 + length).toString('utf8')
    let parsed: any = rawJson
    try {
      parsed = JSON.parse(rawJson)
    } catch {
      // Keep raw string if payload is non-JSON
    }
    frames.push({ opcode, data: parsed })
    offset += 8 + length
  }

  return {
    frames,
    remainder: buffer.subarray(offset)
  }
}

export function getDiscordIpcEndpoints(
  platform: string = process.platform,
  env: Record<string, string | undefined> = process.env
): string[] {
  const endpoints: string[] = []
  if (platform === 'win32') {
    for (let i = 0; i < 10; i++) {
      endpoints.push(`\\\\?\\pipe\\discord-ipc-${i}`)
    }
    return endpoints
  }

  const baseDirs = Array.from(
    new Set(
      [env.XDG_RUNTIME_DIR, env.TMPDIR, env.TMP, env.TEMP, '/tmp'].filter((v): v is string =>
        Boolean(v && v.trim())
      )
    )
  )

  for (let i = 0; i < 10; i++) {
    for (const dir of baseDirs) {
      endpoints.push(path.posix.join(dir, `discord-ipc-${i}`))
      if (platform === 'linux') {
        endpoints.push(path.posix.join(dir, 'app', 'com.discordapp.Discord', `discord-ipc-${i}`))
      }
    }
  }

  return endpoints
}
