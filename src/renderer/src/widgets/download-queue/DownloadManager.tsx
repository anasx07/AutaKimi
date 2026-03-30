import { useDownloadStore } from '@renderer/shared/model'
import { Sheet, Button } from '@renderer/shared/ui'
import {
  Loader2,
  Download,
  XCircle,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Clock,
  ChevronDown,
  Zap,
  History,
  Ban,
  Activity
} from 'lucide-react'
import { DataService } from '@renderer/shared/api'

interface DownloadManagerProps {
  isOpen: boolean
  onClose: () => void
}

export function DownloadManager({ isOpen, onClose }: DownloadManagerProps): React.JSX.Element {
  const {
    activeTasks,
    downloadQueue,
    isFetchingPages,
    removeFromDownloadQueue,
    clearFinishedTasks,
    setIsFetchingPages,
    clearDownloadQueue
  } = useDownloadStore()

  const activeCount = Object.keys(activeTasks).length
  const queueCount = downloadQueue.length

  const handleCancel = async (mangaId: string, chapterId: string): Promise<void> => {
    try {
      await DataService.download.cancel({ mangaId, chapterId })
    } catch (e) {
      console.error('[DownloadManager] Cancel failed:', e)
    }
  }

  const handleResetProcessor = (): void => {
    setIsFetchingPages(false)
  }

  const activeItems = Object.values(activeTasks).sort((a, b) => {
    if (a.status === 'downloading' && b.status !== 'downloading') return -1
    if (a.status !== 'downloading' && b.status === 'downloading') return 1
    return 0
  })

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title="Download Manager">
      <div className="space-y-8 pb-10">
        {/* Statistics / Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="relative overflow-hidden bg-gradient-to-br from-primary/20 via-primary/5 to-transparent border border-primary/20 rounded-3xl p-5 flex flex-col items-center justify-center space-y-1 group hover:border-primary/40 transition-all duration-500">
            <div className="absolute -right-4 -top-4 w-20 h-20 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-all duration-500" />
            <span className="text-3xl font-black text-primary drop-shadow-sm">{activeCount}</span>
            <span className="text-[10px] uppercase tracking-[0.2em] font-black text-primary/60">
              Active
            </span>
          </div>
          <div className="relative overflow-hidden bg-gradient-to-br from-secondary/50 via-secondary/20 to-transparent border border-border/50 rounded-3xl p-5 flex flex-col items-center justify-center space-y-1 group hover:border-border transition-all duration-500">
            <div className="absolute -right-4 -top-4 w-20 h-20 bg-foreground/5 rounded-full blur-2xl group-hover:bg-foreground/10 transition-all duration-500" />
            <span className="text-3xl font-black text-foreground/80 tabular-nums">
              {queueCount}
            </span>
            <span className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground/80">
              In Queue
            </span>
          </div>
        </div>

        {/* Processor Status Station */}
        <div className="relative group transition-all duration-500">
          <div
            className={`flex items-center justify-between border rounded-3xl p-5 transition-all duration-700 ${
              isFetchingPages
                ? 'bg-amber-500/5 border-amber-500/30 shadow-[0_0_30px_-10px_rgba(245,158,11,0.2)]'
                : 'bg-secondary/20 border-border/50'
            }`}
          >
            <div className="flex items-center gap-4">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-700 ${
                  isFetchingPages
                    ? 'bg-amber-500/20 text-amber-500 animate-pulse'
                    : 'bg-green-500/10 text-green-500'
                }`}
              >
                {isFetchingPages ? (
                  <Zap className="h-6 w-6 fill-amber-500/20" />
                ) : (
                  <Activity className="h-6 w-6" />
                )}
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                  Processor
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isFetchingPages ? 'bg-amber-500 animate-ping' : 'bg-green-500'
                    }`}
                  />
                </p>
                <p className="text-[11px] text-muted-foreground font-medium mt-0.5">
                  {isFetchingPages ? 'Preparing next download...' : 'System Idle • Waiting for tasks'}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-xl text-[10px] font-bold uppercase tracking-wider border-border/50 hover:bg-background shadow-sm active:scale-95 transition-all"
              onClick={handleResetProcessor}
            >
              Reset
            </Button>
          </div>
        </div>

        {/* Active & Finished Tasks */}
        <section className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-muted-foreground flex items-center gap-2">
              <Download className="h-3.5 w-3.5" />
              Processing Tasks
            </h3>
            {activeCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[10px] font-black uppercase tracking-wider px-3 rounded-full hover:bg-destructive/10 hover:text-destructive transition-all"
                onClick={clearFinishedTasks}
              >
                <History className="h-3 w-3 mr-1.5" />
                Clear Finished
              </Button>
            )}
          </div>

          <div className="space-y-4">
            {activeItems.length === 0 ? (
              <div className="text-center py-16 bg-gradient-to-b from-secondary/20 to-transparent rounded-[2.5rem] border border-dashed border-border/40 relative overflow-hidden group">
                <div className="absolute inset-0 bg-primary/2 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                <Clock className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-xs text-muted-foreground font-semibold italic">
                  No active download processes
                </p>
              </div>
            ) : (
              activeItems.map((task, idx) => (
                <div
                  key={`${task.mangaId}:${task.chapterId}`}
                  className="bg-card/40 backdrop-blur-md border border-border/40 rounded-3xl p-5 space-y-4 transition-all hover:border-primary/40 hover:bg-card/60 hover:shadow-xl hover:shadow-primary/5 group relative overflow-hidden animate-in fade-in slide-in-from-right-4 duration-500"
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
                            task.status === 'downloading'
                              ? 'bg-primary/10 text-primary'
                              : task.status === 'completed'
                                ? 'bg-green-500/10 text-green-500'
                                : 'bg-destructive/10 text-destructive'
                          }`}
                        >
                          {task.status === 'downloading' ? (
                            <Loader2 className="h-4 w-4 animate-[spin_2s_linear_infinite]" />
                          ) : task.status === 'completed' ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : (
                            <AlertCircle className="h-4 w-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <span className="font-bold text-sm truncate block">
                            {task.chapterId.split('/').pop()?.replace(/[-_]/g, ' ')}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block mt-0.5">
                            {task.status}
                          </span>
                        </div>
                      </div>
                      {task.error && (
                        <div className="mt-3 p-2 bg-destructive/5 rounded-xl border border-destructive/10">
                          <p className="text-[10px] text-destructive font-black leading-tight">
                            {task.error}
                          </p>
                        </div>
                      )}
                    </div>
                    {task.status === 'downloading' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-2xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0 transition-all active:scale-90"
                        onClick={() => handleCancel(task.mangaId, task.chapterId)}
                      >
                        <XCircle className="h-5 w-5" />
                      </Button>
                    )}
                  </div>

                  {task.status === 'downloading' && (
                    <div className="space-y-2.5">
                      <div className="h-2 w-full bg-secondary/50 rounded-full overflow-hidden relative">
                        <div
                          className="h-full bg-primary transition-all duration-700 rounded-full shadow-[0_0_15px_rgba(var(--primary),0.6)] animate-pulse"
                          style={{ width: `${(task.cached / (task.total || 1)) * 100}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-[10px] font-black text-muted-foreground tabular-nums tracking-wider px-1">
                        <span className="flex items-center gap-1.5">
                          <Download className="h-3 w-3" />
                          {task.cached} <span className="text-muted-foreground/40">/</span>{' '}
                          {task.total} PAGES
                        </span>
                        <div className="bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                          {Math.round((task.cached / (task.total || 1)) * 100)}%
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        {/* Queue Section */}
        {queueCount > 0 && (
          <section className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-muted-foreground flex items-center gap-2">
                <ChevronDown className="h-3.5 w-3.5" />
                Up Next ({queueCount})
              </h3>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[10px] font-black uppercase tracking-wider px-3 rounded-full hover:bg-destructive/10 hover:text-destructive transition-all"
                onClick={clearDownloadQueue}
              >
                <Ban className="h-3 w-3 mr-1.5" />
                Cancel All
              </Button>
            </div>
            <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {downloadQueue.map((item, idx) => (
                <div
                  key={item.chapter.id}
                  className="group/item flex items-center justify-between p-4 bg-secondary/20 hover:bg-secondary/40 rounded-2xl border border-border/30 hover:border-border transition-all duration-300 animate-in fade-in slide-in-from-right-2"
                  style={{ animationDelay: `${idx * 30}ms` }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold truncate tracking-tight text-foreground/90">
                      {item.chapter.title || `Chapter ${item.chapter.number}`}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px] text-muted-foreground uppercase font-black tracking-widest bg-background/50 px-1.5 py-0.5 rounded-md border border-border/30">
                        {item.type}
                      </span>
                      <span className="text-[9px] text-primary uppercase font-black truncate max-w-[150px]">
                        {item.extension}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-xl opacity-0 group-hover/item:opacity-100 transition-all text-muted-foreground hover:bg-destructive/10 hover:text-destructive active:scale-90"
                    onClick={() => removeFromDownloadQueue(item.chapter.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </Sheet>
  )
}
