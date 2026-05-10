import { cn } from '@renderer/shared/lib/utils'
import { ThemeOption } from '@renderer/shared/config/themes'

interface ThemeCardProps {
  opt: ThemeOption
  isActive: boolean
  isPremium?: boolean
  onSelect: (opt: ThemeOption) => void
}

export function ThemeCard({ opt, isActive, isPremium = false, onSelect }: ThemeCardProps): React.JSX.Element {
  return (
    <button
      key={opt.id}
      onClick={() => onSelect(opt)}
      className={cn(
        'group flex items-center rounded-xl transition-all duration-200 text-left relative overflow-hidden border',
        isPremium ? 'gap-4 p-5 min-h-[110px]' : 'gap-3 p-4',
        opt.bgClass,
        opt.borderClass,
        isActive
          ? 'ring-2 ring-primary ring-offset-2 ring-offset-background opacity-100'
          : 'hover:scale-[1.02] hover:shadow-md active:scale-95 opacity-70 hover:opacity-100 grayscale-[0.2]'
      )}
      style={
        opt.bgImage
          ? {
              backgroundImage: `url(${opt.bgImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center 20%'
            }
          : undefined
      }
    >
      {opt.bgImage && (
        <div
          className={cn(
            'absolute inset-0 transition-colors z-0',
            opt.theme === 'light'
              ? 'bg-white/40 group-hover:bg-white/20'
              : 'bg-black/30 group-hover:bg-black/10'
          )}
        />
      )}
      <div
        className={cn(
          'relative z-10 rounded-lg flex items-center justify-center shrink-0 border',
          isPremium ? 'w-14 h-14' : 'w-10 h-10',
          opt.boxClass || 'border-transparent bg-transparent'
        )}
      >
        <div className={cn('w-3 h-3 rounded-full shadow-sm', opt.dotClass)} />
      </div>
      <div className="relative z-10">
        <div
          className={cn(
            'flex items-center gap-2',
            isPremium
              ? 'text-base font-black tracking-tight mb-1 drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,0.8)]'
              : 'font-bold text-sm'
          )}
        >
          {opt.name}
          {opt.tag && (
            <span className="text-[9px] font-bold uppercase tracking-wider bg-black/60 text-white px-1.5 py-0.5 rounded shadow border border-white/10">
              {opt.tag}
            </span>
          )}
        </div>
        <div className={cn(isPremium ? 'text-sm' : 'text-xs mt-0.5', opt.descClass)}>
          {opt.desc}
        </div>
      </div>
    </button>
  )
}
