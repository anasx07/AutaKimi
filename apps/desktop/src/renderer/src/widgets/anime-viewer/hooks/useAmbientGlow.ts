import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AMBIENT_SAMPLE_INTERVAL_MS,
  sampleElementAmbientPalette,
  type AmbientColorPalette
} from '@renderer/shared/lib/ambientColors'

export interface UseAmbientGlowOptions {
  enabled: boolean
  videoRef: React.RefObject<HTMLVideoElement | null>
  videoType: 'hls' | 'mp4' | 'embed'
  activeServerUrl?: string
  isPlaying: boolean
}

/**
 * Periodically samples a tiny 16x9 offscreen canvas from the active HTML5 video every 2s to
 * produce soft directional ambient glow colors, falling back cleanly when streams are tainted.
 */
export function useAmbientGlow({
  enabled,
  videoRef,
  videoType,
  activeServerUrl,
  isPlaying
}: UseAmbientGlowOptions): {
  ambientPalette: AmbientColorPalette | null
  sampleNow: () => void
} {
  const [ambientPalette, setAmbientPalette] = useState<AmbientColorPalette | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const taintedRef = useRef(false)

  // Reset taint tracking whenever stream source changes
  useEffect(() => {
    taintedRef.current = false
    setAmbientPalette(null)
  }, [activeServerUrl, videoType])

  const sampleNow = useCallback(() => {
    if (!enabled || videoType === 'embed' || taintedRef.current) return
    const video = videoRef.current
    if (!video || video.readyState < 2 || video.videoWidth <= 0 || video.videoHeight <= 0) return

    if (!canvasRef.current && typeof document !== 'undefined') {
      canvasRef.current = document.createElement('canvas')
    }

    const { palette, tainted } = sampleElementAmbientPalette(video, canvasRef.current)
    if (tainted) {
      taintedRef.current = true
      setAmbientPalette(null)
      return
    }

    if (palette) {
      setAmbientPalette((prev) => {
        if (
          prev &&
          prev.left === palette.left &&
          prev.center === palette.center &&
          prev.right === palette.right
        ) {
          return prev
        }
        return palette
      })
    }
  }, [enabled, videoType, videoRef])

  useEffect(() => {
    if (!enabled || videoType === 'embed' || !activeServerUrl) {
      setAmbientPalette(null)
      return
    }

    const video = videoRef.current
    if (!video) return

    const handleFrameReady = () => sampleNow()
    video.addEventListener('loadeddata', handleFrameReady)
    video.addEventListener('seeked', handleFrameReady)

    if (video.readyState >= 2) {
      sampleNow()
    }

    let timer: ReturnType<typeof setInterval> | null = null
    if (isPlaying && !taintedRef.current) {
      timer = setInterval(sampleNow, AMBIENT_SAMPLE_INTERVAL_MS)
    }

    return () => {
      video.removeEventListener('loadeddata', handleFrameReady)
      video.removeEventListener('seeked', handleFrameReady)
      if (timer) clearInterval(timer)
    }
  }, [enabled, videoType, activeServerUrl, isPlaying, sampleNow, videoRef])

  return { ambientPalette, sampleNow }
}
