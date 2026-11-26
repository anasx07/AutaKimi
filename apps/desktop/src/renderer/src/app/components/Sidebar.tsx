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
import { useLibraryStore, useUIStore } from '@renderer/shared/model'
import appIcon from '../assets/app-icon/64x64.png'
import { SIDEBAR_COLLAPSE_STORAGE_KEY, resolveSidebarCollapsedState } from './sidebarState'
import { resolveBrowseNavTarget, sharedTabNavigationMemory } from './navigationMemory'

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
  const { selectedManga, setSelectedManga, setActiveChapter } = useLibraryStore()
  const updateStatus = useUIStore((s) => s.updateStatus)
  const updateVersion = useUIStore((s) => s.updateVersion)
  const hasUpdateReady = updateStatus === 'downloaded'

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
        'relative flex flex-col bg-card/70 border-r border-border transition-[width] duration-200 ease-out z-40 shrink-0',
        isSidebarCollapsed ? 'w-[70px]' : 'w-60'
      )}
    >
      <div
        className={cn(
          'px-5 py-4 flex items-center justify-between',
          isSidebarCollapsed && 'px-3 justify-center'
        )}
      >
        {!isSidebarCollapsed && (
          <div className="flex items-center gap-2 min-w-0">
            <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
            <h2 className="text-base font-bold tracking-tight text-foreground truncate select-none">
              AutaKimi
            </h2>
          </div>
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
        className="flex-1 px-2.5 space-y-1 overflow-y-auto no-scrollbar"
      >
        {sidebarItems.map((item) => {
          const Icon = item.icon
          const isRouteActive =
            location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)
          const targetPath =
            item.id === 'browse'
              ? resolveBrowseNavTarget(
                  location.pathname,
                  sharedTabNavigationMemory.getLastBrowsePath()
                )
              : item.path
          return (
            <NavLink
              key={item.id}
              to={targetPath}
              onClick={(e) => {
                if (isRouteActive && selectedManga) {
                  e.preventDefault()
                  setSelectedManga(null)
                  setActiveChapter(null)
                  sharedTabNavigationMemory.clearOverlay(location.pathname)
                }
              }}
              onMouseEnter={(e) => {
                if (!isSidebarCollapsed || !asideRef.current) return
                const itemRect = e.currentTarget.getBoundingClientRect()
                const asideRect = asideRef.current.getBoundingClientRect()
                const tooltipLabel =
                  item.id === 'about' && hasUpdateReady
                    ? `About · Update${updateVersion ? ` v${updateVersion}` : ''} Ready`
                    : item.label
                setHoveredCapsule({
                  id: item.id,
                  label: tooltipLabel,
                  top: itemRect.top - asideRect.top + itemRect.height / 2,
                  isActive: isRouteActive
                })
              }}
              onMouseLeave={() => {
                setHoveredCapsule((prev) => (prev?.id === item.id ? null : prev))
              }}
              className={({ isActive }) =>
                cn(
                  'flex items-center w-full rounded-lg text-[13px] font-medium transition-colors duration-150 group relative border',
                  isSidebarCollapsed ? 'justify-center py-2.5' : 'px-3 py-2 gap-3',
                  isActive
                    ? 'bg-secondary/80 border-border text-foreground font-semibold'
                    : 'border-transparent text-muted-foreground hover:bg-secondary/40 hover:text-foreground'
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && !isSidebarCollapsed && (
                    <div className="absolute left-0 w-[3px] h-4 bg-primary rounded-r-full" />
                  )}
                  <div className="relative shrink-0">
                    <Icon
                      className={cn(
                        'h-[18px] w-[18px] shrink-0 transition-colors duration-150',
                        isActive
                          ? 'text-primary'
                          : 'text-muted-foreground group-hover:text-foreground'
                      )}
                    />
                    {item.id === 'about' && hasUpdateReady && isSidebarCollapsed && (
                      <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-card" />
                    )}
                  </div>
                  {!isSidebarCollapsed && (
                    <span className="truncate flex-1">{item.label}</span>
                  )}
                  {!isSidebarCollapsed && item.id === 'about' && hasUpdateReady && (
                    <span
                      className="h-2 w-2 rounded-full bg-emerald-500 shrink-0 animate-pulse"
                      title={`Update${updateVersion ? ` v${updateVersion}` : ''} ready`}
                    />
                  )}
                </>
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* Floating Tooltip on Hover in Collapsed Mode (outside overflow-y-auto nav to prevent clipping) */}
      {isSidebarCollapsed && hoveredCapsule && (
        <div
          role="tooltip"
          style={{ top: hoveredCapsule.top }}
          className={cn(
            'pointer-events-none absolute left-[calc(100%+10px)] -translate-y-1/2 z-50 px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap shadow-lg border',
            hoveredCapsule.isActive
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-popover text-popover-foreground border-border'
          )}
        >
          {hoveredCapsule.label}
        </div>
      )}

      <div
        className={cn(
          'p-3.5 border-t border-border mt-auto flex items-center gap-2.5',
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
              label: `Local User · v${DataService.version}`,
              top: rect.top - asideRect.top + rect.height / 2,
              isActive: false
            })
          }}
          onMouseLeave={() => {
            setHoveredCapsule((prev) => (prev?.id === '__profile__' ? null : prev))
          }}
          className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center bg-secondary/60 border border-border shrink-0 cursor-pointer"
        >
          <img src={appIcon} className="w-5 h-5 object-contain" alt="Logo" />
        </div>
        {!isSidebarCollapsed && (
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground truncate">Local User</p>
            <p className="text-[11px] text-muted-foreground">v{DataService.version}</p>
          </div>
        )}
      </div>
    </aside>
  )
}
