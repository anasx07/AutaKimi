import React, { useState, useEffect } from 'react'
import {
  Sparkles,
  Check,
  RotateCcw,
  Type,
  Eye,
  CheckCircle2,
  X,
  AlertTriangle,
  AlertCircle,
  Wand2,
  Play,
  BookOpen,
  Star,
  Bookmark
} from 'lucide-react'
import jinwooImg from '@renderer/app/assets/ThemeCharacter/sung-jinwoo-solo-leveling-hd-160@5@d_1280x720.jpg'
import gojoImg from '@renderer/app/assets/ThemeCharacter/satoru-gojo-from-jujutsu-kaisen_1280x720_xtrafondos.com.jpg'
import tanjiroImg from '@renderer/app/assets/ThemeCharacter/tanjiro-nezuko-1920x1080-20184_1280x720.jpg'
import zoroImg from '@renderer/app/assets/ThemeCharacter/roronoa-zoro-green-1920x1080-18358_1280x720.jpg'
import { CustomThemeConfig, DEFAULT_CUSTOM_THEME } from '@common/types'
import { useSettingsStore } from '@renderer/shared/model'
import { Button, Select, Dialog } from '@renderer/shared/ui'
import {
  isDarkColor,
  normalizeHex,
  evaluateContrast,
  getOptimalForeground
} from '@renderer/shared/lib/colorUtils'
import { cn } from '@renderer/shared/lib/utils'

const ACCENT_PRESETS = [
  { hex: '#E11D48', name: 'AutaKimi Crimson' },
  { hex: '#01825B', name: 'Emerald Green' },
  { hex: '#C2785C', name: 'Warm Terracotta' },
  { hex: '#2563EB', name: 'Royal Blue' },
  { hex: '#6366F1', name: 'Vibrant Violet' },
  { hex: '#D946EF', name: 'Electric Magenta' },
  { hex: '#D97706', name: 'Solar Amber' },
  { hex: '#0D9488', name: 'Deep Teal' }
]

const BACKGROUND_PRESETS = [
  { hex: '#09090B', name: 'Obsidian Black', isDark: true },
  { hex: '#0F172A', name: 'Slate Navy', isDark: true },
  { hex: '#18181B', name: 'Zinc Midnight', isDark: true },
  { hex: '#1A1625', name: 'Deep Royal', isDark: true },
  { hex: '#F2F0ED', name: 'Warm Parchment', isDark: false },
  { hex: '#FFFFFF', name: 'Crisp White', isDark: false }
]

const FOREGROUND_PRESETS = [
  { hex: '#F8FAFC', name: 'Pure White' },
  { hex: '#E2E8F0', name: 'Slate Light' },
  { hex: '#A1A1AA', name: 'Muted Zinc' },
  { hex: '#181716', name: 'Deep Noir' },
  { hex: '#000000', name: 'Pitch Black' }
]

const FONT_OPTIONS = [
  { value: 'Plus Jakarta Sans', label: 'Plus Jakarta Sans (Default)' },
  { value: 'Cairo', label: 'Cairo (Modern & Arabic)' },
  { value: 'Inter', label: 'Inter (Precise & Clean)' },
  { value: 'Outfit', label: 'Outfit (Modern Geometric)' },
  { value: 'Geist', label: 'Geist (Minimalist Developer)' },
  { value: 'Fira Code', label: 'Fira Code (Cyber Monospace)' },
  { value: 'System Default', label: 'System Default' }
]

const STARTER_THEMES = [
  {
    name: '⛩️ AutaKimi Core',
    config: {
      accent: '#E11D48',
      background: '#09090B',
      foreground: '#F8FAFC',
      font: 'Plus Jakarta Sans'
    }
  },
  {
    name: '🍵 Matcha Moss',
    config: {
      accent: '#01825B',
      background: '#0D1512',
      foreground: '#ECFDF5',
      font: 'Plus Jakarta Sans'
    }
  },
  {
    name: '🌅 Terracotta',
    config: {
      accent: '#C2785C',
      background: '#1C1917',
      foreground: '#FAFAF9',
      font: 'Outfit'
    }
  },
  {
    name: '⚡ Cyberpunk',
    config: {
      accent: '#00F0FF',
      background: '#0A0A12',
      foreground: '#F0FDF4',
      font: 'Fira Code'
    }
  },
  {
    name: '🔮 Dracula',
    config: {
      accent: '#BD93F9',
      background: '#1E1F29',
      foreground: '#F8F8F2',
      font: 'Geist'
    }
  },
  {
    name: '📜 Parchment Light',
    config: {
      accent: '#01825B',
      background: '#F2F0ED',
      foreground: '#181716',
      font: 'Cairo'
    }
  },
  {
    name: '🌌 Midnight Sapphire',
    config: {
      accent: '#38BDF8',
      background: '#0B1120',
      foreground: '#F1F5F9',
      font: 'Inter'
    }
  }
]

