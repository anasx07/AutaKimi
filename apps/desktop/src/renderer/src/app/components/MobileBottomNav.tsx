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
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md px-4 pb-[env(safe-area-inset-bottom,12px)] pt-2 flex items-center justify-around border-t border-border">
      {navItems.map((item) => {
        const Icon = item.icon
        return (
          <NavLink
            key={item.id}
            to={item.path}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-lg transition-colors duration-150 relative',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )
            }
          >
            {({ isActive }) => (
              <>
                <div className={cn('p-1 rounded-lg', isActive && 'bg-primary/10')}>
                  <Icon className={cn('h-5 w-5', isActive ? 'stroke-[2.25px]' : 'stroke-[1.75px]')} />
                </div>
                <span
                  className={cn(
                    'text-[10px] leading-none',
                    isActive ? 'font-semibold' : 'font-medium'
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
