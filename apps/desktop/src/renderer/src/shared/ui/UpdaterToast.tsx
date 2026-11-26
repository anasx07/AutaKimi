import {
  Download,
  RefreshCcw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X
} from 'lucide-react'
import { useUIStore, useLibraryStore } from '@renderer/shared/model'
import { usePipPlayerStore } from '@renderer/app/components/pipPlayerStore'
import { DataService } from '@renderer/shared/api'
import { Button } from './Button'
import { cn } from '@renderer/shared/lib/utils'

export function UpdaterToast(): React.JSX.Element | null {
  const {
    updateStatus,
    updateVersion,
    updateProgress,
    updateError,
    updateDismissed,
    updateCheckManual,
    isWindowFullscreen,
    setUpdateStatus,
    setUpdateDismissed
  } = useUIStore()

  const { selectedManga, activeChapter } = useLibraryStore()
  const hasPipSession = usePipPlayerStore((s) => Boolean(s.pipSession))
  const isMiniPipVisible = hasPipSession && !(selectedManga?.mediaType === 'anime' && activeChapter)

  // Suppress update toast completely while player/window is in fullscreen
  if (isWindowFullscreen) return null
  if (updateStatus === 'idle') return null
  if (updateStatus === 'downloaded' && updateDismissed) return null
  // Automatic startup checks stay quiet in the background until the update is ready to install
  if (!updateCheckManual && updateStatus !== 'downloaded') return null

  const percent = updateProgress?.percent ? Math.round(updateProgress.percent) : 0

  const renderIcon = (): React.JSX.Element | null => {
    switch (updateStatus) {
      case 'checking':
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />
      case 'available':
      case 'downloading':
        return <Download className="h-4 w-4 text-primary animate-pulse" />
      case 'downloaded':
        return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />
      default:
        return null
    }
  }

  const handleClose = (): void => {
    if (updateStatus === 'downloaded') {
      setUpdateDismissed(true)
    } else {
      setUpdateStatus('idle')
    }
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'fixed right-5 z-[100] w-[340px] max-w-[calc(100vw-2.5rem)] rounded-2xl bg-card/95 backdrop-blur-xl border border-border shadow-2xl p-4 animate-in fade-in slide-in-from-bottom-4 duration-300 transition-[bottom]',
        isMiniPipVisible ? 'bottom-[260px]' : 'bottom-5',
        updateStatus === 'error' && 'border-destructive/40',
        updateStatus === 'downloaded' && 'border-emerald-500/30'
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex items-center justify-center w-9 h-9 rounded-xl shrink-0 mt-0.5',
            updateStatus === 'downloaded'
              ? 'bg-emerald-500/15'
              : updateStatus === 'error'
                ? 'bg-destructive/15'
                : 'bg-primary/15'
          )}
        >
          {renderIcon()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">
                {updateStatus === 'downloaded'
                  ? 'Update Ready'
                  : updateStatus === 'error'
                    ? 'Update Check Failed'
                    : 'Software Update'}
              </p>
              {updateVersion && (
                <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/25 shrink-0">
                  v{updateVersion}
                </span>
              )}
            </div>

            {updateStatus !== 'downloading' && (
              <button
                type="button"
                onClick={handleClose}
                className="p-1 -mr-1 -mt-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors shrink-0"
                title={updateStatus === 'downloaded' ? 'Later' : 'Close'}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="mt-1 text-xs text-muted-foreground leading-relaxed">
            {updateStatus === 'checking' && 'Checking for updates...'}
            {updateStatus === 'available' && 'New update found. Starting download...'}
            {updateStatus === 'downloading' && (
              <div className="flex flex-col gap-1.5 mt-1.5">
                <div className="flex justify-between text-[11px]">
                  <span>Downloading update...</span>
                  <span className="font-mono font-semibold text-foreground">{percent}%</span>
                </div>
                <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300 ease-out"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            )}
            {updateStatus === 'downloaded' &&
              'Restart to update now, or install automatically when you quit.'}
            {updateStatus === 'error' && (
              <span className="line-clamp-2">
                {updateError || 'Unable to check for updates right now.'}
              </span>
            )}
          </div>

          {updateStatus === 'downloaded' && (
            <div className="flex items-center gap-2 mt-3">
              <Button
                size="sm"
                onClick={() => DataService.installUpdate()}
                className="h-8 px-3 text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                Restart & Update
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setUpdateDismissed(true)}
                className="h-8 px-3 text-xs text-muted-foreground hover:text-foreground"
              >
                Later
              </Button>
            </div>
          )}

          {updateStatus === 'error' && (
            <div className="flex items-center gap-2 mt-3">
              <Button
                size="sm"
                variant="outline"
                onClick={() => DataService.checkForUpdates()}
                className="h-7 px-2.5 text-xs gap-1.5"
              >
                <RefreshCcw className="h-3 w-3" />
                Retry
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
