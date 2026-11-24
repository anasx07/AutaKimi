import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AMBIENT_SAMPLE_HEIGHT,
  AMBIENT_SAMPLE_INTERVAL_MS,
  AMBIENT_SAMPLE_WIDTH
} from '@renderer/shared/lib/ambientColors'

export interface UseAmbientGlowOptions {
  enabled: boolean
  videoRef: React.RefObject<HTMLVideoElement | null>
  videoType: 'hls' | 'mp4' | 'embed'
  activeServerUrl?: string
  isPlaying: boolean
}

export interface UseAmbientGlowResult {
  canvasARef: React.RefObject<HTMLCanvasElement | null>
  canvasBRef: React.RefObject<HTMLCanvasElement | null>
  activeBuffer: 'A' | 'B'
  hasVideoFrame: boolean
}

/**
 * Draws the active HTML5 video onto alternating 16x9 offscreen-sized canvases every 2 seconds
 * for smooth GPU cross-fade glow behind the player without triggering cross-origin getImageData
 * SecurityErrors on remote MP4/HLS streams.
 */
export function useAmbientGlow({
  enabled,
  videoRef,
  videoType,
  activeServerUrl,
  isPlaying
}: UseAmbientGlowOptions): UseAmbientGlowResult {
  const canvasARef = useRef<HTMLCanvasElement | null>(null)
  const canvasBRef = useRef<HTMLCanvasElement | null>(null)
  const activeBufferRef = useRef<'A' | 'B'>('A')

  const [activeBuffer, setActiveBuffer] = useState<'A' | 'B'>('A')
  const [hasVideoFrame, setHasVideoFrame] = useState(false)

  useEffect(() => {
    setHasVideoFrame(false)
    activeBufferRef.current = 'A'
    setActiveBuffer('A')
  }, [activeServerUrl, videoType, enabled])

  const captureFrame = useCallback(() => {
    if (!enabled || videoType === 'embed') return
    const video = videoRef.current
    if (!video || video.readyState < 2 || video.videoWidth <= 0 || video.videoHeight <= 0) return

    const nextBuffer = activeBufferRef.current === 'A' ? 'B' : 'A'
    const targetCanvas = nextBuffer === 'A' ? canvasARef.current : canvasBRef.current
    if (!targetCanvas) return

    if (targetCanvas.width !== AMBIENT_SAMPLE_WIDTH) targetCanvas.width = AMBIENT_SAMPLE_WIDTH
    if (targetCanvas.height !== AMBIENT_SAMPLE_HEIGHT) targetCanvas.height = AMBIENT_SAMPLE_HEIGHT

    const ctx = targetCanvas.getContext('2d')
    if (!ctx) return

    try {
      ctx.drawImage(video, 0, 0, AMBIENT_SAMPLE_WIDTH, AMBIENT_SAMPLE_HEIGHT)
      activeBufferRef.current = nextBuffer
      setActiveBuffer(nextBuffer)
      setHasVideoFrame(true)
    } catch {
      // Video stream unavailable for drawImage; retain fallback
    }
  }, [enabled, videoType, videoRef])

  useEffect(() => {
    if (!enabled || videoType === 'embed' || !activeServerUrl) {
      setHasVideoFrame(false)
      return
    }

    const video = videoRef.current
    if (!video) return

    const handleFrameReady = () => captureFrame()
    video.addEventListener('loadeddata', handleFrameReady)
    video.addEventListener('seeked', handleFrameReady)

    if (video.readyState >= 2) {
      captureFrame()
    }

    let timer: ReturnType<typeof setInterval> | null = null
    if (isPlaying) {
      timer = setInterval(captureFrame, AMBIENT_SAMPLE_INTERVAL_MS)
    }

    return () => {
      video.removeEventListener('loadeddata', handleFrameReady)
      video.removeEventListener('seeked', handleFrameReady)
      if (timer) clearInterval(timer)
    }
  }, [enabled, videoType, activeServerUrl, isPlaying, captureFrame, videoRef])

  return {
    canvasARef,
    canvasBRef,
    activeBuffer,
    hasVideoFrame
  }
}
