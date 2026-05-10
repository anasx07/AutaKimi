import { useState, useRef } from 'react'

export const useDragToScroll = (
  scrollRef: React.RefObject<HTMLDivElement | null>,
  dragToScroll: boolean,
  isHorizontalContinuous: boolean
) => {
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0, scrollL: 0, scrollT: 0 })
  const dragMoved = useRef(false)

  const onMouseDown = (e: React.MouseEvent) => {
    if (!dragToScroll || e.button !== 0) return
    setIsDragging(true)
    dragMoved.current = false
    dragStart.current = {
      x: e.pageX - (scrollRef.current?.offsetLeft || 0),
      y: e.pageY - (scrollRef.current?.offsetTop || 0),
      scrollL: scrollRef.current?.scrollLeft || 0,
      scrollT: scrollRef.current?.scrollTop || 0
    }
  }

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return
    e.preventDefault()
    const x = e.pageX - (scrollRef.current.offsetLeft || 0)
    const y = e.pageY - (scrollRef.current.offsetTop || 0)
    const walkX = (x - dragStart.current.x) * 1.5
    const walkY = (y - dragStart.current.y) * 1.5

    // Threshold to detect if it was a click or a move
    if (Math.abs(walkX) > 5 || Math.abs(walkY) > 5) {
      dragMoved.current = true
    }

    if (isHorizontalContinuous) {
      scrollRef.current.scrollLeft = dragStart.current.scrollL - walkX
    } else {
      scrollRef.current.scrollTop = dragStart.current.scrollT - walkY
    }
  }

  const onMouseUp = () => setIsDragging(false)
  const onMouseLeave = () => setIsDragging(false)

  return {
    isDragging,
    dragMoved,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onMouseLeave
  }
}
