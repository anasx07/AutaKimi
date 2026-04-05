import { useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  Copy,
  Check,
  Send,
  MessageCircle,
  Share2,
  Mail,
  BookOpen,
  ExternalLink,
  Smartphone
} from 'lucide-react'
import { cn } from '@renderer/shared/lib/utils'
import { DataService } from '@renderer/shared/api'

interface ShareProgressModalProps {
  isOpen: boolean
  onClose: () => void
  mangaTitle: string
  chapterNumber: string | number
  chapterTitle?: string
  currentPage: number
  totalPages: number
  chapterUrl: string
  readerTheme?: string
}

type ShareTarget = {
  id: string
  label: string
  icon: React.ReactNode
  color: string
  action: () => void | Promise<void>
}

function toBold(text: string): string {
  // Uses Mathematical Bold Alphanumeric Symbols to simulate bold text in plain contexts
  return text.replace(/[A-Za-z0-9]/g, (char) => {
    const code = char.charCodeAt(0)
    if (code >= 65 && code <= 90) return String.fromCodePoint(code - 65 + 0x1d400) // Bold A-Z
    if (code >= 97 && code <= 122) return String.fromCodePoint(code - 97 + 0x1d41a) // Bold a-z
    if (code >= 48 && code <= 57) return String.fromCodePoint(code - 48 + 0x1d7ce) // Bold 0-9
    return char
  })
}

function buildShareText(
  mangaTitle: string,
  chapterNumber: string | number,
  currentPage: number,
  totalPages: number,
  chapterUrl: string
): string {
  const pct = totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0
  const bar = '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10))
  
  const boldTitle = toBold(mangaTitle.toUpperCase())
  const boldChapter = toBold(`Chapter ${chapterNumber}`)

  return [
    `📖 ${boldTitle}`,
    `${boldChapter}${totalPages > 0 ? ` • Page ${currentPage}/${totalPages} (${pct}%)` : ''}`,
    totalPages > 0 ? `${bar}` : '',
    '',
    `🔗 ${chapterUrl}`,
    '',
    'Shared from AutaKimi ✨'
  ]
    .filter((l, i, arr) => !(l === '' && arr[i - 1] === ''))
    .join('\n')
}

