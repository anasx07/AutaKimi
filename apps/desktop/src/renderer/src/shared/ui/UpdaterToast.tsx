import { Download, RefreshCcw, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { useUIStore } from '@renderer/shared/model'
import { DataService } from '@renderer/shared/api'
import { Button } from './Button'
import { cn } from '@renderer/shared/lib/utils'

export function UpdaterToast() {
  const { updateStatus, updateProgress, updateError, setUpdateStatus } = useUIStore()

  if (updateStatus === 'idle') return null

  const renderIcon = () => {
    switch (updateStatus) {
      case 'checking':
        return <Loader2 className="h-5 w-5 animate-spin text-primary" />
      case 'available':
      case 'downloading':
        return <Download className="h-5 w-5 text-primary animate-pulse" />
      case 'downloaded':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />
      case 'error':
        return <AlertCircle className="h-5 w-5 text-destructive" />
      default:
        return null
    }
  }

  const renderContent = () => {
    switch (updateStatus) {
      case 'checking':
        return 'Checking for updates...'
      case 'available':
        return 'Update available! Starting download...'
      case 'downloading':
        const percent = updateProgress?.percent ? Math.round(updateProgress.percent) : 0
        return (
          <div className="flex flex-col gap-1.5 min-w-[200px]">
            <div className="flex justify-between text-xs">
              <span>Downloading update...</span>
              <span className="font-mono">{percent}%</span>
            </div>
            <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300 ease-out"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        )
      case 'downloaded':
        return 'Update ready to install!'
      case 'error':
        return updateError || 'Failed to check for updates'
      default:
        return null
    }
  }

  return (
    <div
      className={cn(
        'fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-4 px-5 py-4 rounded-xl bg-card border border-border shadow-2xl animate-in fade-in slide-in-from-bottom-8 duration-500',
        updateStatus === 'error' && 'border-destructive/50'
      )}
    >
      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
        {renderIcon()}
      </div>

      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-semibold text-foreground">
          {updateStatus === 'downloaded' ? 'Software Update' : 'System Update'}
        </p>
        <div className="text-xs text-muted-foreground">{renderContent()}</div>
      </div>

      {updateStatus === 'downloaded' && (
        <Button
          size="sm"
          onClick={() => DataService.installUpdate()}
          className="ml-2 gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
        >
          <RefreshCcw className="h-3.5 w-3.5" />
          Restart App
        </Button>
      )}

      {(updateStatus === 'error' ||
        ((updateStatus === 'downloaded') === false &&
          updateStatus !== 'downloading' &&
          updateStatus !== 'available' &&
          updateStatus !== 'checking')) && (
        <button
          onClick={() => {
            if (updateStatus === 'error') {
              DataService.checkForUpdates()
            } else {
              setUpdateStatus('idle')
            }
          }}
          className="ml-2 p-1 rounded-md hover:bg-secondary text-muted-foreground transition-colors group"
          title={updateStatus === 'error' ? 'Retry Check' : 'Close'}
        >
          <RefreshCcw
            className={cn(
              'h-4 w-4',
              updateStatus === 'error' && 'group-hover:rotate-180 transition-transform duration-500'
            )}
          />
        </button>
      )}
    </div>
  )
}
