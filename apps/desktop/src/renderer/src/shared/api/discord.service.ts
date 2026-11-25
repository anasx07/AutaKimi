import { getApi, callIpc } from './base'
import type { DiscordPresenceMediaInput, DiscordRpcStatus } from '@common/utils/discordPresence'

export const DiscordService = {
  setActivity: (input: DiscordPresenceMediaInput): Promise<DiscordRpcStatus> =>
    callIpc(() => getApi().discord.setActivity(input)),
  clear: (): Promise<DiscordRpcStatus> => callIpc(() => getApi().discord.clear()),
  getStatus: (): Promise<DiscordRpcStatus> => callIpc(() => getApi().discord.getStatus())
}
