import net from 'net'
import crypto from 'crypto'
import { settingsRepo } from '../db'
import { AppService, ServicePriority } from './service.registry'
import {
  buildDiscordActivity,
  type DiscordPresenceMediaInput,
  type DiscordRichPresenceActivity,
  type DiscordRpcStatus
} from '@common/utils/discordPresence'
import {
  DISCORD_IPC_OPCODES,
  decodeDiscordRpcFrames,
  encodeDiscordRpcFrame,
  getDiscordIpcEndpoints
} from '../utils/discordIpcFrame'

export class DiscordRpcService implements AppService {
  public priority = ServicePriority.FEATURE
  private enabled = false
  private clientId = ''
  private socket: net.Socket | null = null
  private isReady = false
  private isConnecting = false
  private lastError: string | null = null
  private pendingActivity: DiscordRichPresenceActivity | null = null
  private recvBuffer: Buffer = Buffer.alloc(0)
  private reconnectTimer: NodeJS.Timeout | null = null

  async initialize(): Promise<void> {
    try {
      const [rawEnabled, rawClientId] = await Promise.all([
        settingsRepo.get('discord_rpc_enabled'),
        settingsRepo.get('discord_rpc_client_id')
      ])
      this.enabled = rawEnabled === 'true'
      this.clientId = (rawClientId || process.env.AUTAKIMI_DISCORD_CLIENT_ID || '').trim()
      if (this.enabled && this.clientId) {
        void this.ensureConnected()
      }
    } catch (err) {
      console.warn('[DiscordRPC] Failed to load settings during initialization:', err)
    }
  }

  async shutdown(): Promise<void> {
    this.clearReconnectTimer()
    this.pendingActivity = null
    this.disconnectSocket(true)
  }

  public getStatus(): DiscordRpcStatus {
    return {
      enabled: this.enabled,
      connected: Boolean(this.socket && this.isReady),
      hasClientId: this.clientId.length > 0,
      clientId: this.clientId,
      lastError: this.lastError,
      activeDetails: this.pendingActivity?.details ?? null
    }
  }

  public async configure(partial: {
    enabled?: boolean
    clientId?: string
  }): Promise<DiscordRpcStatus> {
    const nextEnabled = partial.enabled !== undefined ? partial.enabled : this.enabled
    const nextClientId =
      partial.clientId !== undefined
        ? (partial.clientId || process.env.AUTAKIMI_DISCORD_CLIENT_ID || '').trim()
        : this.clientId

    const clientIdChanged = nextClientId !== this.clientId
    this.enabled = nextEnabled
    this.clientId = nextClientId

    if (!this.enabled || !this.clientId) {
      this.clearReconnectTimer()
      if (this.isReady && this.socket) {
        this.sendActivityPacket(null)
      }
      this.disconnectSocket(true)
      this.lastError = !this.enabled ? null : 'Enter a Discord Application Client ID to connect'
      return this.getStatus()
    }

    if (clientIdChanged && this.socket) {
      this.disconnectSocket(true)
    }

    await this.ensureConnected()
    return this.getStatus()
  }

  public async setActivity(input: DiscordPresenceMediaInput): Promise<DiscordRpcStatus> {
    const activity = buildDiscordActivity(input)
    this.pendingActivity = activity

    if (!this.enabled) {
      this.lastError = null
      return this.getStatus()
    }

    if (!this.clientId) {
      this.lastError = 'Enter a Discord Application Client ID to connect'
      return this.getStatus()
    }

    if (this.isReady && this.socket) {
      this.sendActivityPacket(activity)
      return this.getStatus()
    }

    if (activity !== null) {
      void this.ensureConnected()
    }

    return this.getStatus()
  }

