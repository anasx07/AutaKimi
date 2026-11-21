import type { Metadata } from "next";
import { 
  BookOpen, Database, Puzzle, Zap, ChevronRight, Download, 
  Wifi, CheckCircle2, Smartphone, Monitor, HardDrive 
} from "lucide-react";
import { GlowCard } from "@/components/ui/spotlight-card";
import Link from 'next/link';

export const metadata: Metadata = {
  title: "Documentation - AutaKimi (Windows & Android)",
  description: "Learn how to get started with AutaKimi on Windows and Android, install scraping extensions, sync over LAN, track with AniList, and download CBZ offline archives.",
  openGraph: {
    title: "Documentation - AutaKimi (Windows & Android)",
    description: "Learn how to get started with AutaKimi on Windows and Android, install scraping extensions, sync over LAN, track with AniList, and download CBZ offline archives.",
    url: "https://anasx07.github.io/AutaKimi/docs/",
  },
  alternates: {
    canonical: "https://anasx07.github.io/AutaKimi/docs/",
  },
};

export default function DocsPage() {
  const sections = [
    {
      id: "getting-started",
      title: "Getting Started",
      icon: <Zap className="w-6 h-6 text-yellow-400" />,
      content: (
        <div className="space-y-4 text-zinc-300 leading-relaxed">
          <p>AutaKimi is completely portable and cross-platform, running natively on Windows 10/11 and Android devices.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <h4 className="text-white font-bold flex items-center gap-2 mb-2">
                <Monitor className="w-4 h-4 text-orange-400" /> Windows Desktop
              </h4>
              <ol className="list-decimal pl-5 space-y-1.5 text-xs text-zinc-400">
                <li>Download <code className="bg-black/30 px-1.5 py-0.5 rounded text-white">AutaKimi.exe</code> from the <Link href="/changelog" className="text-primary hover:underline">Releases Page</Link>.</li>
                <li>Run the executable directly anywhere on your system.</li>
                <li>Choose your interface language (English or Arabic) and theme.</li>
              </ol>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <h4 className="text-white font-bold flex items-center gap-2 mb-2">
                <Smartphone className="w-4 h-4 text-emerald-400" /> Android Mobile
              </h4>
              <ol className="list-decimal pl-5 space-y-1.5 text-xs text-zinc-400">
                <li>Download <code className="bg-black/30 px-1.5 py-0.5 rounded text-white">app-universal-release.apk</code> from the Releases Page.</li>
                <li>Open the APK on your device and tap Install (grant unknown sources if prompted).</li>
                <li>Launch the app to enjoy gesture-based touch reading on the go.</li>
              </ol>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "extensions",
      title: "Extensions System",
      icon: <Puzzle className="w-6 h-6 text-blue-400" />,
      content: (
        <div className="space-y-4 text-zinc-300 leading-relaxed">
          <p>AutaKimi acts as an empty media viewer shell. It does not host copyrighted content. Instead, it runs sandboxed community extensions that connect to your preferred public sources.</p>
          <ul className="list-disc pl-5 space-y-2 text-zinc-400">
            <li><strong>Cross-Platform Parity:</strong> Extension execution is identical between Windows (Node VM) and Android (sandboxed JS runtime), supporting full URL, Buffer, and Cloudflare cookie bypass protocols.</li>
            <li><strong>One-Click Installation:</strong> Browse community sources in the built-in catalog and install or update plugins with a single click.</li>
            <li><strong>Language & Safety Filtering:</strong> Filter extension catalogs and search feeds by languages (Arabic, English, etc.) and safety ratings.</li>
          </ul>
        </div>
      )
    },
    {
      id: "lan-sync",
      title: "Local Wi-Fi (LAN) Sync & Backups",
      icon: <Wifi className="w-6 h-6 text-cyan-400" />,
      content: (
        <div className="space-y-4 text-zinc-300 leading-relaxed">
          <p>Sync your reading progress, library collections, and history between PC and Phone without relying on third-party cloud servers.</p>
          <div className="space-y-3">
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <h4 className="text-white font-bold flex items-center gap-2 mb-2">
                <Wifi className="w-4 h-4 text-cyan-400" /> Seamless LAN Pairing
              </h4>
              <p className="text-sm text-zinc-400">When both your desktop and Android phone are on the same local Wi-Fi, AutaKimi discovers your desktop sync server automatically. Tap Sync in settings to instantly merge reading states.</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <h4 className="text-white font-bold flex items-center gap-2 mb-2">
                <HardDrive className="w-4 h-4 text-amber-400" /> Offline .json.gz Backups
              </h4>
              <p className="text-sm text-zinc-400">Export your entire SQLite library as a compressed <code className="bg-black/30 px-1.5 py-0.5 rounded text-white">.json.gz</code> backup file. Import it on any device to restore categories, chapters, bookmarks, and settings offline.</p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "anilist-tracking",
      title: "AniList Smart Tracking",
      icon: <CheckCircle2 className="w-6 h-6 text-orange-400" />,
      content: (
        <div className="space-y-4 text-zinc-300 leading-relaxed">
          <p>Keep your anime and manga lists updated automatically as you read and watch.</p>
          <ul className="list-disc pl-5 space-y-2 text-zinc-400">
            <li><strong>Automated Progress:</strong> Reading a chapter or watching an episode automatically syncs your progress counter directly to AniList.</li>
            <li><strong>Smart Completion:</strong> When you read the final chapter or watch the final episode of a finished series, AutaKimi automatically updates the status from <em>CURRENT</em> to <em>COMPLETED</em>.</li>
            <li><strong>Offline Retry Queue:</strong> If you read offline or on an airplane, updates are safely stored in a local SQLite queue and dispatched automatically as soon as internet connectivity returns.</li>
          </ul>
        </div>
      )
    },
    {
      id: "offline-reading",
      title: "Offline Reading & CBZ Storage",
      icon: <Database className="w-6 h-6 text-emerald-400" />,
      content: (
        <div className="space-y-4 text-zinc-300 leading-relaxed">
          <p>Built with an offline-first SQLite database, your library and progress are saved strictly locally. You can download entire volumes for plane rides or unstable networks.</p>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 mt-4">
            <h4 className="text-white font-bold flex items-center gap-2 mb-2"><Download className="w-4 h-4 text-emerald-400"/> Bulk Downloading & CBZ Export</h4>
            <p className="text-sm text-zinc-400">Select chapters in the series view to queue them into the background worker. Downloaded chapters are saved as standard <code className="bg-black/30 px-1.5 py-0.5 rounded text-white">.cbz</code> archives, accessible for offline reading or export to any comic reader.</p>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="w-full max-w-6xl mx-auto px-6 py-12 flex flex-col md:flex-row gap-12 relative z-10 animate-fade-in">
      {/* Sidebar Navigation */}
      <div className="w-full md:w-64 shrink-0 mt-8">
        <div className="sticky top-32 glass-card rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6 relative z-10">
            <BookOpen className="w-5 h-5 text-zinc-400" />
            <h3 className="font-bold text-white tracking-wide">Contents</h3>
          </div>
          <nav className="flex flex-col space-y-1 relative z-10">
            {sections.map((s) => (
              <a 
                key={s.id} 
                href={`#${s.id}`}
                className="text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/5 px-3 py-2.5 rounded-lg transition-colors flex items-center justify-between group"
              >
                {s.title}
                <ChevronRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
              </a>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 space-y-16">
        <div>
          <span className="premium-pill mb-4 block w-fit">Documentation</span>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white mb-4">Knowledge Base</h1>
          <p className="text-zinc-400 text-lg">Everything you need to know about setting up, configuring, and maximizing your AutaKimi experience across Windows and Android.</p>
        </div>

        <div className="space-y-12">
          {sections.map((section) => (
            <GlowCard key={section.id} customSize className="w-full p-8 md:p-10 group" glowColor="orange">
              <div id={section.id} className="scroll-mt-32">
                <div className="flex items-center gap-4 mb-6 border-b border-white/5 pb-6">
                  <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center relative z-10">
                    {section.icon}
                  </div>
                  <h2 className="text-2xl font-bold text-white relative z-10">{section.title}</h2>
                </div>
                <div className="relative z-10">
                  {section.content}
                </div>
              </div>
            </GlowCard>
          ))}
        </div>
      </div>
    </div>
  );
}
