import { motion, AnimatePresence } from 'framer-motion'
import { Shield, Loader2, X } from 'lucide-react'
import { useUIStore } from '@renderer/shared/model'

export function CfBypassOverlay() {
  const { isCfBypassing, cfDomain, setIsCfBypassing } = useUIStore()

  return (
    <AnimatePresence>
      {isCfBypassing && (
        <motion.div
          initial={{ y: -50, opacity: 0, x: '-50%' }}
          animate={{ y: 0, opacity: 1, x: '-50%' }}
          exit={{ y: -50, opacity: 0, x: '-50%' }}
          className="fixed top-20 left-1/2 z-[100] w-auto pointer-events-none"
        >
          <div className="flex items-center gap-3 px-4 py-2 bg-background/80 backdrop-blur-xl border border-primary/20 rounded-full shadow-lg shadow-primary/10 pointer-events-auto">
            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 bg-primary/20 blur-lg rounded-full animate-pulse" />
              <div className="relative bg-primary/10 p-1.5 rounded-full border border-primary/20">
                <Shield className="h-4 w-4 text-primary" />
              </div>
            </div>

            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary truncate max-w-[150px]">
                Solving Protection
              </span>
              <span className="text-[9px] text-muted-foreground font-medium truncate max-w-[150px]">
                {cfDomain || 'Site'}
              </span>
            </div>

            <div className="h-4 w-[1px] bg-border mx-1" />

            <div className="flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin text-primary opacity-60" />
              <button
                onClick={() => setIsCfBypassing(false)}
                className="p-1 hover:bg-secondary rounded-full transition-colors group"
                title="Cancel Bypass"
              >
                <X className="h-3 w-3 text-muted-foreground group-hover:text-foreground" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
