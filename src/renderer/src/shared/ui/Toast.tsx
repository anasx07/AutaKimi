import { useEffect } from 'react'
import { useUIStore, Toast as ToastType } from '@renderer/shared/model'
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react'
import { cn } from '@renderer/shared/lib/utils'
import { isMobile } from '@renderer/shared/platform'

export default function ToastContainer() {
  const { toasts } = useUIStore()
  const mobile = isMobile()

  if (toasts.length === 0) return null

  return (
    <div
      className={cn(
        'fixed z-[9999] flex flex-col gap-2 pointer-events-none transition-all duration-500',
        mobile
          ? 'top-[calc(env(safe-area-inset-top)+1rem)] left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-md'
          : 'bottom-4 right-4'
      )}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} mobile={mobile} />
      ))}
    </div>
  )
}

function ToastItem({ toast, mobile }: { toast: ToastType; mobile: boolean }) {
  const { removeToast } = useUIStore()

  useEffect(() => {
    const timer = setTimeout(() => removeToast(toast.id), toast.duration || 5000)
    return () => clearTimeout(timer)
  }, [toast.id, toast.duration, removeToast])

  const icons = {
    error: <AlertCircle className="h-5 w-5 text-destructive" />,
    success: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
    warn: <AlertTriangle className="h-5 w-5 text-amber-500" />,
    info: <Info className="h-5 w-5 text-blue-500" />
  }

  const styles = {
    error: 'border-destructive/20 bg-destructive/10 text-destructive-foreground',
    success: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-50 text-foreground',
    warn: 'border-amber-500/20 bg-amber-500/10 text-amber-50 text-foreground',
    info: 'border-blue-500/20 bg-blue-500/10 text-blue-50 text-foreground'
  }

  return (
    <div
      className={cn(
        'pointer-events-auto flex items-start gap-3 px-4 py-3 min-w-[300px] w-full max-w-md rounded-xl border backdrop-blur-xl shadow-2xl animate-in fade-in duration-300',
        mobile ? 'slide-in-from-top-10' : 'slide-in-from-right-10',
        styles[toast.type]
      )}
    >
      <div className="mt-0.5">{icons[toast.type]}</div>
      <div className="flex-1 flex flex-col gap-0.5">
        {toast.title && <h4 className="text-sm font-bold leading-none">{toast.title}</h4>}
        <p className="text-sm font-medium leading-relaxed opacity-90">{toast.message}</p>
      </div>
      <button
        onClick={() => removeToast(toast.id)}
        className="ml-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-full p-1 transition-colors self-start"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
