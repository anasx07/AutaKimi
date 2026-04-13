import { NavLink } from 'react-router-dom'
import { BookOpen, Compass, Clock, Download, MoreHorizontal } from 'lucide-react'
import { cn } from '@renderer/shared/lib/utils'


export function MobileBottomNav(): React.JSX.Element {
  const navItems = [
    { id: 'library', path: '/library', label: 'Library', icon: BookOpen },
    { id: 'browse', path: '/browse', label: 'Browse', icon: Compass },
    { id: 'downloads', path: '/downloads', label: 'Downloads', icon: Download },
    { id: 'history', path: '/history', label: 'History', icon: Clock },
    { id: 'more', path: '/more', label: 'More', icon: MoreHorizontal }
  ]



  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass-panel px-6 pb-[env(safe-area-inset-bottom,20px)] pt-3 flex items-center justify-around shadow-[0_-8px_32px_rgba(0,0,0,0.1)] border-t border-border/40">
      {navItems.map((item) => {
        const Icon = item.icon
        return (
          <NavLink
            key={item.id}
            to={item.path}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center gap-1.5 py-1 px-4 rounded-2xl transition-all duration-300 relative group',
                isActive
                  ? 'text-primary scale-110'
                  : 'text-muted-foreground hover:text-foreground active:scale-90'
              )
            }
          >
            {({ isActive }) => (
              <>
                <div
                  className={cn(
                    'relative p-1.5 rounded-xl transition-all duration-300',
                    isActive && 'bg-primary/10 aura-glow'
                  )}
                >
                  <Icon className={cn('h-6 w-6 transition-transform group-hover:scale-110', isActive ? 'stroke-[2.5px]' : 'stroke-[1.5px]')} />
                  {isActive && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-primary rounded-full shadow-[0_0_10px_hsl(var(--primary))] animate-in zoom-in duration-300" />
                  )}
                </div>
                <span
                  className={cn(
                    'text-[10px] font-black uppercase tracking-widest leading-none mt-1 transition-all duration-300',
                    isActive ? 'opacity-100 scale-105' : 'opacity-40'
                  )}
                >
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        )
      })}
    </nav>
  )
}
