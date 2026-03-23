import { useEffect } from 'react'
import { useUIStore } from '@renderer/shared/model'
import { AlertCircle, X } from 'lucide-react'

export default function Toast() {
  const { globalError, setGlobalError } = useUIStore()

  useEffect(() => {
    if (!globalError) return
    const timer = setTimeout(() => setGlobalError(null), 5000)
    return () => clearTimeout(timer)
  }, [globalError, setGlobalError])

  if (!globalError) return null

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex items-center gap-2 px-4 py-3 rounded-lg bg-destructive text-destructive-foreground shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-300">
      <AlertCircle className="h-4 w-4" />
      <p className="text-sm font-medium">{globalError}</p>
      <button onClick={() => setGlobalError(null)} className="ml-2 hover:bg-white/10 rounded p-0.5">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
