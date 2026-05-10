import { Card, Button, Badge, MobilePage } from '@renderer/shared/ui'
import { DataService } from '@renderer/shared/api'
import { isMobile } from '@renderer/shared/platform'
import { useNavigate } from 'react-router-dom'
import { Info, Github, ExternalLink, Shield, Code, Heart } from 'lucide-react'
import appIcon from '../../app/assets/app-icon/256x256.png'

export default function AboutPage(): React.JSX.Element {
  const navigate = useNavigate()
  const mobile = isMobile()
  const version = DataService.version

  const features = [
    {
      title: 'Extension System',
      description:
        'Flexible, sandboxed architecture supporting thousands of manga and anime sources.',
      icon: Code
    },
    {
      title: 'Premium Experience',
      description:
        'Optimized image loading, smart infinite scroll, and immersive horizontal/paged modes.',
      icon: Heart
    },
    {
      title: 'Privacy First',
      description:
        'No accounts, no tracking, and no telemetry. All your data stays locally on your device.',
      icon: Shield
    }
  ]

  return (
    <MobilePage
      title="About"
      subtitle="Application Details"
      onBack={mobile ? () => navigate('/more') : undefined}
    >
      <div className="flex-1 min-h-0 scroll-smooth">
        {/* Hero Section */}
        <div className="flex flex-col items-center text-center space-y-8 pt-12 relative overflow-hidden">
          {/* Decorative background glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-primary/10 blur-[120px] rounded-full pointer-events-none -z-10" />

          <div className="w-28 h-28 rounded-full bg-gradient-to-br from-primary via-purple-500 to-pink-500 flex items-center justify-center shadow-2xl shadow-primary/20 hover:scale-105 transition-transform duration-500 cursor-default">
            <div className="w-full h-full rounded-[22px] flex items-center justify-center ">
              <img src={appIcon} className="w-full h-full object-cover p-1" alt="AutaKimi" />
            </div>
          </div>

          <div className="space-y-4">
            <h1 className="text-7xl font-black tracking-tighter bg-gradient-to-r from-foreground via-foreground/80 to-foreground/60 bg-clip-text text-transparent">
              AutaKimi
            </h1>
            <div className="flex items-center justify-center gap-3">
              <Badge
                variant="secondary"
                className="bg-primary/20 text-primary border-primary/30 rounded-full px-4 py-1 text-xs font-black tracking-widest shadow-lg animate-in zoom-in-50 duration-500"
              >
                v{version}
              </Badge>
              <Badge
                variant="outline"
                className="text-[10px] uppercase tracking-[0.3em] font-bold border-border/50 opacity-70 px-3 py-1 rounded-full"
              >
                Stable Build
              </Badge>
            </div>
          </div>

          <p className="text-xl text-muted-foreground max-w-2xl leading-relaxed italic font-medium">
            The ultimate open-source manga & anime experience for desktop. Built for speed, designed
            for stability, and powered by you.
          </p>

          <div className="flex gap-4 pt-4">
            <Button
              className="gap-2.5 rounded-2xl px-8 h-12 bg-primary hover:bg-primary/90 shadow-xl shadow-primary/10 font-bold"
              onClick={() => DataService.openExternal('https://github.com/anasx07/AutaKimi')}
            >
              <Github className="h-5 w-5" />
              Source Code
            </Button>
            <Button
              variant="outline"
              className="gap-2.5 rounded-2xl px-8 h-12 border-border/50 bg-secondary/50 backdrop-blur-sm hover:bg-secondary font-bold transition-all"
              onClick={() =>
                DataService.openExternal('https://anasx07.github.io/AutaKimi-Release/')
              }
            >
              <ExternalLink className="h-5 w-5" />
              Official Site
            </Button>
            <Button
              variant="outline"
              className="gap-2.5 rounded-2xl px-8 h-12 border-border/50 bg-secondary/50 backdrop-blur-sm hover:bg-secondary font-bold transition-all"
              onClick={() => DataService.openExternal('https://discord.gg/qRbpCusgan')}
            >
              <ExternalLink className="h-5 w-5" />
              Join Discord Server
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
          {features.map((feature, idx) => {
            const Icon = feature.icon
            return (
              <Card
                key={idx}
                className="p-8 bg-card backdrop-blur-xl border-border/50 space-y-5 hover:border-primary/40 hover:bg-secondary/50 transition-all duration-500 group shadow-2xl hover:shadow-primary/5"
              >
                <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center text-primary group-hover:scale-110 group-hover:bg-primary/10 transition-all duration-500 border border-border/50 group-hover:border-primary/20">
                  <Icon className="h-7 w-7" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-black text-xl uppercase tracking-tighter italic text-foreground">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed font-medium">
                    {feature.description}
                  </p>
                </div>
              </Card>
            )
          })}
        </div>

        {/* Team & License Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-4">
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center gap-3">
              <Badge className="bg-primary/10 text-primary p-1.5 rounded-lg border-primary/20">
                <Info className="h-5 w-5" />
              </Badge>
              <h2 className="text-xl font-black uppercase tracking-tighter italic text-foreground">
                Project Brief
              </h2>
            </div>
            <Card className="p-8 border-border/50 bg-card backdrop-blur-sm space-y-6">
              <p className="text-muted-foreground leading-relaxed font-medium">
                AutaKimi is a community-driven project dedicated to creating the most stable and
                performant platform for digital media consumption. We focus on lightweight
                architecture and extensible design to support a diverse range of sources while
                respecting user privacy.
              </p>
              <div className="flex items-center justify-between pt-4 border-t border-border/50">
                <div className="space-y-1">
                  <p className="text-sm font-bold text-foreground">Development Team</p>
                  <p className="text-xs text-muted-foreground">
                    Codixy Contributors Leaded by @anasx07
                  </p>
                </div>
                <div className="flex -space-x-3">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="w-10 h-10 rounded-full border-2 border-background bg-secondary flex items-center justify-center text-xs font-black text-muted-foreground shadow-xl"
                    >
                      {i === 1 ? 'AN' : i === 2 ? 'GR' : 'AV'}
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <Badge className="bg-primary/10 text-primary p-1.5 rounded-lg border-primary/20">
                <Shield className="h-5 w-5" />
              </Badge>
              <h2 className="text-xl font-black uppercase tracking-tighter italic text-foreground">
                Licensing
              </h2>
            </div>
            <Card className="p-8 border-border/50 bg-card flex flex-col items-center text-center justify-center space-y-4">
              <Badge className="bg-secondary text-muted-foreground font-mono text-[10px] tracking-widest border-border/50">
                MIT LICENSE
              </Badge>
              <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                Copyright © 2026 AutaKimi Contributors. Free to use, fork, and adapt.
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="text-primary text-[10px] font-black uppercase tracking-widest gap-2"
                onClick={() => DataService.openExternal('https://github.com/anasx07/AutaKimi-Release/blob/main/LICENSE')}
              >
                Read Terms <ExternalLink className="h-3 w-3" />
              </Button>
            </Card>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-20 pb-12 text-center space-y-4">
          <div className="h-px w-32 bg-gradient-to-r from-transparent via-border to-transparent mx-auto" />
          <p className="text-[10px] font-black uppercase tracking-[0.5em] text-muted-foreground/40 animate-pulse">
            Crafted with passion for the manga community
          </p>
        </div>
      </div>
    </MobilePage>
  )
}
