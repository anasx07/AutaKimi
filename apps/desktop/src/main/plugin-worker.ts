import { parentPort } from 'worker_threads'
import vm from 'vm'

/**
 * Plugin worker thread.
 *
 * Runs plugin code in an isolated V8 context (`vm.createContext`) inside a
 * separate OS process. The main process — which hosts the Cloudflare challenge
 * BrowserWindow — never executes plugin code directly; all cross-process
 * communication goes through a narrow, typed IPC channel.
 *
 * IPC protocol (Main → Worker):
 *   EXECUTE         { requestId, pluginId, code, context, winId }
 *   DISPOSE         { requestId, pluginId }
 *   WIN_ACTION_REPLY{ replyId, ok, result?, error? }
 *   WINDOW_DESTROYED{ winId }
 *   SHUTDOWN        { }
 *
 * IPC protocol (Worker → Main):
 *   READY                 { }
 *   EXECUTE_SUCCESS       { requestId, hasDisposer }
 *   EXECUTE_ERROR         { requestId, error }
 *   WIN_ACTION_REQUEST    { replyId, winId, action, payload }
 *   LOG                   { level, args }
 *   DISPOSE_DONE          { requestId, ok, error? }
 */

if (!parentPort) {
  throw new Error('This file must be run inside a Worker thread.')
}

const port = parentPort

const PLUGIN_TIMEOUT_MS = 30_000
const DISPOSER_TIMEOUT_MS = 5_000

interface WinActionRequest {
  replyId: string
  winId: string
  action: 'executeJavaScript' | 'sendInputEvent' | 'isDestroyed' | 'getTitle'
  payload?: { script?: string; event?: unknown }
}

interface WinActionReply {
  replyId: string
  ok: boolean
  result?: unknown
  error?: string
}

interface ExecuteMessage {
  requestId: string
  pluginId: string
  code: string
  context: { winId: string; [k: string]: unknown }
}

interface DisposeMessage {
  requestId: string
  pluginId: string
}

interface PluginState {
  vmContext: vm.Context
  timers: Set<unknown>
  intervals: Set<unknown>
  winId: string
  hasDisposer: boolean
}

const pluginStates = new Map<string, PluginState>()
const pendingWinActionReplies = new Map<string, (reply: WinActionReply) => void>()
const destroyedWindows = new Set<string>()

// ─── Helpers ─────────────────────────────────────────────────────────────────

function send(msg: unknown): void {
  port.postMessage(msg)
}

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function makeWinAction(winId: string) {
  return (action: WinActionRequest['action'], payload?: WinActionRequest['payload']): Promise<unknown> => {
    return new Promise((resolve, reject) => {
      const replyId = generateId()
      pendingWinActionReplies.set(replyId, (reply) => {
        if (reply.ok) resolve(reply.result)
        else reject(new Error(reply.error ?? 'winAction failed'))
      })
      send({ type: 'WIN_ACTION_REQUEST', replyId, winId, action, payload })
    })
  }
}

function buildWinProxy(winId: string, winAction: ReturnType<typeof makeWinAction>) {
  return {
    isDestroyed: (): boolean => destroyedWindows.has(winId),
    getTitle: async (): Promise<string> => {
      return (await winAction('getTitle')) as string
    },
    webContents: {
      executeJavaScript: async (script: string): Promise<unknown> => {
        if (destroyedWindows.has(winId)) return undefined
        return winAction('executeJavaScript', { script })
      },
      sendInputEvent: async (event: unknown): Promise<void> => {
        if (destroyedWindows.has(winId)) return
        await winAction('sendInputEvent', { event })
      }
    }
  }
}

function buildSandbox(winId: string): {
  sandbox: Record<string, unknown>
  timers: Set<unknown>
  intervals: Set<unknown>
} {
  const timers = new Set<unknown>()
  const intervals = new Set<unknown>()
  const winAction = makeWinAction(winId)
  const win = buildWinProxy(winId, winAction)

  const wrappedSetTimeout = (
    callback: (...args: unknown[]) => void,
    ms?: number,
    ...args: unknown[]
  ): unknown => {
    const id = setTimeout(() => {
      timers.delete(id)
      try {
        callback(...args)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        send({ type: 'LOG', level: 'error', args: [`[setTimeout error: ${msg}]`] })
      }
    }, ms)
    timers.add(id)
    return id
  }

  const wrappedClearTimeout = (id: unknown): void => {
    if (id !== undefined) {
      clearTimeout(id as Parameters<typeof clearTimeout>[0])
      timers.delete(id)
    }
  }

  const wrappedSetInterval = (
    callback: (...args: unknown[]) => void,
    ms?: number,
    ...args: unknown[]
  ): unknown => {
    const id = setInterval(() => {
      try {
        callback(...args)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        send({ type: 'LOG', level: 'error', args: [`[setInterval error: ${msg}]`] })
      }
    }, ms)
    intervals.add(id)
    return id
  }

  const wrappedClearInterval = (id: unknown): void => {
    if (id !== undefined) {
      clearInterval(id as Parameters<typeof clearInterval>[0])
      intervals.delete(id)
    }
  }

  const consoleProxy = {
    log: (...args: unknown[]) => send({ type: 'LOG', level: 'log', args }),
    error: (...args: unknown[]) => send({ type: 'LOG', level: 'error', args }),
    warn: (...args: unknown[]) => send({ type: 'LOG', level: 'warn', args }),
    info: (...args: unknown[]) => send({ type: 'LOG', level: 'info', args }),
    debug: (...args: unknown[]) => send({ type: 'LOG', level: 'debug', args })
  }

  const sandbox: Record<string, unknown> = {
    console: consoleProxy,
    setTimeout: wrappedSetTimeout,
    setInterval: wrappedSetInterval,
    clearTimeout: wrappedClearTimeout,
    clearInterval: wrappedClearInterval,
    Promise,
    URL,
    Math,
    Date,
    JSON,
    __winId: winId,
    __winAction: winAction,
    __win: win,
    __pluginCode: '',
    __disposer: null,
    __params: {}
  }

  return { sandbox, timers, intervals }
}

