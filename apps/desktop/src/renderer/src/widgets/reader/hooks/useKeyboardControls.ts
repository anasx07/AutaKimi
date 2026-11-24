import { useState, useEffect, useRef } from 'react'
import { ReadingMode } from '@renderer/shared/model'

interface AutoScrollShortcuts {
  pause: string
  reverse: string
  boost: string
  slow: string
  toggle: string
}

export interface UseKeyboardControlsOptions {
  readingMode?: ReadingMode
  onNextPage?: () => void
  onPrevPage?: () => void
}

export function getPagedNavigationAction(
  readingMode: string | undefined,
  event: { key: string; code: string; shiftKey?: boolean }
): 'next' | 'prev' | null {
  if (!readingMode?.startsWith('paged-')) return null

  const isPagedRtl = readingMode === 'paged-rtl' || readingMode === 'paged-double-rtl'
  const isPagedVertical = readingMode === 'paged-vertical'

  const isRight =
    event.key === 'ArrowRight' ||
    event.code === 'ArrowRight' ||
    event.code === 'KeyD' ||
    event.key === 'd' ||
    event.key === 'D'

  const isLeft =
    event.key === 'ArrowLeft' ||
    event.code === 'ArrowLeft' ||
    event.code === 'KeyA' ||
    event.key === 'a' ||
    event.key === 'A'

  const isDown =
    event.key === 'ArrowDown' ||
    event.code === 'ArrowDown' ||
    event.code === 'KeyS' ||
    event.key === 's' ||
    event.key === 'S'

  const isUp =
    event.key === 'ArrowUp' ||
    event.code === 'ArrowUp' ||
    event.code === 'KeyW' ||
    event.key === 'w' ||
    event.key === 'W'

  const isPageDown = event.key === 'PageDown' || event.code === 'PageDown'
  const isPageUp = event.key === 'PageUp' || event.code === 'PageUp'
  const isSpace = event.key === ' ' || event.code === 'Space'

  // Determine Next Page
  const isNext =
    (isPagedRtl && (isLeft || isPageDown || (isSpace && !event.shiftKey))) ||
    (!isPagedRtl && !isPagedVertical && (isRight || isPageDown || (isSpace && !event.shiftKey))) ||
    (isPagedVertical && (isDown || isRight || isPageDown || (isSpace && !event.shiftKey)))

  // Determine Previous Page
  const isPrev =
    (isPagedRtl && (isRight || isPageUp || (isSpace && event.shiftKey))) ||
    (!isPagedRtl && !isPagedVertical && (isLeft || isPageUp || (isSpace && event.shiftKey))) ||
    (isPagedVertical && (isUp || isLeft || isPageUp || (isSpace && event.shiftKey)))

  if (isNext) return 'next'
  if (isPrev) return 'prev'
  return null
}

export const useKeyboardControls = (
  autoScrollEnabled: boolean,
  setAutoScrollEnabled: (enabled: boolean) => void,
  autoScrollShortcuts: AutoScrollShortcuts,
  options?: UseKeyboardControlsOptions
) => {
  const [isKbdPaused, setIsKbdPaused] = useState(false)
  const [isKbdReversing, setIsKbdReversing] = useState(false)
  const [isKbdBoosted, setIsKbdBoosted] = useState(false)
  const [isKbdSlowed, setIsKbdSlowed] = useState(false)

  const readingModeRef = useRef(options?.readingMode)
  readingModeRef.current = options?.readingMode

  const onNextPageRef = useRef(options?.onNextPage)
  onNextPageRef.current = options?.onNextPage

  const onPrevPageRef = useRef(options?.onPrevPage)
  onPrevPageRef.current = options?.onPrevPage

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName || '')) return

      const readingMode = readingModeRef.current
      const isPaged = readingMode?.startsWith('paged-')

      // Handle page turning in Paged modes (LTR, RTL, Double-Page, Vertical)
      if (isPaged) {
        if (e.repeat) return

        const action = getPagedNavigationAction(readingMode, e)
        if (action === 'next') {
          e.preventDefault()
          onNextPageRef.current?.()
          return
        }
        if (action === 'prev') {
          e.preventDefault()
          onPrevPageRef.current?.()
          return
        }
      }

      // Continuous / Auto-Scroll Shortcuts
      // Prevent repeat firing for toggle/pause keys
      if (
        e.repeat &&
        (e.code === autoScrollShortcuts.pause || e.code === autoScrollShortcuts.toggle)
      )
        return

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

    const handleBlur = () => {
      setIsKbdPaused(false)
      setIsKbdReversing(false)
      setIsKbdBoosted(false)
      setIsKbdSlowed(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleBlur)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
    }
  }, [autoScrollEnabled, autoScrollShortcuts, setAutoScrollEnabled])

  return {
    isKbdPaused,
    isKbdReversing,
    isKbdBoosted,
    isKbdSlowed
  }
}