interface CustomThemeStudioProps {
  isOpen: boolean
  onClose: () => void
}

export function CustomThemeStudio({ isOpen, onClose }: CustomThemeStudioProps): React.JSX.Element | null {
  const { colorTheme, setColorTheme, customThemeConfig, setCustomThemeConfig } =
    useSettingsStore()

  const [accent, setAccent] = useState(customThemeConfig?.accent || DEFAULT_CUSTOM_THEME.accent)
  const [background, setBackground] = useState(
    customThemeConfig?.background || DEFAULT_CUSTOM_THEME.background
  )
  const [foreground, setForeground] = useState(
    customThemeConfig?.foreground || DEFAULT_CUSTOM_THEME.foreground
  )
  const [font, setFont] = useState(customThemeConfig?.font || DEFAULT_CUSTOM_THEME.font)
  const [previewMediaType, setPreviewMediaType] = useState<'anime' | 'manga'>('anime')

  // Sync internal state when store changes
  useEffect(() => {
    if (customThemeConfig) {
      setAccent(customThemeConfig.accent || DEFAULT_CUSTOM_THEME.accent)
      setBackground(customThemeConfig.background || DEFAULT_CUSTOM_THEME.background)
      setForeground(customThemeConfig.foreground || DEFAULT_CUSTOM_THEME.foreground)
      setFont(customThemeConfig.font || DEFAULT_CUSTOM_THEME.font)
    }
  }, [customThemeConfig])

  if (!isOpen) return null

  const isActive = colorTheme === 'custom'
  const contrastReport = evaluateContrast(background, foreground)

  const updateConfig = (newConfig: Partial<CustomThemeConfig>) => {
    const updated = {
      accent: newConfig.accent !== undefined ? newConfig.accent : accent,
      background: newConfig.background !== undefined ? newConfig.background : background,
      foreground: newConfig.foreground !== undefined ? newConfig.foreground : foreground,
      font: newConfig.font !== undefined ? newConfig.font : font
    }
    setCustomThemeConfig(updated)
  }

  const handleAccentChange = (val: string) => {
    setAccent(val)
    if (/^#[0-9a-fA-F]{6}$/i.test(val)) {
      updateConfig({ accent: val })
    }
  }

  const handleBackgroundChange = (val: string, smartContrast = true) => {
    setBackground(val)
    if (/^#[0-9a-fA-F]{6}$/i.test(val)) {
      let nextFg = foreground
      if (smartContrast) {
        // If current foreground has poor contrast against this new background, auto-switch to optimal foreground!
        const nextContrast = evaluateContrast(val, foreground)
        if (nextContrast.level === 'poor') {
          nextFg = getOptimalForeground(val)
          setForeground(nextFg)
        }
      }
      updateConfig({ background: val, foreground: nextFg })
    }
  }

  const handleForegroundChange = (val: string) => {
    setForeground(val)
    if (/^#[0-9a-fA-F]{6}$/i.test(val)) {
      updateConfig({ foreground: val })
    }
  }

  const handleFontChange = (val: string) => {
    setFont(val)
    updateConfig({ font: val })
  }

  const applyStarterPreset = (cfg: CustomThemeConfig) => {
    setAccent(cfg.accent)
    setBackground(cfg.background)
    setForeground(cfg.foreground)
    setFont(cfg.font)
    setCustomThemeConfig(cfg)
    if (!isActive) {
      setColorTheme('custom')
    }
  }

  const handleAutoContrast = () => {
    const nextFg = getOptimalForeground(background)
    setForeground(nextFg)
    updateConfig({ foreground: nextFg })
  }

  const handleReset = () => {
    setAccent(DEFAULT_CUSTOM_THEME.accent)
    setBackground(DEFAULT_CUSTOM_THEME.background)
    setForeground(DEFAULT_CUSTOM_THEME.foreground)
    setFont(DEFAULT_CUSTOM_THEME.font)
    setCustomThemeConfig(DEFAULT_CUSTOM_THEME)
  }

  const handleActivate = () => {
    setColorTheme('custom')
  }

  const handleDone = () => {
    if (contrastReport.level === 'poor') {
      const nextFg = getOptimalForeground(background)
      setForeground(nextFg)
      updateConfig({ foreground: nextFg })
    }
    onClose()
  }

  const previewIsDark = isDarkColor(background)
  const previewFont =
    font === 'System Default'
      ? 'system-ui, -apple-system, sans-serif'
      : `'${font}', 'Plus Jakarta Sans', sans-serif`

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      className="max-w-4xl max-h-[92vh] overflow-y-auto custom-scrollbar"
    >
      {/* Studio Header */}
      <div className="flex items-center justify-between border-b border-border/50 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary shadow-sm shrink-0">
            <Sparkles className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-extrabold text-lg tracking-tight text-foreground">
                Custom Theme Studio
              </h2>
              <span className="text-[10px] font-black uppercase tracking-wider bg-primary/20 text-primary border border-primary/30 px-2 py-0.5 rounded-full">
                Make Your Own
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Live design your color palette and typography in real-time.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={isActive ? 'primary' : 'outline'}
            size="sm"
            onClick={handleActivate}
            className={cn(
              'h-8 text-xs font-bold gap-1.5 shadow-sm transition-all',
              isActive && 'bg-primary text-primary-foreground shadow-primary/25'
            )}
          >
            {isActive ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" /> Active
              </>
            ) : (
              'Activate Theme'
            )}
          </Button>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors ml-1"
            title="Close Studio"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Quick Curated Starters */}
      <div className="space-y-2">
        <div className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground pl-1">
          Curated Starters (1-Click)
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          {STARTER_THEMES.map((starter) => (
            <button
              key={starter.name}
              type="button"
              onClick={() => applyStarterPreset(starter.config)}
              className="flex flex-col items-center justify-center p-2.5 rounded-xl border border-border/60 bg-secondary/30 hover:bg-secondary/70 hover:border-primary/40 transition-all text-left group"
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <div
                  className="w-3.5 h-3.5 rounded-full shadow-sm ring-1 ring-border/50"
                  style={{ backgroundColor: starter.config.accent }}
                />
                <div
                  className="w-3.5 h-3.5 rounded-full shadow-sm ring-1 ring-border/50"
                  style={{ backgroundColor: starter.config.background }}
                />
              </div>
              <span className="text-[11px] font-bold text-foreground text-center truncate w-full">
                {starter.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Studio Controls & Live Preview Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Side: Controls matching user's reference image */}
        <div className="lg:col-span-7 space-y-4 bg-secondary/20 border border-border/60 rounded-2xl p-4 shadow-sm">
          {/* Accent Row */}
          <div className="space-y-2 pb-3.5 border-b border-border/40">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                Accent
              </label>
              <span className="text-[10px] text-muted-foreground">Buttons, tabs, focus rings</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {ACCENT_PRESETS.map((swatch) => {
                const isSelected =
                  normalizeHex(accent) === normalizeHex(swatch.hex)
                return (
                  <button
                    key={swatch.hex}
                    type="button"
                    title={swatch.name}
                    onClick={() => handleAccentChange(swatch.hex)}
                    className={cn(
                      'w-7 h-7 rounded-full transition-all flex items-center justify-center relative shadow-sm hover:scale-110',
                      isSelected
                        ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background scale-105'
                        : 'hover:opacity-90'
                    )}
                    style={{ backgroundColor: swatch.hex }}
                  >
                    {isSelected && (
                      <Check
                        className={cn(
                          'h-3.5 w-3.5 drop-shadow',
                          isDarkColor(swatch.hex) ? 'text-white' : 'text-black'
                        )}
                      />
                    )}
                  </button>
                )
              })}

              {/* Native Color Picker + Hex Input */}
              <div className="flex items-center gap-1.5 ml-auto bg-background border border-border rounded-lg px-2 py-1 shadow-inner focus-within:ring-2 focus-within:ring-primary/20">
                <label className="cursor-pointer relative w-4 h-4 rounded-full border border-border/70 shadow-sm shrink-0 overflow-hidden">
                  <input
                    type="color"
                    value={accent.startsWith('#') ? accent : `#${accent}`}
                    onChange={(e) => handleAccentChange(e.target.value)}
                    className="absolute -top-4 -left-4 w-12 h-12 cursor-pointer opacity-0"
                  />
                  <div
                    className="w-full h-full"
                    style={{ backgroundColor: accent }}
                  />
                </label>
                <input
                  type="text"
                  value={accent}
                  onChange={(e) => handleAccentChange(e.target.value)}
                  placeholder="#01825B"
                  className="w-20 bg-transparent text-xs font-mono font-medium focus:outline-none uppercase text-foreground"
                />
              </div>
            </div>
          </div>

          {/* Background Row */}
          <div className="space-y-2 pb-3.5 border-b border-border/40">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                Background
              </label>
              <span className="text-[10px] text-muted-foreground">App canvas & surfaces</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {BACKGROUND_PRESETS.map((swatch) => {
                const isSelected =
                  normalizeHex(background) === normalizeHex(swatch.hex)
                return (
                  <button
                    key={swatch.hex}
                    type="button"
                    title={swatch.name}
                    onClick={() => handleBackgroundChange(swatch.hex)}
                    className={cn(
                      'w-7 h-7 rounded-full transition-all flex items-center justify-center relative shadow-sm border border-border/70 hover:scale-110',
                      isSelected
                        ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-105'
                        : 'hover:opacity-90'
                    )}
                    style={{ backgroundColor: swatch.hex }}
                  >
                    {isSelected && (
                      <Check
                        className={cn(
                          'h-3.5 w-3.5 drop-shadow',
                          swatch.isDark ? 'text-white' : 'text-black'
                        )}
                      />
                    )}
                  </button>
                )
              })}

              {/* Native Color Picker + Hex Input */}
              <div className="flex items-center gap-1.5 ml-auto bg-background border border-border rounded-lg px-2 py-1 shadow-inner focus-within:ring-2 focus-within:ring-primary/20">
                <label className="cursor-pointer relative w-4 h-4 rounded-full border border-border/70 shadow-sm shrink-0 overflow-hidden">
                  <input
                    type="color"
                    value={background.startsWith('#') ? background : `#${background}`}
                    onChange={(e) => handleBackgroundChange(e.target.value)}
                    className="absolute -top-4 -left-4 w-12 h-12 cursor-pointer opacity-0"
                  />
                  <div
                    className="w-full h-full"
                    style={{ backgroundColor: background }}
                  />
                </label>
                <input
                  type="text"
                  value={background}
                  onChange={(e) => handleBackgroundChange(e.target.value)}
                  placeholder="#09090B"
                  className="w-20 bg-transparent text-xs font-mono font-medium focus:outline-none uppercase text-foreground"
                />
              </div>
            </div>
          </div>

          {/* Foreground Row */}
          <div className="space-y-2 pb-3.5 border-b border-border/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  Foreground
                </label>
                {contrastReport.level === 'good' && (
                  <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> {contrastReport.ratio}:1 (Great)
                  </span>
                )}
                {contrastReport.level === 'fair' && (
                  <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> {contrastReport.ratio}:1 (Fair)
                  </span>
                )}
                {contrastReport.level === 'poor' && (
                  <span className="text-[10px] font-bold text-rose-500 bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                    <AlertTriangle className="h-3 w-3" /> {contrastReport.ratio}:1 (Too Low)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAutoContrast}
                  className="text-[10px] font-bold uppercase tracking-wider text-primary hover:underline flex items-center gap-1"
                >
                  <Wand2 className="h-3 w-3" /> Auto Contrast
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {FOREGROUND_PRESETS.map((swatch) => {
                const isSelected =
                  normalizeHex(foreground) === normalizeHex(swatch.hex)
                const isPoorContrast = evaluateContrast(background, swatch.hex).level === 'poor'
                return (
                  <button
                    key={swatch.hex}
                    type="button"
                    title={
                      isPoorContrast
                        ? `${swatch.name} (Warning: Low contrast on this background)`
                        : swatch.name
                    }
                    onClick={() => handleForegroundChange(swatch.hex)}
                    className={cn(
                      'w-7 h-7 rounded-full transition-all flex items-center justify-center relative shadow-sm border border-border/70 hover:scale-110',
                      isSelected
                        ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-105'
                        : 'hover:opacity-90',
                      isPoorContrast && !isSelected && 'opacity-60'
                    )}
                    style={{ backgroundColor: swatch.hex }}
                  >
                    {isSelected && (
                      <Check
                        className={cn(
                          'h-3.5 w-3.5 drop-shadow',
                          isDarkColor(swatch.hex) ? 'text-white' : 'text-black'
                        )}
                      />
                    )}
                    {isPoorContrast && !isSelected && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-rose-500 text-white flex items-center justify-center text-[8px] font-extrabold shadow">
                        !
                      </span>
                    )}
                  </button>
                )
              })}

              {/* Native Color Picker + Hex Input */}
              <div className="flex items-center gap-1.5 ml-auto bg-background border border-border rounded-lg px-2 py-1 shadow-inner focus-within:ring-2 focus-within:ring-primary/20">
                <label className="cursor-pointer relative w-4 h-4 rounded-full border border-border/70 shadow-sm shrink-0 overflow-hidden">
                  <input
                    type="color"
                    value={foreground.startsWith('#') ? foreground : `#${foreground}`}
                    onChange={(e) => handleForegroundChange(e.target.value)}
                    className="absolute -top-4 -left-4 w-12 h-12 cursor-pointer opacity-0"
                  />
                  <div
                    className="w-full h-full"
                    style={{ backgroundColor: foreground }}
                  />
                </label>
                <input
                  type="text"
                  value={foreground}
                  onChange={(e) => handleForegroundChange(e.target.value)}
                  placeholder="#F8FAFC"
                  className="w-20 bg-transparent text-xs font-mono font-medium focus:outline-none uppercase text-foreground"
                />
              </div>
            </div>

            {/* Low Contrast Warning Box */}
            {contrastReport.level === 'poor' && (
              <div className="mt-2.5 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-400 text-xs flex items-center justify-between animate-in fade-in duration-200">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" />
                  <div className="text-[11px] leading-snug">
                    <strong className="block text-rose-500">Unreadable Color Pair ({contrastReport.ratio}:1)</strong>
                    Background and text are too close in tone. Text will become invisible!
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAutoContrast}
                  className="shrink-0 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-500 border border-rose-500/40 flex items-center gap-1 transition-all"
                >
                  <Wand2 className="h-3 w-3" /> Auto-Fix
                </button>
              </div>
            )}
          </div>

          {/* Font Row */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Type className="h-3.5 w-3.5" /> Font Family
              </label>
              <span className="text-[10px] text-muted-foreground">Global typography</span>
            </div>
            <div className="w-full">
              <Select
                value={font}
                onValueChange={handleFontChange}
                options={FONT_OPTIONS}
              />
            </div>
          </div>
        </div>

        {/* Right Side: Authentic AutaKimi Anime & Manga Live Preview */}
        <div className="lg:col-span-5 flex flex-col justify-between">
          <div
            className="rounded-2xl p-4 border shadow-xl transition-all duration-300 relative overflow-hidden h-full flex flex-col justify-between min-h-[380px]"
            style={{
              backgroundColor: background,
              color: foreground,
              borderColor: previewIsDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
              fontFamily: previewFont
            }}
          >
            <div className="space-y-3">
              {/* AutaKimi Mini Header & MediaTabSwitcher */}
              <div
                className="flex items-center justify-between border-b pb-2.5"
                style={{
                  borderColor: previewIsDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
                }}
              >
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: accent }}
                  />
                  <span className="text-xs font-black tracking-tight uppercase">
                    AutaKimi
                  </span>
                </div>

                {/* Anime / Manga Tab Switcher */}
                <div
                  className="flex items-center p-0.5 rounded-lg border text-[10px] font-bold"
                  style={{
                    backgroundColor: previewIsDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                    borderColor: previewIsDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setPreviewMediaType('anime')}
                    className={cn(
                      'px-2.5 py-1 rounded-md transition-all flex items-center gap-1',
                      previewMediaType === 'anime'
                        ? 'shadow-sm font-extrabold'
                        : 'opacity-60 hover:opacity-100'
                    )}
                    style={
                      previewMediaType === 'anime'
                        ? {
                            backgroundColor: accent,
                            color: isDarkColor(accent) ? '#ffffff' : '#000000'
                          }
                        : undefined
                    }
                  >
                    <Play className="h-2.5 w-2.5 fill-current" /> Anime
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMediaType('manga')}
                    className={cn(
                      'px-2.5 py-1 rounded-md transition-all flex items-center gap-1',
                      previewMediaType === 'manga'
                        ? 'shadow-sm font-extrabold'
                        : 'opacity-60 hover:opacity-100'
                    )}
                    style={
                      previewMediaType === 'manga'
                        ? {
                            backgroundColor: accent,
                            color: isDarkColor(accent) ? '#ffffff' : '#000000'
                          }
                        : undefined
                    }
                  >
                    <BookOpen className="h-2.5 w-2.5" /> Manga
                  </button>
                </div>
              </div>

              {/* Warning banner in preview if contrast is poor */}
              {contrastReport.level === 'poor' && (
                <div className="p-2 rounded-xl bg-rose-500/20 border border-rose-500/40 text-[10px] font-bold text-rose-500 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                    Low Contrast: Text will be hard to read
                  </span>
                  <button
                    type="button"
                    onClick={handleAutoContrast}
                    className="underline text-[10px] uppercase tracking-wider hover:opacity-80"
                  >
                    Fix
                  </button>
                </div>
              )}

              {/* Authentic AutaKimi Hero Card */}
              {previewMediaType === 'anime' ? (
                /* Anime Card (Solo Leveling) */
                <div
                  className="rounded-xl border overflow-hidden shadow-md group transition-all"
                  style={{
                    backgroundColor: previewIsDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                    borderColor: previewIsDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
                  }}
                >
                  {/* Poster Thumbnail */}
                  <div className="relative aspect-[16/9] w-full overflow-hidden bg-black/40">
                    <img
                      src={jinwooImg}
                      alt="Solo Leveling"
                      className="w-full h-full object-cover object-top opacity-90 group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                    {/* Top Badges */}
                    <div className="absolute top-2 left-2 flex items-center gap-1.5">
                      <span className="text-[9px] font-black uppercase tracking-wider bg-black/70 text-white border border-white/10 px-1.5 py-0.5 rounded shadow">
                        ANIME
                      </span>
                      <span
                        className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded shadow"
                        style={{
                          backgroundColor: accent,
                          color: isDarkColor(accent) ? '#ffffff' : '#000000'
                        }}
                      >
                        EP. 12
                      </span>
                    </div>

                    <div className="absolute top-2 right-2">
                      <span className="text-[9px] font-bold bg-black/70 text-neutral-300 px-1.5 py-0.5 rounded border border-white/10">
                        Anime4Up
                      </span>
                    </div>

                    {/* Center Play Button Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-transform group-hover:scale-110"
                        style={{
                          backgroundColor: accent,
                          color: isDarkColor(accent) ? '#ffffff' : '#000000'
                        }}
                      >
                        <Play className="h-4 w-4 fill-current ml-0.5" />
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                      <div
                        className="h-full"
                        style={{ width: '74%', backgroundColor: accent }}
                      />
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold truncate">
                        Solo Leveling: Arise
                      </h4>
                      <span className="text-[10px] font-bold text-amber-400 flex items-center gap-0.5 shrink-0">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> 9.8
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px]" style={{ opacity: 0.7 }}>
                      <span>TV Series</span>
                      <span>•</span>
                      <span>Ep 12 · 18:40 / 24:00</span>
                      <span>•</span>
                      <span>1080p FHD</span>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        className="flex-1 text-xs font-bold py-1.5 px-3 rounded-lg shadow-sm flex items-center justify-center gap-1.5 transition-transform active:scale-95"
                        style={{
                          backgroundColor: accent,
                          color: isDarkColor(accent) ? '#ffffff' : '#000000'
                        }}
                      >
                        <Play className="h-3 w-3 fill-current" /> Watch Episode 12
                      </button>
                      <button
                        type="button"
                        className="p-1.5 rounded-lg border transition-colors shrink-0"
                        style={{
                          borderColor: previewIsDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'
                        }}
                        title="Add to Library"
                      >
                        <Bookmark className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Manga Card (Jujutsu Kaisen) */
                <div
                  className="rounded-xl border overflow-hidden shadow-md group transition-all"
                  style={{
                    backgroundColor: previewIsDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                    borderColor: previewIsDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
                  }}
                >
                  {/* Poster Thumbnail */}
                  <div className="relative aspect-[16/9] w-full overflow-hidden bg-black/40">
                    <img
                      src={gojoImg}
                      alt="Jujutsu Kaisen"
                      className="w-full h-full object-cover object-center opacity-90 group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                    {/* Top Badges */}
                    <div className="absolute top-2 left-2 flex items-center gap-1.5">
                      <span className="text-[9px] font-black uppercase tracking-wider bg-black/70 text-white border border-white/10 px-1.5 py-0.5 rounded shadow">
                        MANGA
                      </span>
                      <span
                        className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded shadow"
                        style={{
                          backgroundColor: accent,
                          color: isDarkColor(accent) ? '#ffffff' : '#000000'
                        }}
                      >
                        CH. 236
                      </span>
                    </div>

                    <div className="absolute top-2 right-2">
                      <span className="text-[9px] font-bold bg-black/70 text-neutral-300 px-1.5 py-0.5 rounded border border-white/10">
                        Asura Scans
                      </span>
                    </div>

                    {/* Center Icon Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-transform group-hover:scale-110"
                        style={{
                          backgroundColor: accent,
                          color: isDarkColor(accent) ? '#ffffff' : '#000000'
                        }}
                      >
                        <BookOpen className="h-4 w-4" />
                      </div>
                    </div>

                    {/* Reading Progress Bar */}
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                      <div
                        className="h-full"
                        style={{ width: '86%', backgroundColor: accent }}
                      />
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold truncate">
                        Jujutsu Kaisen
                      </h4>
                      <span className="text-[10px] font-bold text-amber-400 flex items-center gap-0.5 shrink-0">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> 9.9
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px]" style={{ opacity: 0.7 }}>
                      <span>Manga</span>
                      <span>•</span>
                      <span>Chapter 236 · Page 18/22</span>
                      <span>•</span>
                      <span>Colored</span>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        className="flex-1 text-xs font-bold py-1.5 px-3 rounded-lg shadow-sm flex items-center justify-center gap-1.5 transition-transform active:scale-95"
                        style={{
                          backgroundColor: accent,
                          color: isDarkColor(accent) ? '#ffffff' : '#000000'
                        }}
                      >
                        <BookOpen className="h-3 w-3" /> Read Chapter 236
                      </button>
                      <button
                        type="button"
                        className="p-1.5 rounded-lg border transition-colors shrink-0"
                        style={{
                          borderColor: previewIsDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'
                        }}
                        title="Add to Library"
                      >
                        <Bookmark className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Mini Up-Next Row (Demon Slayer & Zoro) */}
              <div className="grid grid-cols-2 gap-2 pt-0.5">
                <div
                  className="flex items-center gap-2 p-2 rounded-lg border backdrop-blur-sm"
                  style={{
                    backgroundColor: previewIsDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                    borderColor: previewIsDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
                  }}
                >
                  <img
                    src={tanjiroImg}
                    alt="Demon Slayer"
                    className="w-8 h-10 object-cover rounded shadow-sm shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-bold truncate">Demon Slayer</div>
                    <div
                      className="text-[9px] font-black uppercase tracking-wider truncate"
                      style={{ color: accent }}
                    >
                      {previewMediaType === 'anime' ? 'EP. 8 · FHD' : 'CH. 205'}
                    </div>
                  </div>
                </div>

                <div
                  className="flex items-center gap-2 p-2 rounded-lg border backdrop-blur-sm"
                  style={{
                    backgroundColor: previewIsDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                    borderColor: previewIsDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
                  }}
                >
                  <img
                    src={zoroImg}
                    alt="One Piece"
                    className="w-8 h-10 object-cover rounded shadow-sm shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-bold truncate">One Piece: Wano</div>
                    <div
                      className="text-[9px] font-black uppercase tracking-wider truncate"
                      style={{ color: accent }}
                    >
                      {previewMediaType === 'anime' ? 'EP. 1098' : 'CH. 1108'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Info Bar */}
            <div
              className="pt-2 border-t text-[10px] flex items-center justify-between mt-2.5"
              style={{
                borderColor: previewIsDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                opacity: 0.75
              }}
            >
              <span className="flex items-center gap-1 font-medium">
                <Eye className="h-3 w-3" /> {font}
              </span>
              <span className="font-mono text-[9px] font-semibold">
                {accent} · {background}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Controls */}
      <div className="flex items-center justify-between pt-2 border-t border-border/50">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1.5"
          title="Reset to default custom theme"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset Defaults
        </Button>

        <Button
          variant="primary"
          size="sm"
          onClick={handleDone}
          className="h-8 text-xs font-bold px-5"
        >
          Done
        </Button>
      </div>
    </Dialog>
  )
}
