"use client";

import { 
  Download, BookOpen, Puzzle, History, Search, Zap, 
  ChevronDown, Globe, MonitorSmartphone, MessageSquare, 
  Sparkles, Terminal, Shield, ArrowRight, Activity
} from 'lucide-react'
import { useState, useEffect } from 'react'
import Image from 'next/image'

import { MediaButton } from '@/components/ui/media-button'
import { GlowCard } from '@/components/ui/spotlight-card'
import AppSimulator from '@/components/ui/app-simulator'

export default function Home() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [version, setVersion] = useState("2.0.11")

  useEffect(() => {
    fetch('https://api.github.com/repos/anasx07/AutaKimi/releases/latest')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (data.tag_name) {
          setVersion(data.tag_name.replace(/^v/, ''));
        }
      })
      .catch(err => {
        console.warn('Latest release version fetch skipped/failed (using fallback version):', err.message || err);
      });
  }, []);

  const features = [
    {
      icon: <BookOpen className="w-6 h-6 text-orange-400" />,
      title: "Personal Library",
      description: "Organize your collection with a beautiful, responsive library interface. Track your reading state seamlessly."
    },
    {
      icon: <Globe className="w-6 h-6 text-indigo-400" />,
      title: "Global Localization",
      description: "Full native support for Arabic (العربية) and English, ensuring an absolute native experience for global readers."
    },
    {
      icon: <Zap className="w-6 h-6 text-yellow-400" />,
      title: "Native Anime Streamer",
      description: "Watch your favorite anime series with our built-in, high-performance video player containing customizable speed feeds."
    },
    {
      icon: <Puzzle className="w-6 h-6 text-pink-400" />,
      title: "Modular Scraper Engine",
      description: "Expand your content catalog with an advanced, language-aware extension system and simple bulk package updates."
    },
    {
      icon: <Search className="w-6 h-6 text-cyan-400" />,
      title: "Smart Cross-Source Search",
      description: "Find any manga title or anime episode across all your connected community indexers instantly."
    },
    {
      icon: <Terminal className="w-6 h-6 text-emerald-400" />,
      title: "Privacy First & Open",
      description: "Zero analytics tracking. Your database, cache files, extensions, and bookmarks stay completely local."
    }
  ]

  const showcases = [
    {
      badge: "Customization",
      title: "Premium Themes & Aesthetics",
      description: "Make AutaKimi yours. Choose from a variety of premium themes, ranging from classic deep dark modes to character-inspired vibrant aesthetics. Experience smooth transitions on every screen change.",
      image: "/AutaKimi/assets/screenshot-themes.png"
    },
    {
      badge: "Discovery",
      title: "Index Search & Smart Filters",
      description: "Instantly locate your next series across community-managed scraping sources using customized language and safety filtration parameters.",
      image: "/AutaKimi/assets/screenshot-search.png",
      reverse: true
    }
  ]

  const faqs = [
    { q: "Is AutaKimi free to use?", a: "Yes, AutaKimi is 100% free, open-source, and contains zero tracking, advertisements, or data collection." },
    { q: "How do I install extensions?", a: "Extensions are lightweight plugins that can be installed instantly via the extension catalog inside the application with a single click." },
    { q: "Does it support offline reading?", a: "Yes, you can easily download your favorite manga chapters or cache anime metadata locally for offline access." }
  ]

  return (
    <div className="relative flex flex-col items-center w-full">
      {/* Background decoration */}
      <div className="absolute top-0 inset-x-0 h-[600px] bg-gradient-to-b from-orange-500/5 via-amber-500/5 to-transparent pointer-events-none z-0" />
      
      {/* SPLIT HERO SECTION */}
      <header className="w-full max-w-6xl px-6 pt-10 pb-20 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
        
        {/* Left column: Text details */}
        <div className="lg:col-span-7 space-y-8 text-left max-w-2xl mx-auto lg:mx-0">
          <div className="flex flex-wrap items-center gap-3">
            <span className="premium-pill bg-orange-500/10 border-orange-500/20 text-orange-300 flex items-center gap-1.5 py-1 px-3.5">
              <Sparkles className="w-3 h-3 text-orange-400" />
              <span>Version {version}</span>
            </span>
            <span className="text-xs font-mono text-zinc-500 flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-green-400" />
              <span>Active Desktop Build</span>
            </span>
          </div>

          <div className="space-y-4">
            <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-[1.05] text-white">
              The Next Gen Media <span className="text-gradient font-black">Framework</span>
            </h1>
            <p className="text-lg md:text-xl text-zinc-400 leading-relaxed font-sans font-medium">
              AutaKimi is a professional, privacy-first media reader for Windows. Extensible, localized, and optimized for speed.
            </p>
          </div>

          {/* Quick Stats Mock */}
          <div className="grid grid-cols-3 gap-6 py-4 border-y border-white/5 max-w-md">
            <div>
              <p className="text-2xl font-black text-white">100%</p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Privacy First</p>
            </div>
            <div>
              <p className="text-2xl font-black text-white">0ms</p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Lag Response</p>
            </div>
            <div>
              <p className="text-2xl font-black text-white">2+</p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Languages</p>
            </div>
          </div>

          {/* Action Callouts */}
          <div className="flex flex-wrap gap-4 pt-2">
            <MediaButton
              label="Download Installer"
              href="https://github.com/anasx07/AutaKimi/releases/latest/download/AutaKimi.exe"
              icon={<Download className="w-5 h-5 text-white" />}
              mediaUrl="/AutaKimi/assets/installer-preview.mp4"
              className="w-full sm:w-auto shadow-lg shadow-orange-500/10"
            />
            <MediaButton
              label="Join Discord"
              href="https://discord.gg/qRbpCusgan"
              icon={<MessageSquare className="w-5 h-5 text-white" />}
              mediaUrl="/AutaKimi/assets/discord-preview.mp4"
              className="w-full sm:w-auto"
            />
          </div>
        </div>

        {/* Right column: Graphic/Brand Art */}
        <div className="lg:col-span-5 relative flex justify-center items-center z-10 w-full">
          <div className="absolute w-80 h-80 rounded-full bg-orange-500/10 blur-[80px] -z-10 animate-pulse" />
          <div className="absolute w-60 h-60 rounded-full bg-amber-500/10 blur-[60px] -z-10" />
          
          <div className="relative glass-card rounded-[32px] p-8 border border-white/10 hover:border-white/20 transition-all duration-500 shadow-2xl max-w-sm w-full group overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-tr from-orange-500/5 to-transparent pointer-events-none" />
            
            <div className="mb-6 flex items-center justify-between">
              <Image 
                src="/AutaKimi/assets/icon.png" 
                alt="AutaKimi Icon" 
                width={80} 
                height={80} 
                className="w-20 h-20 rounded-2xl shadow-xl border border-white/10 group-hover:scale-105 transition-transform duration-500" 
              />
              <div className="text-right">
                <span className="text-[10px] text-zinc-500 font-mono tracking-widest uppercase">Platform</span>
                <p className="text-sm font-bold text-white flex items-center gap-1.5 justify-end mt-0.5">
                  <MonitorSmartphone className="w-4 h-4 text-orange-400" />
                  Windows 10/11
                </p>
              </div>
            </div>

            <div className="space-y-4 relative z-10">
              <h3 className="text-lg font-bold text-white">Extensible Media Vault</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                AutaKimi abstracts data streams into a unified core. Organize books, bookmark chapters, cache video streams, and personalize extensions without central tracking.
              </p>
              <div className="flex gap-2">
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-white/5 border border-white/5 text-zinc-400">0% Ads</span>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-white/5 border border-white/5 text-zinc-400">Open Source</span>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-white/5 border border-white/5 text-zinc-400">JS Engine</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* APP INTERACTIVE SIMULATOR */}
      <section className="w-full py-20 bg-gradient-to-b from-transparent via-orange-950/5 to-transparent border-y border-white/5 relative z-10">
        <div className="max-w-6xl mx-auto px-6 mb-12 text-center space-y-4">
          <span className="premium-pill bg-orange-500/10 border-orange-500/20 text-orange-300">Live Simulator</span>
          <h2 className="text-4xl md:text-5xl font-black tracking-tight text-white leading-tight">
            Try AutaKimi <span className="text-gradient font-black">Now</span>
          </h2>
          <p className="text-zinc-400 max-w-xl mx-auto text-sm leading-relaxed">
            Click tabs below to test out AutaKimi&apos;s native UI right in your browser. Install mock scrapers, search collections, and simulate the core reader.
          </p>
        </div>
        <AppSimulator />
      </section>

      {/* DETAILED FEATURES SECTION */}
      <section id="features" className="py-24 px-6 max-w-6xl w-full relative z-10">
        <div className="text-center mb-16 space-y-4">
          <span className="premium-pill">Features</span>
          <h2 className="text-4xl md:text-5xl font-black tracking-tight">Tailored for content enthusiasts</h2>
          <p className="text-zinc-400 max-w-md mx-auto text-sm">Every feature crafted with precision to deliver a seamless reader performance.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <GlowCard
              key={i}
              customSize
              glowColor="orange"
              className="p-8 group transition-all duration-500 hover:-translate-y-1.5 cursor-default hover:border-orange-500/30"
            >
              <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center mb-6 text-white group-hover:bg-orange-500/10 group-hover:border-orange-500/20 transition-all duration-500">
                {f.icon}
              </div>
              <h3 className="text-lg font-bold mb-3 text-white z-10 relative group-hover:text-orange-300 transition-colors">{f.title}</h3>
              <p className="text-zinc-400 leading-relaxed text-xs z-10 relative">{f.description}</p>
            </GlowCard>
          ))}
        </div>
      </section>

      {/* CORE SHOWCASE MODULES */}
      <section id="showcase" className="py-24 w-full bg-gradient-to-b from-transparent via-white/[0.01] to-transparent relative z-10">
        <div className="max-w-6xl mx-auto px-6 space-y-36">
          {showcases.map((s, i) => (
            <div key={i} className={`grid grid-cols-1 lg:grid-cols-2 gap-16 items-center ${s.reverse ? 'lg:flex-row-reverse' : ''}`}>
              <div className={`space-y-6 ${s.reverse ? 'lg:order-2' : ''}`}>
                <span className="premium-pill">{s.badge}</span>
                <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white leading-tight">
                  {s.title}
                </h2>
                <p className="text-zinc-400 text-sm leading-relaxed max-w-lg">{s.description}</p>
                <div className="flex gap-4">
                  <span className="text-xs font-semibold text-zinc-500 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-orange-400" />
                    Secure Local Storage
                  </span>
                </div>
              </div>
              <div className={`relative rounded-[28px] overflow-hidden border border-white/10 shadow-2xl transition-all duration-700 hover:border-white/20 group ${s.reverse ? 'lg:order-1' : ''}`}>
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10 pointer-events-none" />
                <Image 
                  src={s.image} 
                  alt={s.title} 
                  width={1280} 
                  height={800} 
                  className="w-full group-hover:scale-105 transition-transform duration-700 z-0" 
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ SECTION */}
      <section id="faq" className="py-24 px-6 max-w-3xl w-full relative z-10">
        <div className="text-center mb-16 space-y-4">
          <span className="premium-pill">FAQ</span>
          <h2 className="text-4xl font-extrabold tracking-tight text-white">Common Questions</h2>
          <p className="text-zinc-400 text-sm">Need help? Read through our quick FAQ list.</p>
        </div>

        <div className="space-y-4">
          {faqs.map((f, i) => (
            <div key={i} className="glass-card rounded-[20px] overflow-hidden border border-white/5 hover:border-white/10 transition-colors">
              <button
                className="w-full p-6 flex justify-between items-center text-left font-bold text-sm md:text-base hover:bg-white/[0.02] transition-colors text-white"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                <span className="pr-4">{f.q}</span>
                <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform duration-500 ${openFaq === i ? 'rotate-180 text-orange-400' : ''}`} />
              </button>
              <div className={`grid transition-all duration-500 ease-in-out ${openFaq === i ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                <div className="overflow-hidden">
                  <div className="px-6 pb-6 text-zinc-400 leading-relaxed text-xs md:text-sm pt-1 border-t border-white/5 bg-white/[0.01]">
                    {f.a}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
