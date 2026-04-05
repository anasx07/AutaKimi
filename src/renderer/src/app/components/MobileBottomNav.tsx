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
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-t border-border px-4 pb-[env(safe-area-inset-bottom)] pt-2 flex items-center justify-around safe-area-bottom shadow-[0_-8px_32px_rgba(0,0,0,0.1)]">
      {navItems.map((item) => {
        const Icon = item.icon
        return (
          <NavLink
            key={item.id}
            to={item.path}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center gap-1 py-1.5 px-3 rounded-xl transition-all duration-300',
                isActive
                  ? 'text-primary scale-110'
                  : 'text-muted-foreground hover:text-foreground active:scale-95'
              )
            }
          >
            {({ isActive }) => (
              <>
                <div
                  className={cn(
                    'relative p-1 rounded-lg transition-colors',
                    isActive && 'bg-primary/10'
                  )}
                >
                  <Icon className={cn('h-6 w-6', isActive ? 'stroke-[2.5px]' : 'stroke-[1.5px]')} />
                  {isActive && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full animate-in zoom-in duration-300" />
                  )}
                </div>
                <span
                  className={cn(
                    'text-[9px] font-black uppercase tracking-widest leading-none mt-1 transition-opacity duration-300',
                    isActive ? 'opacity-100' : 'opacity-50'
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
