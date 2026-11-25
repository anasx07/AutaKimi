import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  BookOpen,
  Compass,
  Settings,
  Info,
  Clock,
  Download,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { cn } from '@renderer/shared/lib/utils'
import { DataService } from '@renderer/shared/api'
import appIcon from '../assets/app-icon/64x64.png'
import { SIDEBAR_COLLAPSE_STORAGE_KEY, resolveSidebarCollapsedState } from './sidebarState'

interface SidebarProps {
  autoCollapsed?: boolean
  onCollapseToggle?: (isCollapsed: boolean) => void
}

interface HoveredNavCapsule {
  id: string
  label: string
  top: number
  isActive: boolean
}

export function Sidebar({
  autoCollapsed = false,
  onCollapseToggle
}: SidebarProps): React.JSX.Element {
  const [userPrefCollapsed, setUserPrefCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSE_STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  })
  const [watchOverride, setWatchOverride] = useState<boolean | null>(null)
  const [hoveredCapsule, setHoveredCapsule] = useState<HoveredNavCapsule | null>(null)

  const asideRef = useRef<HTMLElement | null>(null)
  const location = useLocation()

  // Clear temporary watch override whenever watch mode turns on/off
  useEffect(() => {
    setWatchOverride(null)
    setHoveredCapsule(null)
  }, [autoCollapsed])

  const isSidebarCollapsed = resolveSidebarCollapsedState({
    userPrefCollapsed,
    autoCollapsed,
    watchOverride
  })

  useEffect(() => {
    onCollapseToggle?.(isSidebarCollapsed)
  }, [isSidebarCollapsed, onCollapseToggle])

  const handleToggle = (): void => {
    const next = !isSidebarCollapsed
    setHoveredCapsule(null)
    if (autoCollapsed) {
      setWatchOverride(next)
    } else {
      setUserPrefCollapsed(next)
      try {
        localStorage.setItem(SIDEBAR_COLLAPSE_STORAGE_KEY, String(next))
      } catch {}
    }
  }

  const sidebarItems = useMemo(
    () => [
      { id: 'library', path: '/library', label: 'Library', icon: BookOpen },
      { id: 'downloads', path: '/downloads', label: 'Downloads', icon: Download },
      { id: 'history', path: '/history', label: 'History', icon: Clock },
      { id: 'browse', path: '/browse', label: 'Browse', icon: Compass },
      { id: 'settings', path: '/settings', label: 'Settings', icon: Settings },
      { id: 'about', path: '/about', label: 'About', icon: Info }
    ],
    []
  )

  return (
    <aside
      ref={asideRef}
      className={cn(
        'glass-panel relative flex flex-col transition-all duration-500 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] z-40',
        isSidebarCollapsed ? 'w-20' : 'w-64'
      )}
    >
      <div
        className={cn(
          'p-6 flex items-center justify-between',
          isSidebarCollapsed && 'px-4 justify-center'
        )}
      >
        {!isSidebarCollapsed && (
          <h2 className="text-xl font-bold tracking-tight bg-gradient-to-r from-primary to-rose-400 bg-clip-text text-transparent animate-in fade-in duration-500 pr-2 inline-block">
            AutaKimi
          </h2>
        )}
        <button
          type="button"
          onClick={handleToggle}
          title={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          className={cn(
            'p-1.5 rounded-lg hover:bg-secondary/40 text-muted-foreground hover:text-foreground transition-colors',
            !isSidebarCollapsed && 'ml-auto'
          )}
        >
          {isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <nav
        onScroll={() => setHoveredCapsule(null)}
        className="flex-1 px-3 space-y-2 overflow-y-auto no-scrollbar"
      >
        {sidebarItems.map((item) => {
          const Icon = item.icon
          const isRouteActive =
            location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)
          return (
            <NavLink
              key={item.id}
              to={item.path}
              onMouseEnter={(e) => {
                if (!isSidebarCollapsed || !asideRef.current) return
                const itemRect = e.currentTarget.getBoundingClientRect()
                const asideRect = asideRef.current.getBoundingClientRect()
                setHoveredCapsule({
                  id: item.id,
                  label: item.label,
                  top: itemRect.top - asideRect.top + itemRect.height / 2,
                  isActive: isRouteActive
                })
              }}
              onMouseLeave={() => {
                setHoveredCapsule((prev) => (prev?.id === item.id ? null : prev))
              }}
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
                      'h-5 w-5 transition-all duration-500 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)]',
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

      {/* Floating Capsule Pill on Hover in Collapsed Mode (outside overflow-y-auto nav to prevent clipping) */}
      {isSidebarCollapsed && hoveredCapsule && (
        <div
          role="tooltip"
          style={{ top: hoveredCapsule.top }}
          className={cn(
            'pointer-events-none absolute left-[calc(100%+12px)] -translate-y-1/2 z-50 px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap shadow-xl border backdrop-blur-xl animate-in fade-in slide-in-from-left-2 duration-150',
            hoveredCapsule.isActive
              ? 'bg-primary text-primary-foreground border-primary/50 shadow-primary/25'
              : 'bg-popover/95 text-popover-foreground border-border/80'
          )}
        >
          {hoveredCapsule.label}
        </div>
      )}

      <div
        className={cn(
          'p-4 border-t border-border mt-auto flex items-center gap-3',
          isSidebarCollapsed && 'justify-center px-2'
        )}
      >
        <div
          onMouseEnter={(e) => {
            if (!isSidebarCollapsed || !asideRef.current) return
            const rect = e.currentTarget.getBoundingClientRect()
            const asideRect = asideRef.current.getBoundingClientRect()
            setHoveredCapsule({
              id: '__profile__',
              label: `Local User • v${DataService.version}`,
              top: rect.top - asideRect.top + rect.height / 2,
              isActive: false
            })
          }}
          onMouseLeave={() => {
            setHoveredCapsule((prev) => (prev?.id === '__profile__' ? null : prev))
          }}
          className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-secondary/40 shrink-0 group hover:ring-2 ring-primary/20 transition-all cursor-pointer"
        >
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
