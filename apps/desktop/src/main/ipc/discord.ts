import { IpcChannel } from '../types/ipc'
import { discordRpcService } from '../services/discord-rpc.service'
import { registerHandler, wrapIpc } from './utils'
import type { DiscordPresenceMediaInput } from '@common/utils/discordPresence'

export function registerDiscordHandlers(): void {
  registerHandler(
    IpcChannel.DISCORD_RPC_SET_ACTIVITY,
    wrapIpc(async (_, input: DiscordPresenceMediaInput) => {
      if (!input || typeof input !== 'object') {
        throw new Error('Invalid Discord activity payload')
      }
      return discordRpcService.setActivity(input)
    })
  )

  registerHandler(
    IpcChannel.DISCORD_RPC_CLEAR,
    wrapIpc(async () => discordRpcService.clearActivity())
  )

  registerHandler(
    IpcChannel.DISCORD_RPC_GET_STATUS,
    wrapIpc(async () => discordRpcService.getStatus())
  )
}
