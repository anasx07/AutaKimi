import { Info, Github, ExternalLink, Shield, Code, Heart } from 'lucide-react'
import { Card, Button, Badge } from '@renderer/shared/ui'

export default function AboutPage() {
  const features = [
    {
      title: 'Universal Extension System',
      description: 'Access thousands of manga through our flexible, sandboxed extension architecture.',
      icon: Code,
    },
    {
      title: 'Premium Reading Experience',
      description: 'Optimized image loading, multiple display modes, and smooth navigation.',
      icon: Heart,
    },
    {
      title: 'Privacy Focused',
      description: 'Your library and history stay local. No tracking, no accounts required.',
      icon: Shield,
    }
  ]

  return (
    <div className="p-8 w-full max-w-4xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Hero Section */}
      <div className="flex flex-col items-center text-center space-y-6 pt-8">
        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary via-purple-500 to-pink-500 flex items-center justify-center p-0.5 shadow-2xl shadow-primary/20 rotate-3 hover:rotate-0 transition-transform duration-500">
          <div className="w-full h-full bg-background rounded-[22px] flex items-center justify-center">
             <span className="text-4xl font-black bg-gradient-to-br from-primary to-purple-600 bg-clip-text text-transparent">LM</span>
          </div>
        </div>
        
        <div className="space-y-2">
          <h1 className="text-5xl font-extrabold tracking-tight">LManwa</h1>
          <div className="flex items-center justify-center gap-2">
            <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 animate-pulse">v0.1.0-alpha</Badge>
            <Badge variant="outline" className="text-[10px] uppercase tracking-widest font-bold opacity-60">Stable Build</Badge>
          </div>
        </div>
        
        <p className="text-xl text-muted-foreground max-w-2xl leading-relaxed">
          The ultimate open-source manga reader for desktop. 
          Built for speed, designed for readers, and powered by the community.
        </p>

        <div className="flex gap-4 pt-4">
          <Button className="gap-2 rounded-xl px-6 h-12">
            <Github className="h-5 w-5" />
            GitHub
          </Button>
          <Button variant="outline" className="gap-2 rounded-xl px-6 h-12 border-border/50">
            <ExternalLink className="h-5 w-5" />
            Website
          </Button>
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {features.map((feature, idx) => {
          const Icon = feature.icon
          return (
            <Card 
              key={idx} 
              className="p-6 bg-card/40 backdrop-blur-sm border-border/30 space-y-4 hover:border-primary/30 transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                <Icon className="h-6 w-6" />
              </div>
              <div className="space-y-2">
                <h3 className="font-bold text-lg">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Tech Stack / Credits */}
      <div className="space-y-6 pt-8">
        <div className="flex items-center gap-3">
          <Info className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold tracking-tight">About Project</h2>
        </div>
        
        <Card className="p-0 border-border/30 bg-card/20 overflow-hidden divide-y divide-border/20">
          <div className="p-6 flex items-start justify-between">
            <div className="space-y-1">
              <p className="font-semibold">Development Team</p>
              <p className="text-sm text-muted-foreground">Maintained by Antigravity AI Team</p>
            </div>
            <div className="flex -space-x-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="w-8 h-8 rounded-full border-2 border-background bg-secondary flex items-center justify-center text-[10px] font-bold">
                  {i === 1 ? 'AR' : i === 2 ? 'JD' : 'VS'}
                </div>
              ))}
            </div>
          </div>
          
          <div className="p-6 grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground opacity-70">Core Engine</p>
              <p className="text-sm font-medium">Electron + Node.js</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground opacity-70">Frontend</p>
              <p className="text-sm font-medium">React + Tailwind CSS</p>
            </div>
          </div>

          <div className="p-6 text-center">
            <p className="text-xs text-muted-foreground">
              Licensed under MIT License. Copyright © 2026 LManwa Contributors.
            </p>
          </div>
        </Card>
      </div>
      
      <div className="pt-12 pb-8 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-muted-foreground/30">
          Designed with love for the manga community
        </p>
      </div>
    </div>
  )
}