  public async clearActivity(): Promise<DiscordRpcStatus> {
    this.pendingActivity = null
    if (this.isReady && this.socket) {
      this.sendActivityPacket(null)
    }
    return this.getStatus()
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer()
    if (!this.enabled || !this.clientId) return

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (this.enabled && this.clientId && !this.isReady && !this.isConnecting) {
        void this.ensureConnected()
      }
    }, 15000)
  }

  private disconnectSocket(sendClose = false): void {
    const sock = this.socket
    this.socket = null
    this.isReady = false
    this.isConnecting = false
    this.recvBuffer = Buffer.alloc(0)
    if (!sock) return

    try {
      if (sendClose && !sock.destroyed) {
        sock.write(encodeDiscordRpcFrame(DISCORD_IPC_OPCODES.CLOSE, {}))
      }
    } catch {}
    try {
      sock.destroy()
    } catch {}
  }

  private sendActivityPacket(activity: DiscordRichPresenceActivity | null): void {
    if (!this.socket || this.socket.destroyed || !this.isReady) return
    try {
      const frame = encodeDiscordRpcFrame(DISCORD_IPC_OPCODES.FRAME, {
        cmd: 'SET_ACTIVITY',
        args: {
          pid: process.pid,
          activity
        },
        nonce: crypto.randomUUID()
      })
      this.socket.write(frame)
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err)
      this.disconnectSocket(false)
      this.scheduleReconnect()
    }
  }

  private async ensureConnected(): Promise<void> {
    if (!this.enabled || !this.clientId) return
    if (this.isReady || this.isConnecting) return

    this.isConnecting = true
    this.clearReconnectTimer()

    const endpoints = getDiscordIpcEndpoints()
    for (const endpoint of endpoints) {
      if (!this.enabled || !this.clientId) {
        this.isConnecting = false
        return
      }
      const sock = await this.tryConnectEndpoint(endpoint, this.clientId)
      if (sock) {
        this.socket = sock
        this.isReady = true
        this.isConnecting = false
        this.lastError = null
        if (this.pendingActivity) {
          this.sendActivityPacket(this.pendingActivity)
        }
        return
      }
    }

    this.isConnecting = false
    this.isReady = false
    if (!this.lastError) {
      this.lastError = 'Discord desktop client not detected'
    }
    this.scheduleReconnect()
  }

  private tryConnectEndpoint(endpoint: string, clientId: string): Promise<net.Socket | null> {
    return new Promise((resolve) => {
      let settled = false
      const sock = net.createConnection(endpoint)

      const finish = (result: net.Socket | null, errMessage?: string) => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        if (!result) {
          if (errMessage) this.lastError = errMessage
          try {
            sock.destroy()
          } catch {}
        }
        resolve(result)
      }

      const timeout = setTimeout(() => {
        finish(null)
      }, 2000)

      sock.on('connect', () => {
        try {
          sock.write(
            encodeDiscordRpcFrame(DISCORD_IPC_OPCODES.HANDSHAKE, {
              v: 1,
              client_id: clientId
            })
          )
        } catch (err) {
          finish(null, err instanceof Error ? err.message : String(err))
        }
      })

      sock.on('data', (chunk: Buffer) => {
        this.recvBuffer = Buffer.concat([this.recvBuffer, chunk])
        const { frames, remainder } = decodeDiscordRpcFrames(this.recvBuffer)
        this.recvBuffer = remainder

        for (const frame of frames) {
          if (frame.opcode === DISCORD_IPC_OPCODES.PING) {
            try {
              sock.write(encodeDiscordRpcFrame(DISCORD_IPC_OPCODES.PONG, frame.data))
            } catch {}
            continue
          }

          if (frame.opcode === DISCORD_IPC_OPCODES.CLOSE) {
            const closeMsg =
              typeof frame.data?.message === 'string'
                ? frame.data.message
                : 'Discord closed IPC connection (verify Client ID)'
            finish(null, closeMsg)
            if (this.socket === sock) {
              this.lastError = closeMsg
              this.disconnectSocket(false)
              this.scheduleReconnect()
            }
            return
          }

          if (frame.data?.evt === 'READY') {
            this.lastError = null
            finish(sock)
          } else if (frame.data?.evt === 'ERROR') {
            const errMsg =
              typeof frame.data?.data?.message === 'string'
                ? frame.data.data.message
                : 'Discord RPC error'
            this.lastError = errMsg
          }
        }
      })

      sock.on('error', () => {
        finish(null)
      })

      sock.on('close', () => {
        if (!settled) {
          finish(null)
        } else if (this.socket === sock) {
          this.disconnectSocket(false)
          this.scheduleReconnect()
        }
      })
    })
  }
}

export const discordRpcService = new DiscordRpcService()
