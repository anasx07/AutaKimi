import { useState, useEffect } from 'react'

interface AutoScrollShortcuts {
  pause: string
  reverse: string
  boost: string
  slow: string
  toggle: string
}

export const useKeyboardControls = (
  autoScrollEnabled: boolean,
  setAutoScrollEnabled: (enabled: boolean) => void,
  autoScrollShortcuts: AutoScrollShortcuts
) => {
  const [isKbdPaused, setIsKbdPaused] = useState(false)
  const [isKbdReversing, setIsKbdReversing] = useState(false)
  const [isKbdBoosted, setIsKbdBoosted] = useState(false)
  const [isKbdSlowed, setIsKbdSlowed] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName || '')) return

      // Prevent repeat firing for toggle/pause keys
      if (e.repeat && (e.code === autoScrollShortcuts.pause || e.code === autoScrollShortcuts.toggle)) return
      
      if (e.code === autoScrollShortcuts.pause) {
         e.preventDefault()
         setIsKbdPaused(true)
      }
      if (e.code === autoScrollShortcuts.reverse) setIsKbdReversing(true)
      if (e.code === autoScrollShortcuts.boost) setIsKbdBoosted(true)
      if (e.code === autoScrollShortcuts.slow) setIsKbdSlowed(true)
      if (e.code === autoScrollShortcuts.toggle) setAutoScrollEnabled(!autoScrollEnabled)
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === autoScrollShortcuts.pause) setIsKbdPaused(false)
      if (e.code === autoScrollShortcuts.reverse) setIsKbdReversing(false)
      if (e.code === autoScrollShortcuts.boost) setIsKbdBoosted(false)
      if (e.code === autoScrollShortcuts.slow) setIsKbdSlowed(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [autoScrollEnabled, autoScrollShortcuts, setAutoScrollEnabled])

  return {
    isKbdPaused,
    isKbdReversing,
    isKbdBoosted,
    isKbdSlowed
  }
}
