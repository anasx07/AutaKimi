import { useState, useEffect, useCallback } from 'react'

export function calculateZoom(
  currentZoom: number,
  delta: number,
  minZoom = 0.5,
  maxZoom = 4
): number {
  const newZoom = Number((currentZoom + delta).toFixed(2))
  return Math.max(minZoom, Math.min(newZoom, maxZoom))
}

export const useZoom = (
  scrollRef: React.RefObject<HTMLElement | null>,
  minZoom = 0.5,
  maxZoom = 4,
  step = 0.1
) => {
  const [zoomLevel, setZoomLevel] = useState(1)

  const resetZoom = useCallback(() => {
    setZoomLevel(1)
  }, [])

  // Ctrl + Wheel to zoom in / out
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        setZoomLevel((prev) => {
          // e.deltaY > 0 means scroll down -> zoom out
          const delta = e.deltaY > 0 ? -step : step
          return calculateZoom(prev, delta, minZoom, maxZoom)
        })
      }
    }

    // Must be passive: false to prevent default
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [scrollRef, minZoom, maxZoom, step])

  // Keyboard shortcuts: Ctrl+0 (reset 100%), Ctrl+=/Ctrl++ (zoom in), Ctrl+- (zoom out)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName || '')) return

      if (e.ctrlKey || e.metaKey) {
        // Ctrl+0 or Cmd+0: Reset zoom to 100%
        if (e.key === '0' || e.code === 'Digit0' || e.code === 'Numpad0') {
          e.preventDefault()
          resetZoom()
          return
        }

        // Ctrl+= or Ctrl++: Zoom in
        if (e.key === '=' || e.key === '+' || e.code === 'Equal' || e.code === 'NumpadAdd') {
          e.preventDefault()
          setZoomLevel((prev) => calculateZoom(prev, step, minZoom, maxZoom))
          return
        }

        // Ctrl+-: Zoom out
        if (e.key === '-' || e.code === 'Minus' || e.code === 'NumpadSubtract') {
          e.preventDefault()
          setZoomLevel((prev) => calculateZoom(prev, -step, minZoom, maxZoom))
          return
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [minZoom, maxZoom, step, resetZoom])

  return { zoomLevel, setZoomLevel, resetZoom }
}
