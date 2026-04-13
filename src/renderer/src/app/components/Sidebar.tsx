import { useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  BookOpen,
  Compass,
  Settings,
  Info,
  Clock,
  Download,
  ChartBarIncreasing,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { cn } from '@renderer/shared/lib/utils'
import { DataService } from '@renderer/shared/api'
import appIcon from '../assets/app-icon/64x64.png'

interface SidebarProps {
  onCollapseToggle?: (isCollapsed: boolean) => void
}

export function Sidebar({ onCollapseToggle }: SidebarProps): React.JSX.Element {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  const handleToggle = (): void => {
    const next = !isSidebarCollapsed
    setIsSidebarCollapsed(next)
    onCollapseToggle?.(next)
  }

  const sidebarItems = useMemo(
    () => [
      { id: 'library', path: '/library', label: 'Library', icon: BookOpen },
      { id: 'downloads', path: '/downloads', label: 'Downloads', icon: Download },
      { id: 'history', path: '/history', label: 'History', icon: Clock },
      { id: 'browse', path: '/browse', label: 'Manga Browser', icon: Compass },
      { id: 'anime', path: '/anime', label: 'Anime (BETA)', icon: ChartBarIncreasing },
      { id: 'settings', path: '/settings', label: 'Settings', icon: Settings },
      { id: 'about', path: '/about', label: 'About', icon: Info }
    ],
    []
  )

  return (
    <aside
      className={cn(
        'glass-panel flex flex-col transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] z-20',
        isSidebarCollapsed ? 'w-20' : 'w-64'
      )}
    >
      <div className={cn('p-6 flex items-center justify-between', isSidebarCollapsed && 'px-4')}>
        {!isSidebarCollapsed && (
          <h2 className="text-xl font-bold tracking-tight bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent animate-in fade-in duration-500">
            AutaKimi
          </h2>
        )}
        <button
          onClick={handleToggle}
          className="p-1.5 rounded-lg hover:bg-secondary/40 text-muted-foreground hover:text-foreground transition-colors ml-auto"
        >
          {isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <nav className="flex-1 px-3 space-y-2 overflow-y-auto no-scrollbar">
        {sidebarItems.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.id}
              to={item.path}
              title={isSidebarCollapsed ? item.label : undefined}
              className={({ isActive }) =>
                cn(
                  'flex items-center w-full rounded-xl text-sm font-medium transition-all group relative border border-transparent',
                  isSidebarCollapsed ? 'justify-center py-3' : 'px-4 py-2.5 gap-3',
                  isActive
                    ? 'glass-card aura-glow text-primary'
                    : 'text-muted-foreground hover:bg-secondary/40 hover:text-foreground hover:translate-x-1'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={cn(
                      'h-5 w-5 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]',
                      isActive
                        ? 'text-primary [filter:drop-shadow(0_0_5px_hsl(var(--primary)/0.6))] scale-110'
                        : 'text-muted-foreground group-hover:text-foreground group-hover:scale-110'
                    )}
                  />
                  {!isSidebarCollapsed && (
                    <span className="truncate animate-in fade-in slide-in-from-left-2 duration-300">
                      {item.label}
                    </span>
                  )}
                  {isActive && !isSidebarCollapsed && (
                    <div className="absolute -left-1 w-1 h-5 bg-primary rounded-full shadow-[0_0_10px_hsl(var(--primary))] animate-in fade-in duration-500" />
                  )}
                </>
              )}
            </NavLink>
          )
        })}
      </nav>

      <div
        className={cn(
          'p-4 border-t border-border mt-auto flex items-center gap-3',
          isSidebarCollapsed && 'justify-center px-2'
        )}
      >
        <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-secondary/40 shrink-0 group hover:ring-2 ring-primary/20 transition-all cursor-pointer">
          <img
            src={appIcon}
            className="w-6 h-6 object-contain group-hover:scale-110 transition-transform"
            alt="Logo"
          />
        </div>
        {!isSidebarCollapsed && (
          <div className="flex-1 min-w-0 animate-in fade-in duration-500">
            <p className="text-xs font-bold text-foreground truncate">Local User</p>
            <p className="text-[10px] text-muted-foreground font-medium">v{DataService.version}</p>
          </div>
        )}
      </div>
    </aside>
  )
}
