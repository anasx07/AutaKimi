import { Settings, Tv, Info, ChevronRight, Github, Heart } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Card, Button, Badge, MobilePage } from '@renderer/shared/ui'
import { cn } from '@renderer/shared/lib/utils'
import { DataService } from '@renderer/shared/api'

export default function MorePage(): React.JSX.Element {
  const navigate = useNavigate()

  const moreItems = [
    {
      id: 'anime',
      label: 'Anime',
      description: 'Watch your favorite titles',
      icon: Tv,
      path: '/anime',
      badge: 'BETA',
      color: 'text-amber-500',
      bg: 'bg-amber-500/10'
    },
    {
      id: 'settings',
      label: 'Settings',
      description: 'App configuration & UI',
      icon: Settings,
      path: '/settings',
      color: 'text-primary',
      bg: 'bg-primary/10'
    },
    {
      id: 'about',
      label: 'About',
      description: 'Version and links',
      icon: Info,
      path: '/about',
      color: 'text-neutral-400',
      bg: 'bg-neutral-500/10'
    }
  ]

  return (
    <MobilePage title="More" subtitle="Navigation Portal">
      <div className="flex-1 flex flex-col">
        {/* Grid of Portal Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {moreItems.map((item) => {
            const Icon = item.icon
            return (
              <Card
                key={item.id}
                onClick={() => navigate(item.path)}
                className="relative group cursor-pointer border-border/40 hover:border-primary/50 bg-card/40 backdrop-blur-md transition-all active:scale-[0.98] overflow-hidden rounded-2xl p-4 flex items-center gap-4"
              >
                <div
                  className={cn(
                    'h-12 w-12 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 duration-500',
                    item.bg,
                    item.color
                  )}
                >
                  <Icon className="h-6 w-6 stroke-[2.5px]" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm uppercase tracking-tight">{item.label}</h3>
                    {item.badge && (
                      <Badge
                        variant="secondary"
                        className="text-[9px] h-4 px-1.5 font-black bg-primary/20 text-primary border-none"
                      >
                        {item.badge}
                      </Badge>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground font-medium truncate opacity-60 italic uppercase tracking-tighter">
                    {item.description}
                  </p>
                </div>

                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />

                {/* Decorative Background Element */}
                <div
                  className={cn(
                    'absolute -right-4 -bottom-4 h-16 w-16 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-700',
                    item.color
                  )}
                >
                  <Icon className="h-full w-full" />
                </div>
              </Card>
            )
          })}
        </div>

        {/* App Stats / Interactive Info Footer */}
        <div className="mt-auto pt-10 space-y-6">
          <div className="p-4 rounded-2xl bg-secondary/30 border border-border/40 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                <Github className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-foreground">AutaKimi Mobile</p>
                <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-widest">
                  v{DataService.version}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[9px] font-black uppercase tracking-tighter hover:bg-primary/10 hover:text-primary rounded-lg border border-transparent hover:border-primary/20"
            >
              Updates
            </Button>
          </div>

          <div className="text-center pb-8 opacity-40 hover:opacity-100 transition-opacity">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-1.5">
              Made with <Heart className="h-2.5 w-2.5 fill-red-500 text-red-500 animate-pulse" /> by
              Team AutaKimi
            </p>
          </div>
        </div>
      </div>
    </MobilePage>
  )
}
