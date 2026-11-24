import { memo } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@renderer/shared/ui'

export interface ServerItem {
  name: string
  url: string
  type?: 'hls' | 'mp4' | 'embed'
  headers?: Record<string, string>
  status?: 'alive' | 'dead' | 'checking' | 'untested'
  pingMs?: number
  error?: string
}

export interface ServerSelectorProps {
  servers: (ServerItem | string)[]
  activeServerIdx: number
  onSelectServer: (idx: number) => void
  onSwitchServer: () => void
  tone?: 'overlay' | 'surface'
}

export const ServerSelector = memo(function ServerSelector({
  servers,
  activeServerIdx,
  onSelectServer,
  onSwitchServer,
  tone = 'overlay'
}: ServerSelectorProps) {
  if (servers.length <= 1) return null

  const isSurface = tone === 'surface'

  return (
    <div className="flex items-center gap-1.5">
      <div
        className={
          isSurface
            ? 'flex items-center bg-secondary/70 rounded-full px-3.5 py-1.5 border border-border'
            : 'flex items-center bg-white/5 backdrop-blur-md rounded-full px-4 py-1.5 border border-white/10'
        }
      >
        <span
          className={
            isSurface
              ? 'text-[10px] text-muted-foreground font-bold mr-2.5 uppercase tracking-tighter'
              : 'text-[10px] text-white/40 font-bold mr-3 uppercase tracking-tighter'
          }
        >
          Server
        </span>
        <select
          value={activeServerIdx}
          onChange={(e) => {
            const idx = parseInt(e.target.value, 10)
            onSelectServer(idx)
          }}
          className="bg-transparent text-xs text-primary font-bold outline-none cursor-pointer min-w-[80px]"
        >
          {servers.map((srv: any, i) => {
            const name = typeof srv === 'object' ? srv.name : `Server ${i + 1}`
            const isAlive = srv.status === 'alive'
            const isDead = srv.status === 'dead'
            const isChecking = srv.status === 'checking'
            const isDirect = srv.type === 'hls' || srv.type === 'mp4'
            const badge = isAlive
              ? isDirect
                ? '🟢⚡ '
                : '🟢 '
              : isDead
                ? '🔴 '
                : isChecking
                  ? '⏳ '
                  : isDirect
                    ? '⚡ '
                    : '🌐 '
            const ping = srv.pingMs ? ` (${srv.pingMs}ms)` : ''
            const displayName = `${badge}${name}${ping}`
            return (
              <option key={i} value={i} className="bg-neutral-900 text-white">
                {displayName}
              </option>
            )
          })}
        </select>
      </div>
      <Button
        variant="ghost"
        size="icon"
        title="Mirror/Switch to Next Working Server"
        onClick={onSwitchServer}
        className="h-9 w-9 text-primary/60 hover:text-primary hover:bg-primary/10 rounded-full"
      >
        <RefreshCw className="h-4.5 w-4.5" />
      </Button>
    </div>
  )
})
