import { useEffect, useRef } from 'react'

export const useAutoScroll = (
  scrollRef: React.RefObject<HTMLDivElement | null>,
  autoScrollEnabled: boolean,
  autoScrollSpeed: number,
  isInfiniteScroll: boolean,
  isDragging: boolean,
  isKbdPaused: boolean,
  isKbdReversing: boolean,
  isKbdBoosted: boolean,
  isKbdSlowed: boolean,
  isHorizontal: boolean,
  isRtl: boolean
) => {
  const autoScrollRef = useRef<number | null>(null)
  const preciseScrollTop = useRef(0)
  const preciseScrollLeft = useRef(0)

  // Sync preciseScrollTop with actual scrollTop on manual scroll
  useEffect(() => {
    const handleScroll = () => {
      if (scrollRef.current) {
        preciseScrollTop.current = scrollRef.current.scrollTop
        preciseScrollLeft.current = scrollRef.current.scrollLeft
      }
    }
    const ref = scrollRef.current
    ref?.addEventListener('scroll', handleScroll, { passive: true })
    return () => ref?.removeEventListener('scroll', handleScroll)
  }, [scrollRef])

  useEffect(() => {
    if (!autoScrollEnabled || !scrollRef.current || !isInfiniteScroll) {
       if (autoScrollRef.current) cancelAnimationFrame(autoScrollRef.current)
       return
    }

    const scroll = () => {
       if (scrollRef.current && !isDragging && !isKbdPaused) {
          let finalStep = autoScrollSpeed * 0.25
          if (isKbdBoosted) finalStep *= 6
          if (isKbdSlowed) finalStep *= 0.3
          if (isKbdReversing) finalStep *= -2
          
          if (isHorizontal) {
            preciseScrollLeft.current += isRtl ? -finalStep : finalStep
            scrollRef.current.scrollLeft = preciseScrollLeft.current
          } else {
            preciseScrollTop.current += finalStep
            scrollRef.current.scrollTop = preciseScrollTop.current
          }
       }
       autoScrollRef.current = requestAnimationFrame(scroll)
    }

    autoScrollRef.current = requestAnimationFrame(scroll)
    return () => {
       if (autoScrollRef.current) cancelAnimationFrame(autoScrollRef.current)
    }
  }, [
    autoScrollEnabled, autoScrollSpeed, isInfiniteScroll, 
    isDragging, isKbdPaused, isKbdReversing, 
    isKbdBoosted, isKbdSlowed, scrollRef, isHorizontal, isRtl
  ])

  return {
    preciseScrollTop,
    preciseScrollLeft
  }
}
