import { CustomThemeConfig, DEFAULT_CUSTOM_THEME } from '@common/types'

export interface RGB {
  r: number
  g: number
  b: number
}

export interface HSL {
  h: number
  s: number
  l: number
}

/**
 * Normalizes hex string (supports #RGB and #RRGGBB)
 */
export function normalizeHex(hex: string): string {
  let clean = hex.trim().replace(/^#/, '')
  if (clean.length === 3) {
    clean = clean
      .split('')
      .map((c) => c + c)
      .join('')
  }
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) {
    return '000000'
  }
  return clean.toUpperCase()
}

/**
 * Converts Hex string to RGB
 */
export function hexToRgb(hex: string): RGB {
  const clean = normalizeHex(hex)
  const num = parseInt(clean, 16)
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  }
}

/**
 * Converts RGB to HSL
 */
export function rgbToHsl(r: number, g: number, b: number): HSL {
  const rNorm = r / 255
  const gNorm = g / 255
  const bNorm = b / 255

  const max = Math.max(rNorm, gNorm, bNorm)
  const min = Math.min(rNorm, gNorm, bNorm)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

    switch (max) {
      case rNorm:
        h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0)
        break
      case gNorm:
        h = (bNorm - rNorm) / d + 2
        break
      case bNorm:
        h = (rNorm - gNorm) / d + 4
        break
    }
    h /= 6
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  }
}

/**
 * Converts Hex string to HSL
 */
export function hexToHsl(hex: string): HSL {
  const rgb = hexToRgb(hex)
  return rgbToHsl(rgb.r, rgb.g, rgb.b)
}

/**
 * Checks whether a color is considered dark using relative luminance
 */
export function isDarkColor(hex: string): boolean {
  return getRelativeLuminance(hex) < 0.45
}

/**
 * Calculates WCAG relative luminance of a hex color (0.0 to 1.0)
 */
export function getRelativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex)
  const toLinear = (c: number): number => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}

/**
 * Calculates the WCAG contrast ratio between two hex colors (1:1 to 21:1)
 */
export function getContrastRatio(hex1: string, hex2: string): number {
  const lum1 = getRelativeLuminance(hex1)
  const lum2 = getRelativeLuminance(hex2)
  const lighter = Math.max(lum1, lum2)
  const darker = Math.min(lum1, lum2)
  const ratio = (lighter + 0.05) / (darker + 0.05)
  return Math.round(ratio * 10) / 10
}

export type ContrastLevel = 'poor' | 'fair' | 'good'

export interface ContrastReport {
  ratio: number
  level: ContrastLevel
  isAccessible: boolean
  label: string
}

export function evaluateContrast(bgHex: string, fgHex: string): ContrastReport {
  const ratio = getContrastRatio(bgHex, fgHex)
  if (ratio >= 4.5) {
    return { ratio, level: 'good', isAccessible: true, label: 'High Contrast (WCAG AA)' }
  } else if (ratio >= 3.0) {
    return { ratio, level: 'fair', isAccessible: true, label: 'Fair Contrast (Large Text)' }
  } else {
    return { ratio, level: 'poor', isAccessible: false, label: 'Low Contrast (Hard to read)' }
  }
}

/**
 * Returns the recommended high-contrast foreground color for a given background
 */
export function getOptimalForeground(bgHex: string): string {
  return isDarkColor(bgHex) ? '#F8FAFC' : '#181716'
}

/**
 * List of CSS variables managed by the custom theme engine
 */
export const CUSTOM_THEME_CSS_VARS = [
  '--background',
  '--foreground',
  '--card',
  '--card-foreground',
  '--popover',
  '--popover-foreground',
  '--primary',
  '--primary-foreground',
  '--secondary',
  '--secondary-foreground',
  '--muted',
  '--muted-foreground',
  '--accent',
  '--accent-foreground',
  '--border',
  '--input',
  '--ring',
  '--font-family'
]

/**
 * Injects custom CSS variables into document.documentElement.style
 * Providing 100% instant real-time application across Tailwind HSL variables.
 */
