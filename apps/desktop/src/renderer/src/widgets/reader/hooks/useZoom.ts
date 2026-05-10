import { useState, useEffect } from 'react'

export const useZoom = (
  scrollRef: React.RefObject<HTMLElement | null>,
  minZoom = 0.5,
  maxZoom = 4,
  step = 0.1
) => {
  const [zoomLevel, setZoomLevel] = useState(1)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        setZoomLevel((prev) => {
          // e.deltaY > 0 means scroll down -> zoom out
          const newZoom = prev + (e.deltaY > 0 ? -step : step)
          return Math.max(minZoom, Math.min(newZoom, maxZoom))
        })
      }
    }

    // Must be passive: false to prevent default
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [scrollRef, minZoom, maxZoom, step])

  return { zoomLevel, setZoomLevel }
}
