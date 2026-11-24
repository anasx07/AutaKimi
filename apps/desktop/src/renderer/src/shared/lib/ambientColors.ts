export const AMBIENT_SAMPLE_WIDTH = 16
export const AMBIENT_SAMPLE_HEIGHT = 9
export const AMBIENT_SAMPLE_INTERVAL_MS = 2000

export interface AmbientColorPalette {
  left: string
  center: string
  right: string
}

interface ColorBucket {
  weight: number
  rSum: number
  gSum: number
  bSum: number
}

function clampChannel(val: number): number {
  return Math.max(0, Math.min(255, Math.round(val)))
}

/**
 * Enhances muted dark channels gently while keeping hue intact so glow remains visible behind players.
 */
function boostGlowColor(r: number, g: number, b: number): string {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const avg = (r + g + b) / 3

  // Keep hue intact; softly lift overly dim tones and emphasize saturation slightly
  const lift = avg < 48 && max > 0 ? Math.min(1.65, 64 / Math.max(1, avg)) : 1
  let nr = r * lift
  let ng = g * lift
  let nb = b * lift

  if (max - min > 12) {
    const newAvg = (nr + ng + nb) / 3
    nr = newAvg + (nr - newAvg) * 1.18
    ng = newAvg + (ng - newAvg) * 1.18
    nb = newAvg + (nb - newAvg) * 1.18
  }

  return `rgb(${clampChannel(nr)}, ${clampChannel(ng)}, ${clampChannel(nb)})`
}

function pickDominantFromBuckets(
  buckets: Map<number, ColorBucket>,
  fallbackRgb: [number, number, number]
): string {
  let best: ColorBucket | null = null
  for (const bucket of buckets.values()) {
    if (!best || bucket.weight > best.weight) {
      best = bucket
    }
  }
  if (!best || best.weight <= 0) {
    return boostGlowColor(fallbackRgb[0], fallbackRgb[1], fallbackRgb[2])
  }
  return boostGlowColor(best.rSum / best.weight, best.gSum / best.weight, best.bSum / best.weight)
}

/**
 * Extracts directional dominant ambient colors (left, center, right) from an RGBA pixel buffer
 * such as a tiny 16x9 canvas sample of a video frame or cover thumbnail.
 */
export function extractAmbientPaletteFromPixels(
  pixels: Uint8ClampedArray,
  width: number,
  height: number
): AmbientColorPalette {
  const leftBuckets = new Map<number, ColorBucket>()
  const rightBuckets = new Map<number, ColorBucket>()
  const allBuckets = new Map<number, ColorBucket>()

  let fallbackWeight = 0
  let fbR = 0
  let fbG = 0
  let fbB = 0

  const halfWidth = width / 2

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4
      const r = pixels[idx]
      const g = pixels[idx + 1]
      const b = pixels[idx + 2]
      const a = pixels[idx + 3]

      if (a < 128) continue

      fallbackWeight += 1
      fbR += r
      fbG += g
      fbB += b

      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      const brightness = (r + g + b) / 3

      // Skip letterbox blacks and blown-out whites so scene colors lead the ambient glow
      if (brightness < 22 || brightness > 238) continue

      const saturation = max === 0 ? 0 : (max - min) / max
      const weight = 1 + saturation * 2.8

      // Quantize into 8x8x8 color space buckets
      const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5)

      const addTo = (map: Map<number, ColorBucket>) => {
        const existing = map.get(key)
        if (existing) {
          existing.weight += weight
          existing.rSum += r * weight
          existing.gSum += g * weight
          existing.bSum += b * weight
        } else {
          map.set(key, {
            weight,
            rSum: r * weight,
            gSum: g * weight,
            bSum: b * weight
          })
        }
      }

      addTo(allBuckets)
      if (x < halfWidth) {
        addTo(leftBuckets)
      } else {
        addTo(rightBuckets)
      }
    }
  }

  const fallbackRgb: [number, number, number] =
    fallbackWeight > 0
      ? [fbR / fallbackWeight, fbG / fallbackWeight, fbB / fallbackWeight]
      : [120, 40, 80]

  const center = pickDominantFromBuckets(allBuckets, fallbackRgb)
  const left = pickDominantFromBuckets(leftBuckets, fallbackRgb)
  const right = pickDominantFromBuckets(rightBuckets, fallbackRgb)

  return { left, center, right }
}

/**
 * Formats a directional AmbientColorPalette into a smooth multi-anchor CSS radial gradient backdrop.
 */
export function buildAmbientGradientStyle(palette: AmbientColorPalette): string {
  return [
    `radial-gradient(circle at 18% 45%, ${palette.left} 0%, transparent 58%)`,
    `radial-gradient(circle at 82% 55%, ${palette.right} 0%, transparent 58%)`,
    `radial-gradient(circle at 50% 50%, ${palette.center} 0%, transparent 72%)`
  ].join(', ')
}

/**
 * Safely samples an HTMLImageElement or HTMLVideoElement onto an offscreen canvas without throwing
 * on cross-origin tainted media. Returns null when pixel access is restricted.
 */
export function sampleElementAmbientPalette(
  element: HTMLVideoElement | HTMLImageElement,
  canvas?: HTMLCanvasElement | null
): { palette: AmbientColorPalette | null; tainted: boolean } {
  if (typeof document === 'undefined') {
    return { palette: null, tainted: false }
  }

  const targetCanvas = canvas || document.createElement('canvas')
  if (targetCanvas.width !== AMBIENT_SAMPLE_WIDTH) targetCanvas.width = AMBIENT_SAMPLE_WIDTH
  if (targetCanvas.height !== AMBIENT_SAMPLE_HEIGHT) targetCanvas.height = AMBIENT_SAMPLE_HEIGHT

  const ctx = targetCanvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return { palette: null, tainted: false }

  try {
    ctx.drawImage(element, 0, 0, AMBIENT_SAMPLE_WIDTH, AMBIENT_SAMPLE_HEIGHT)
    const imageData = ctx.getImageData(0, 0, AMBIENT_SAMPLE_WIDTH, AMBIENT_SAMPLE_HEIGHT)
    return {
      palette: extractAmbientPaletteFromPixels(
        imageData.data,
        AMBIENT_SAMPLE_WIDTH,
        AMBIENT_SAMPLE_HEIGHT
      ),
      tainted: false
    }
  } catch (err: any) {
    const isSecurityTaint =
      err?.name === 'SecurityError' ||
      String(err?.message || '')
        .toLowerCase()
        .includes('tainted')
    return { palette: null, tainted: isSecurityTaint }
  }
}
