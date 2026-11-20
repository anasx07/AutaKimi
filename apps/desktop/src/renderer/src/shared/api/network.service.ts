import { NetworkClient } from '@common/services/network'
import { FetchOptions, IpcResult } from '@common/types'
import { getApi, callIpc } from './base'

export const NetworkBridge = {
  fetchRepo: (url: string) =>
    callIpc(() =>
      NetworkClient.executeWithRetry(
        () => getApi().fetchRepo(url),
        (r: IpcResult<unknown>) => !r.ok
      )
    ),
  fetchText: (url: string, options?: FetchOptions) =>
    callIpc(() =>
      NetworkClient.executeWithRetry(
        () => getApi().fetchText(url, options),
        (r: IpcResult<unknown>) => !r.ok,
        options?.attempts || 3,
        options?.delay || 1000
      )
    ),
  setStreamHeaders: (url: string, headers: Record<string, string>) =>
    callIpc(() => getApi().setStreamHeaders({ url, headers })),
  probeStream: (url: string, headers?: Record<string, string>, timeoutMs?: number) =>
    callIpc(() => getApi().probeStream({ url, headers, timeoutMs }))
}
