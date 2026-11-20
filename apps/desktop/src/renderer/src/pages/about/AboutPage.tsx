import { Card, Button, Badge, MobilePage } from '@renderer/shared/ui'
import { DataService } from '@renderer/shared/api'
import { isMobile } from '@renderer/shared/platform'
import { useNavigate } from 'react-router-dom'
import { Info, Github, ExternalLink, ShieldCheck, Code, Heart, Sparkles, Users } from 'lucide-react'
import appIcon from '../../app/assets/app-icon/256x256.png'

export default function AboutPage(): React.JSX.Element {
  const navigate = useNavigate()
  const mobile = isMobile()
  const version = DataService.version

  const features = [
    {
      title: 'Extension Architecture',
      description:
        'Flexible sandboxed engine supporting thousands of manga and anime community sources.',
      icon: Code
    },
    {
      title: 'Streamlined Reader',
      description:
        'Ultra-fast image prefetching, canvas rendering, and zero-latency page transitions.',
      icon: Sparkles
    },
    {
      title: 'Absolute Privacy',
      description:
        'Zero tracking, zero analytics, zero cloud dependencies. Your data stays 100% on device.',
      icon: ShieldCheck
    }
  ]

  return (
    <MobilePage
      title={mobile ? 'About' : undefined}
      subtitle={mobile ? 'Application Details' : undefined}
      onBack={mobile ? () => navigate('/more') : undefined}
    >
      <div className="flex-1 min-h-0 flex flex-col justify-between py-2 md:py-4 max-w-5xl mx-auto w-full space-y-5">
        {/* Hero Section */}
        <div className="flex flex-col items-center text-center space-y-3.5 relative overflow-hidden pt-2">
          {/* Subtle ambient glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-36 bg-primary/15 blur-[90px] rounded-full pointer-events-none -z-10" />

          {/* App Icon */}
          <div className="relative group cursor-default">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/80 via-primary/30 to-border/40 p-[2px] shadow-xl shadow-primary/15 transition-transform duration-300 group-hover:scale-105">
              <div className="w-full h-full rounded-[14px] bg-card/90 backdrop-blur-md flex items-center justify-center p-2 overflow-hidden">
                <img src={appIcon} className="w-full h-full object-contain" alt="AutaKimi" />
              </div>
            </div>
          </div>

          {/* Title & Badges */}
          <div className="space-y-1.5">
            <h1 className="text-4xl md:text-5xl font-black tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-foreground/60 bg-clip-text text-transparent pr-3 pb-0.5 inline-block select-none">
              AutaKimi
            </h1>
            <div className="flex items-center justify-center gap-2">
              <Badge
                variant="secondary"
                className="bg-primary/15 text-primary border-primary/25 rounded-full px-3 py-0.5 text-[11px] font-black tracking-wider shadow-sm"
              >
                v{version}
              </Badge>
              <Badge
                variant="outline"
                className="text-[10px] uppercase tracking-[0.2em] font-bold border-border/50 text-muted-foreground px-2.5 py-0.5 rounded-full bg-secondary/30"
              >
                Stable Desktop Build
              </Badge>
            </div>
          </div>

          {/* Tagline */}
          <p className="text-xs md:text-sm text-muted-foreground max-w-lg leading-relaxed font-medium">
            The ultimate open-source manga & anime experience for desktop. Built for speed, designed for stability, and powered by you.
          </p>

          {/* Action Links */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
            <Button
              size="sm"
              className="gap-2 rounded-xl px-4 h-9 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20 text-xs font-bold transition-all"
              onClick={() => DataService.openExternal('https://github.com/anasx07/AutaKimi')}
            >
              <Github className="h-4 w-4" />
              Source Code
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 rounded-xl px-4 h-9 border-border/60 bg-secondary/40 backdrop-blur-sm hover:bg-secondary/70 text-xs font-bold transition-all"
              onClick={() => DataService.openExternal('https://anasx07.github.io/AutaKimi/')}
            >
              <ExternalLink className="h-4 w-4" />
              Official Site
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 rounded-xl px-4 h-9 border-border/60 bg-secondary/40 backdrop-blur-sm hover:bg-secondary/70 text-xs font-bold transition-all"
              onClick={() => DataService.openExternal('https://discord.gg/qRbpCusgan')}
            >
              <ExternalLink className="h-4 w-4" />
              Join Discord
            </Button>
          </div>
        </div>

        {/* Features Bento Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {features.map((feature, idx) => {
            const Icon = feature.icon
            return (
              <Card
                key={idx}
                className="p-4 rounded-2xl bg-card/60 backdrop-blur-md border-border/50 hover:border-primary/40 hover:bg-secondary/20 transition-all duration-300 shadow-sm flex flex-col gap-2.5 group"
              >
                <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:scale-105 group-hover:bg-primary/15 transition-all">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-black text-xs uppercase tracking-wider text-foreground">
                    {feature.title}
                  </h3>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </Card>
            )
          })}
        </div>

        {/* Project Mission & Licensing Bento Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {/* Card 1: Project Brief & Contributors */}
          <Card className="p-4 rounded-2xl border-border/50 bg-card/60 backdrop-blur-md flex flex-col justify-between space-y-3 shadow-sm hover:border-primary/30 transition-all">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <Info className="h-3.5 w-3.5" />
                </div>
                <h2 className="text-xs font-black uppercase tracking-wider text-foreground">
                  Project Mission
                </h2>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                AutaKimi is a community-driven desktop application focused on lightweight architecture, seamless offline reading, and privacy-first digital media enjoyment.
              </p>
            </div>

            <div className="flex items-center justify-between pt-2.5 border-t border-border/40">
              <div className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-muted-foreground/60" />
                <div>
                  <p className="text-[11px] font-bold text-foreground leading-none">Core Development</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Codixy Contributors led by @anasx07</p>
                </div>
              </div>
              <div className="flex -space-x-2">
                {['AN', 'GR', 'AV'].map((initials, i) => (
                  <div
                    key={i}
                    className="w-7 h-7 rounded-full border-2 border-card bg-secondary/80 flex items-center justify-center text-[9px] font-black text-muted-foreground shadow-sm"
                  >
                    {initials}
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Card 2: Licensing & Open Source */}
          <Card className="p-4 rounded-2xl border-border/50 bg-card/60 backdrop-blur-md flex flex-col justify-between space-y-3 shadow-sm hover:border-primary/30 transition-all">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <ShieldCheck className="h-3.5 w-3.5" />
                  </div>
                  <h2 className="text-xs font-black uppercase tracking-wider text-foreground">
                    Open Source & Free
                  </h2>
                </div>
                <Badge className="bg-secondary/80 text-muted-foreground font-mono text-[9px] tracking-widest border-border/50">
                  MIT LICENSE
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Released under the permissive MIT License. You have complete freedom to study, modify, distribute, or fork this software forever.
              </p>
            </div>

            <div className="flex items-center justify-between pt-2.5 border-t border-border/40">
              <span className="text-[10px] text-muted-foreground font-medium">
                © 2026 AutaKimi Contributors
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-primary text-[10px] font-black uppercase tracking-wider gap-1 hover:bg-primary/10"
                onClick={() =>
                  DataService.openExternal('https://github.com/anasx07/AutaKimi/blob/main/LICENSE')
                }
              >
                Read Terms <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
          </Card>
        </div>

        {/* Footer Note */}
        <div className="text-center pt-1 pb-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground/40 flex items-center justify-center gap-1.5">
            Crafted with <Heart className="h-3 w-3 text-primary/60 inline fill-primary/30" /> for the community
          </p>
        </div>
      </div>
    </MobilePage>
  )
}
