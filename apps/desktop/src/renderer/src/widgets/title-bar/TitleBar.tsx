import { useEffect, useRef } from 'react'
import { useSettingsStore } from '@renderer/shared/model'
import { DataService } from '@renderer/shared/api'
import appIcon from '../../app/assets/app-icon/64x64.png'

export default function TitleBar() {
  const platform = DataService.platform
  const { theme, colorTheme } = useSettingsStore()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (platform !== 'win32') return

    // Allow CSS vars to apply to the DOM before computing
    const timer = setTimeout(() => {
      try {
        if (!ref.current) return

        // Measure exact DOM node of the titlebar
        const bgRgb = getComputedStyle(ref.current).backgroundColor
        const fgRgb = getComputedStyle(ref.current).color

        // Electron on Windows prefers HEX colors for the titlebar overlay
        const toHex = (colorString: string) => {
          const match = colorString.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/)
          if (!match) return colorString
          return (
            '#' +
            match
              .slice(1, 4)
              .map((x) => parseInt(x).toString(16).padStart(2, '0'))
              .join('')
          )
        }

        DataService.window
          .updateOverlay({
            color: toHex(bgRgb),
            symbolColor: toHex(fgRgb)
          })
          .catch(() => {})
      } catch (e) {}
    }, 50)

    return () => clearTimeout(timer)
  }, [theme, colorTheme, platform])

  // On Linux, standard frame is likely present, so avoid double titlebar
  if (platform === 'linux') return null

  return (
    <div
      ref={ref}
      className="h-[33px] bg-background text-foreground border-b border-border flex items-center px-4 select-none shrink-0"
      style={{ WebkitAppRegion: 'drag' } as any}
    >
      <div className="flex items-center gap-2">
        <img src={appIcon} className="w-6 h-6 object-contain" alt="Logo" />
        <span className="text-xs font-semibold text-foreground/80 tracking-wide">AutaKimi</span>
      </div>

      <div className="flex-1" />

      {/* 
        Leave space for native caption buttons on Windows/Mac 
        Standard width for Windows control buttons area is approx 138px
      */}
      <div className="w-[140px] h-full" style={{ WebkitAppRegion: 'no-drag' } as any} />
    </div>
  )
}