export function applyCustomThemeVariables(config: CustomThemeConfig = DEFAULT_CUSTOM_THEME): void {
  if (typeof document === 'undefined') return

  const accentHsl = hexToHsl(config.accent || '#01825B')
  const bgHsl = hexToHsl(config.background || '#09090B')
  const fgHsl = hexToHsl(config.foreground || '#F8FAFC')
  const isDark = isDarkColor(config.background || '#09090B')

  const docEl = document.documentElement

  // Set dark class based on user's chosen custom background brightness
  if (isDark) {
    docEl.classList.add('dark')
  } else {
    docEl.classList.remove('dark')
  }

  // Remove other theme-* classes and tag as custom
  docEl.classList.forEach((className) => {
    if (className.startsWith('theme-') && className !== 'theme-custom') {
      docEl.classList.remove(className)
    }
  })
  docEl.classList.add('theme-custom')

  const primaryFg = isDarkColor(config.accent || '#01825B') ? '0 0% 100%' : '0 0% 5%'

  // Core variables
  docEl.style.setProperty('--background', `${bgHsl.h} ${bgHsl.s}% ${bgHsl.l}%`)
  docEl.style.setProperty('--foreground', `${fgHsl.h} ${fgHsl.s}% ${fgHsl.l}%`)
  docEl.style.setProperty('--primary', `${accentHsl.h} ${accentHsl.s}% ${accentHsl.l}%`)
  docEl.style.setProperty('--primary-foreground', primaryFg)
  docEl.style.setProperty('--ring', `${accentHsl.h} ${accentHsl.s}% ${accentHsl.l}%`)

  if (isDark) {
    const cardL = Math.min(95, bgHsl.l + 4)
    const popoverL = Math.min(95, bgHsl.l + 6)
    const secondaryL = Math.min(95, bgHsl.l + 9)
    const borderL = Math.min(95, bgHsl.l + 12)

    docEl.style.setProperty('--card', `${bgHsl.h} ${bgHsl.s}% ${cardL}%`)
    docEl.style.setProperty('--card-foreground', `${fgHsl.h} ${fgHsl.s}% ${fgHsl.l}%`)
    docEl.style.setProperty('--popover', `${bgHsl.h} ${bgHsl.s}% ${popoverL}%`)
    docEl.style.setProperty('--popover-foreground', `${fgHsl.h} ${fgHsl.s}% ${fgHsl.l}%`)
    docEl.style.setProperty('--secondary', `${bgHsl.h} ${Math.max(0, bgHsl.s - 5)}% ${secondaryL}%`)
    docEl.style.setProperty('--secondary-foreground', `${fgHsl.h} ${fgHsl.s}% ${fgHsl.l}%`)
    docEl.style.setProperty('--muted', `${bgHsl.h} ${Math.max(0, bgHsl.s - 5)}% ${cardL}%`)
    docEl.style.setProperty('--muted-foreground', `${fgHsl.h} ${Math.max(0, fgHsl.s - 15)}% ${Math.max(40, fgHsl.l - 30)}%`)
    docEl.style.setProperty('--border', `${bgHsl.h} ${Math.max(0, bgHsl.s - 5)}% ${borderL}%`)
    docEl.style.setProperty('--input', `${bgHsl.h} ${Math.max(0, bgHsl.s - 5)}% ${borderL}%`)
    docEl.style.setProperty('--accent', `${accentHsl.h} ${accentHsl.s}% ${secondaryL}%`)
    docEl.style.setProperty('--accent-foreground', `${fgHsl.h} ${fgHsl.s}% ${fgHsl.l}%`)
  } else {
    const cardL = Math.max(5, Math.min(100, bgHsl.l > 90 ? bgHsl.l - 2 : bgHsl.l + 4))
    const popoverL = bgHsl.l
    const secondaryL = Math.max(5, bgHsl.l - 6)
    const borderL = Math.max(5, bgHsl.l - 12)

    docEl.style.setProperty('--card', `${bgHsl.h} ${bgHsl.s}% ${cardL}%`)
    docEl.style.setProperty('--card-foreground', `${fgHsl.h} ${fgHsl.s}% ${fgHsl.l}%`)
    docEl.style.setProperty('--popover', `${bgHsl.h} ${bgHsl.s}% ${popoverL}%`)
    docEl.style.setProperty('--popover-foreground', `${fgHsl.h} ${fgHsl.s}% ${fgHsl.l}%`)
    docEl.style.setProperty('--secondary', `${bgHsl.h} ${Math.max(0, bgHsl.s - 5)}% ${secondaryL}%`)
    docEl.style.setProperty('--secondary-foreground', `${fgHsl.h} ${fgHsl.s}% ${fgHsl.l}%`)
    docEl.style.setProperty('--muted', `${bgHsl.h} ${Math.max(0, bgHsl.s - 5)}% ${secondaryL}%`)
    docEl.style.setProperty('--muted-foreground', `${fgHsl.h} ${Math.max(0, fgHsl.s - 15)}% ${Math.min(65, fgHsl.l + 30)}%`)
    docEl.style.setProperty('--border', `${bgHsl.h} ${Math.max(0, bgHsl.s - 5)}% ${borderL}%`)
    docEl.style.setProperty('--input', `${bgHsl.h} ${Math.max(0, bgHsl.s - 5)}% ${borderL}%`)
    docEl.style.setProperty('--accent', `${accentHsl.h} ${accentHsl.s}% ${secondaryL}%`)
    docEl.style.setProperty('--accent-foreground', `${fgHsl.h} ${fgHsl.s}% ${fgHsl.l}%`)
  }

  // Font family
  const font = config.font || 'Plus Jakarta Sans'
  const fontFamilyValue = `'${font}', 'Plus Jakarta Sans', 'Cairo', system-ui, -apple-system, sans-serif`
  docEl.style.setProperty('--font-family', fontFamilyValue)

  // Persist to localStorage for zero-flicker reload
  try {
    localStorage.setItem('colorTheme', 'custom')
    localStorage.setItem('custom_theme_config', JSON.stringify(config))
  } catch {}
}

/**
 * Removes custom CSS variables from document.documentElement.style
 * Allowing built-in CSS themes to apply cleanly.
 */
export function clearCustomThemeVariables(): void {
  if (typeof document === 'undefined') return
  const docEl = document.documentElement
  CUSTOM_THEME_CSS_VARS.forEach((v) => {
    docEl.style.removeProperty(v)
  })
  docEl.classList.remove('theme-custom')
}