export function ShareProgressModal({
  isOpen,
  onClose,
  mangaTitle,
  chapterNumber,
  chapterTitle,
  currentPage,
  totalPages,
  chapterUrl,
  readerTheme
}: ShareProgressModalProps) {
  const [copied, setCopied] = useState(false)
  const [shared, setShared] = useState(false)

  const shareText = buildShareText(mangaTitle, chapterNumber, currentPage, totalPages, chapterUrl)

  const pct = totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0

  const copyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
      const ta = document.createElement('textarea')
      ta.value = shareText
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [shareText])

  const openExternal = useCallback(
    (url: string) => {
      DataService.openExternal(url)
    },
    []
  )

  const handleSystemShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${mangaTitle} — Ch. ${chapterNumber}`,
          text: shareText,
          url: chapterUrl
        })
        setShared(true)
        setTimeout(() => setShared(false), 2000)
      } catch {
        await copyToClipboard()
      }
    } else {
      await copyToClipboard()
    }
  }, [shareText, chapterUrl, mangaTitle, chapterNumber, copyToClipboard])

  const shareTargets: ShareTarget[] = [
    {
      id: 'clipboard',
      label: copied ? 'Copied!' : 'Copy Text',
      icon: copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />,
      color: copied
        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
        : 'bg-neutral-800/80 text-neutral-300 border-neutral-700/50 hover:bg-neutral-700/80 hover:text-white',
      action: copyToClipboard
    },
    {
      id: 'telegram',
      label: 'Telegram',
      icon: <Send className="h-5 w-5" />,
      color:
        'bg-[#0088cc]/10 text-[#29b6f6] border-[#0088cc]/30 hover:bg-[#0088cc]/20 hover:text-[#4fc3f7]',
      action: () => {
        const url = `https://t.me/share/url?url=${encodeURIComponent(chapterUrl)}&text=${encodeURIComponent(shareText)}`
        openExternal(url)
      }
    },
    {
      id: 'whatsapp',
      label: 'WhatsApp',
      icon: <MessageCircle className="h-5 w-5" />,
      color:
        'bg-[#25D366]/10 text-[#25D366] border-[#25D366]/30 hover:bg-[#25D366]/20 hover:text-[#4cde7e]',
      action: () => {
        const url = `https://wa.me/?text=${encodeURIComponent(shareText)}`
        openExternal(url)
      }
    },
    {
      id: 'system',
      label: shared ? 'Shared!' : 'Share…',
      icon: shared ? <Check className="h-5 w-5" /> : <Share2 className="h-5 w-5" />,
      color: shared
        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
        : 'bg-violet-500/10 text-violet-400 border-violet-500/30 hover:bg-violet-500/20 hover:text-violet-300',
      action: handleSystemShare
    },
    {
      id: 'email',
      label: 'Email',
      icon: <Mail className="h-5 w-5" />,
      color:
        'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20 hover:text-amber-300',
      action: () => {
        const subject = `Reading: ${mangaTitle} — Chapter ${chapterNumber}`
        const body = shareText
        const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
        openExternal(url)
      }
    },
    {
      id: 'tachiyomi',
      label: 'Tachiyomi',
      icon: <Smartphone className="h-5 w-5" />,
      color:
        'bg-[#009688]/10 text-[#009688] border-[#009688]/30 hover:bg-[#009688]/20 hover:text-[#26a69a]',
      action: () => {
        // Tachiyomi/Mihon intercepts standard URLs via Intent Filters.
        // We open the chapter URL directly to trigger the "Open with App" dialog.
        openExternal(chapterUrl)
      }
    }
  ]

  const isDark = readerTheme !== 'light'
  const bg = isDark ? 'bg-neutral-950' : 'bg-white'
  const cardBg = isDark ? 'bg-neutral-900/80 border-neutral-800/60' : 'bg-slate-50 border-slate-200'
  const textPrimary = isDark ? 'text-neutral-100' : 'text-slate-900'
  const textMuted = isDark ? 'text-neutral-400' : 'text-slate-500'
  const progressTrack = isDark ? 'bg-neutral-800' : 'bg-slate-200'
  const overlayBg = isDark ? 'bg-black/70' : 'bg-black/40'

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className={cn(
          'absolute inset-0 backdrop-blur-md animate-in fade-in duration-200',
          overlayBg
        )}
        onClick={onClose}
      />

      {/* Modal Panel */}
      <div
        className={cn(
          'relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl border overflow-hidden',
          'animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300',
          bg,
          isDark ? 'border-neutral-800/80' : 'border-slate-200'
        )}
      >
        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className={cn('w-10 h-1 rounded-full', isDark ? 'bg-neutral-700' : 'bg-slate-300')} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <BookOpen className={cn('h-4 w-4', isDark ? 'text-primary' : 'text-indigo-600')} />
            <h2 className={cn('text-base font-bold tracking-tight', textPrimary)}>
              Share Progress
            </h2>
          </div>
          <button
            onClick={onClose}
            className={cn(
              'rounded-full p-1.5 transition-colors',
              isDark ? 'hover:bg-neutral-800 text-neutral-400' : 'hover:bg-slate-100 text-slate-500'
            )}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Progress Card */}
        <div className="px-6 py-3">
          <div
            className={cn(
              'rounded-2xl border px-4 py-3.5 space-y-2.5',
              cardBg
            )}
          >
            {/* Manga title */}
            <p className={cn('text-sm font-bold truncate leading-none', textPrimary)}>
              {mangaTitle}
            </p>

            {/* Chapter info */}
            <p className={cn('text-xs font-medium', textMuted)}>
              Chapter {chapterNumber}
              {chapterTitle ? ` • ${chapterTitle}` : ''}
            </p>

            {/* Progress bar */}
            <div className="space-y-1.5">
              <div className={cn('w-full h-1.5 rounded-full overflow-hidden', progressTrack)}>
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-700',
                    isDark
                      ? 'bg-gradient-to-r from-primary/80 to-primary'
                      : 'bg-gradient-to-r from-indigo-500 to-violet-500'
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex justify-between items-center">
                <span className={cn('text-[10px] font-bold tabular-nums', textMuted)}>
                  {totalPages > 0 ? `Page ${currentPage} / ${totalPages}` : 'Loading…'}
                </span>
                {totalPages > 0 && (
                  <span
                    className={cn(
                      'text-[10px] font-black tabular-nums px-2 py-0.5 rounded-full',
                      isDark ? 'bg-primary/15 text-primary' : 'bg-indigo-100 text-indigo-600'
                    )}
                  >
                    {pct}%
                  </span>
                )}
              </div>
            </div>

            {/* Chapter URL */}
            <button
              onClick={() => openExternal(chapterUrl)}
              className={cn(
                'text-[10px] font-mono truncate flex items-center gap-1 transition-colors group w-full',
                textMuted,
                isDark ? 'hover:text-primary' : 'hover:text-indigo-600'
              )}
            >
              <ExternalLink className="h-2.5 w-2.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="truncate">{chapterUrl}</span>
            </button>
          </div>
        </div>

        {/* Share Targets */}
        <div className="px-6 pb-6 pt-2">
          <p className={cn('text-[10px] font-bold uppercase tracking-widest mb-3', textMuted)}>
            Share via
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {shareTargets.map((target) => (
              <button
                key={target.id}
                onClick={target.action}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-2xl border py-3 px-1 transition-all duration-200 active:scale-95',
                  target.color
                )}
              >
                <span className="flex items-center justify-center">{target.icon}</span>
                <span className="text-[9px] font-bold leading-none whitespace-nowrap tracking-wide">
                  {target.label}
                </span>
              </button>
            ))}
          </div>

          {/* Preview text */}
          <div className="mt-4">
            <p className={cn('text-[10px] font-bold uppercase tracking-widest mb-2', textMuted)}>
              Preview
            </p>
            <pre
              className={cn(
                'text-[11px] leading-relaxed font-mono whitespace-pre-wrap px-3 py-2.5 rounded-xl border',
                isDark
                  ? 'bg-neutral-900/60 border-neutral-800 text-neutral-400'
                  : 'bg-slate-50 border-slate-200 text-slate-500'
              )}
            >
              {shareText}
            </pre>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