// ─── Plugin execution ────────────────────────────────────────────────────────

async function executePlugin(msg: ExecuteMessage): Promise<void> {
  const { requestId, pluginId, code, context } = msg
  const winId = context.winId

  // If this plugin already has state (e.g. from a previous execute call),
  // re-use it. The context should normally not be re-supplied — this is a
  // safeguard against double-execute.
  let state = pluginStates.get(pluginId)

  if (!state) {
    const { sandbox, timers, intervals } = buildSandbox(winId)
    sandbox.__pluginCode = code
    sandbox.__params = context

    let vmContext: vm.Context
    try {
      vmContext = vm.createContext(sandbox)
    } catch (err) {
      const m = err instanceof Error ? err.message : String(err)
      send({ type: 'EXECUTE_ERROR', requestId, error: `vm.createContext failed: ${m}` })
      return
    }

    state = { vmContext, timers, intervals, winId, hasDisposer: false }
    pluginStates.set(pluginId, state)
  } else {
    // Update __params for re-runs (covers plugins that read context per-execute)
    ;(state.vmContext as unknown as { __params: unknown }).__params = context
    ;(state.vmContext as unknown as { __pluginCode: string }).__pluginCode = code
  }

  // Wrapper contains zero user-supplied text. User code is read from sandbox.
  const wrapper = `
    (async () => {
      try {
        var AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
        var getExecutor = new AsyncFunction('context', 'console', __pluginCode);
        var executor = await getExecutor({ win: __win }, console);

        if (typeof executor === 'function') {
          var result = await executor({ win: __win });
          if (typeof result === 'function') {
            __disposer = result;
          }
        } else {
          console.error('Plugin did not return a valid executor function');
        }
      } catch (e) {
        console.error('Execution error: ' + (e && e.message ? e.message : e));
      }
    })()
  `

  try {
    const script = new vm.Script(wrapper)
    const resultPromise = script.runInContext(state.vmContext, { timeout: PLUGIN_TIMEOUT_MS })

    let timeoutId: ReturnType<typeof setTimeout>
    const timeoutPromise = new Promise<void>((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error('Plugin execution timed out')),
        PLUGIN_TIMEOUT_MS
      )
    })

    try {
      await Promise.race([resultPromise, timeoutPromise])
    } finally {
      clearTimeout(timeoutId!)
    }

    state.hasDisposer =
      typeof (state.vmContext as unknown as { __disposer: unknown }).__disposer === 'function'

    send({ type: 'EXECUTE_SUCCESS', requestId, hasDisposer: state.hasDisposer })
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err)
    send({ type: 'EXECUTE_ERROR', requestId, error: m })
  }
}

function disposePlugin(msg: DisposeMessage): void {
  const { requestId, pluginId } = msg
  const state = pluginStates.get(pluginId)
  if (!state) {
    send({ type: 'DISPOSE_DONE', requestId, ok: true })
    return
  }

  let disposeError: string | undefined

  // Clear all tracked timers
  for (const id of state.timers) clearTimeout(id as Parameters<typeof clearTimeout>[0])
  for (const id of state.intervals)
    clearInterval(id as Parameters<typeof clearInterval>[0])
  state.timers.clear()
  state.intervals.clear()

  // Run plugin's own disposer if it registered one
  const disposer = (state.vmContext as unknown as { __disposer: unknown }).__disposer
  if (typeof disposer === 'function') {
    try {
      const script = new vm.Script('if (typeof __disposer === "function") __disposer()')
      script.runInContext(state.vmContext, { timeout: DISPOSER_TIMEOUT_MS })
    } catch (err) {
      disposeError = err instanceof Error ? err.message : String(err)
    }
  }

  pluginStates.delete(pluginId)
  send({ type: 'DISPOSE_DONE', requestId, ok: disposeError === undefined, error: disposeError })
}

// ─── Message router ──────────────────────────────────────────────────────────

port.on('message', (msg: unknown) => {
  if (!msg || typeof msg !== 'object') return
  const m = msg as Record<string, unknown>

  switch (m.type) {
    case 'WIN_ACTION_REPLY': {
      const reply = m as unknown as WinActionReply
      const resolver = pendingWinActionReplies.get(reply.replyId)
      if (resolver) {
        pendingWinActionReplies.delete(reply.replyId)
        resolver(reply)
      }
      return
    }

    case 'WINDOW_DESTROYED': {
      const { winId } = m as { winId: string }
      if (typeof winId === 'string') destroyedWindows.add(winId)
      return
    }

    case 'EXECUTE': {
      void executePlugin(m as unknown as ExecuteMessage)
      return
    }

    case 'DISPOSE': {
      disposePlugin(m as unknown as DisposeMessage)
      return
    }

    case 'SHUTDOWN': {
      // Best-effort cleanup; the process will exit anyway
      for (const state of pluginStates.values()) {
        for (const id of state.timers) clearTimeout(id as Parameters<typeof clearTimeout>[0])
        for (const id of state.intervals)
          clearInterval(id as Parameters<typeof clearInterval>[0])
      }
      pluginStates.clear()
      return
    }
  }
})

send({ type: 'READY' })
