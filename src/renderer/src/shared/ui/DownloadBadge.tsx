import React from 'react'
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

interface DownloadBadgeProps {
  status?: 'pending' | 'downloading' | 'completed' | 'error'
  progress?: { cached: number; total: number }
  className?: string
}

export const DownloadBadge: React.FC<DownloadBadgeProps> = ({
  status,
  progress,
  className = ''
}) => {
  if (!status) return null

  switch (status) {
    case 'downloading':
      const percent =
        progress && progress.total > 0 ? Math.round((progress.cached / progress.total) * 100) : 0
      return (
        <div className={`flex items-center gap-1 text-blue-400 font-medium text-xs ${className}`}>
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>{percent}%</span>
        </div>
      )
    case 'completed':
      return (
        <div className={`flex items-center gap-1 text-green-400 ${className}`}>
          <CheckCircle className="w-4 h-4" />
        </div>
      )
    case 'error':
      return (
        <div className={`flex items-center gap-1 text-red-500 ${className}`}>
          <AlertCircle className="w-4 h-4" />
        </div>
      )
    default:
      return null
  }
}
