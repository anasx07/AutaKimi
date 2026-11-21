"use client";

import {
  Download,
  BookOpen,
  Puzzle,
  History,
  Search,
  Zap,
  ChevronDown,
  Globe,
  MonitorSmartphone,
  MessageSquare,
  Sparkles,
  Terminal,
  Shield,
  ArrowRight,
  Activity,
  Smartphone,
  CheckCircle2,
  Archive,
} from "lucide-react";
import { useState, useEffect } from "react";
import Image from "next/image";

import { MediaButton } from "@/components/ui/media-button";
import { GlowCard } from "@/components/ui/spotlight-card";

export default function Home() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [version, setVersion] = useState("2.0.11");

  useEffect(() => {
    fetch("https://api.github.com/repos/anasx07/AutaKimi/releases/latest")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (data.tag_name) {
          setVersion(data.tag_name.replace(/^v/, ""));
        }
      })
      .catch((err) => {
        console.warn(
          "Latest release version fetch skipped/failed (using fallback version):",
          err.message || err,
        );
      });
  }, []);

  const features = [
    {
      icon: <MonitorSmartphone className="w-6 h-6 text-orange-400" />,
      title: "Cross-Platform & LAN Sync",
      description:
        "Enjoy total parity across Windows and Android. Synchronize your reading history, library, and bookmarks over local Wi-Fi without cloud reliance.",
    },
    {
      icon: <CheckCircle2 className="w-6 h-6 text-blue-400" />,
      title: "AniList Smart Tracking",
      description:
        "Automatic 2-way progress sync with AniList. Auto-completes titles upon finishing the final chapter, with an offline SQLite retry queue.",
    },
    {
      icon: <Archive className="w-6 h-6 text-emerald-400" />,
      title: "Offline CBZ & Stream Downloads",
      description:
        "Bulk download full chapters as standard .cbz comic book archives or cache video streams for high-speed offline reading anywhere.",
    },
    {
      icon: <Zap className="w-6 h-6 text-yellow-400" />,
      title: "Native Anime Streamer",
      description:
        "Watch anime series with built-in hardware acceleration, custom speed controls, multi-quality streams, and embedded popup blocking.",
    },
    {
      icon: <Puzzle className="w-6 h-6 text-pink-400" />,
      title: "Modular Scraper Engine",
      description:
        "Expand your content catalog with sandboxed JS extensions running with identical behavior on desktop and mobile.",
    },
    {
      icon: <Globe className="w-6 h-6 text-indigo-400" />,
      title: "Global Localization",
      description:
        "Full native support for Arabic (العربية) and English, ensuring an absolute native experience for global readers.",
    },
    {
      icon: <Search className="w-6 h-6 text-cyan-400" />,
      title: "Smart Cross-Source Search",
      description:
        "Find any manga title or anime episode across all your connected community indexers instantly with advanced filters.",
    },
    {
      icon: <Terminal className="w-6 h-6 text-emerald-400" />,
      title: "Privacy First & GZ Backups",
      description:
        "Zero telemetry or tracking. Export and import full .json.gz backups between desktop and mobile for complete data ownership.",
    },
    {
      icon: <BookOpen className="w-6 h-6 text-purple-400" />,
      title: "Personal Library & Reader",
      description:
        "Responsive library with custom categories, reading history, and continuous webtoon scroll with smart chapter transitions.",
    },
  ];

  const showcases = [
    {
      badge: "Manga Hub",
      title: "Unified Manga & Webtoon Discovery",
      description:
        "Browse thousands of manga, manhwa, and manhua series across community sources with instant filters, multi-language catalogs, and high-resolution covers. Enjoy continuous vertical webtoon scrolling and right-to-left reading modes.",
      image: "/AutaKimi/assets/manga-browse.webp",
      shield: "Cross-Source Fast Indexing",
    },
    {
      badge: "Native Streaming",
      title: "Watch Anime Without Ads or Popups",
      description:
        "Stream your favorite anime series with built-in hardware acceleration, multi-server stream extraction, and zero external intrusive advertisements or redirects.",
      image: "/AutaKimi/assets/anime-browse.webp",
      shield: "Zero Ad Popups & Tracking",
      reverse: true,
    },
    {
      badge: "Localization & Chapters",
      title: "Rich Media Details & Full Arabic Support",
      description:
        "Experience complete native Right-to-Left (RTL) Arabic interface support alongside English. View full synopses, track reading state, and queue offline chapter downloads.",
      image: "/AutaKimi/assets/manga-details.webp",
      shield: "Arabic (العربية) & English Native",
    },
    {
      badge: "Smart Progress",
      title: "Episode Tracking & AniList Integration",
      description:
        "Never lose your place. Mark episodes as watched, auto-scrobble progress to AniList, and pick up right where you left off across Windows PC and Android.",
      image: "/AutaKimi/assets/anime-details.webp",
      shield: "AniList Two-Way Scrobbler",
      reverse: true,
    },
    {
      badge: "Aesthetics",
      title: "Premium Themes & Aesthetics",
      description:
        "Make AutaKimi yours. Choose from a variety of premium themes, ranging from classic deep dark modes to character-inspired vibrant aesthetics. Experience smooth transitions on every screen change.",
      image: "/AutaKimi/assets/screenshot-themes.png",
      shield: "Dynamic Theme Engine",
    },
  ];

  const faqs = [
    {
      q: "Is AutaKimi free to use?",
      a: "Yes, AutaKimi is 100% free, open-source under GPL-3.0, and contains zero tracking, advertisements, telemetry, or data collection.",
    },
    {
      q: "Is AutaKimi an alternative to Tachiyomi, Mihon, and Aniyomi for PC?",
      a: "Yes! AutaKimi is designed as a native desktop and mobile media reader, serving as a powerful PC and Android alternative to Android-only readers like Tachiyomi, Mihon, and Aniyomi without requiring any Android emulator.",
    },
    {
      q: "Which platforms does AutaKimi support?",
      a: "AutaKimi runs natively on Windows 10/11 (64-bit) as an installer/portable app, and on Android (5.0+) as a standalone APK. Both apps share identical features, extensions, and reader engines.",
    },
    {
      q: "How does sync work between PC and Android?",
      a: "AutaKimi uses local Wi-Fi LAN sync and portable .json.gz backups. Your desktop app acts as a local sync host that your phone discovers automatically on the same Wi-Fi, syncing reading progress and library changes with zero cloud intermediaries.",
    },
    {
      q: "Can I track my anime and manga with AniList?",
      a: "Yes. AutaKimi integrates natively with AniList for real-time progress updates. It automatically marks titles as COMPLETED when you finish the final chapter or episode, and queues updates in SQLite if you're offline to sync when you reconnect.",
    },
    {
      q: "Does it support offline reading and downloads?",
      a: "Yes! You can bulk download manga chapters directly as standard .cbz archives, cache anime episodes for offline playback, and export/import full .json.gz library backups.",
    },
    {
      q: "How do I install extensions?",
      a: "Extensions are sandboxed community JavaScript plugins that can be installed instantly via the extension catalog inside the application with a single click.",
    },
  ];

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
              <span>Windows & Android Ready</span>
            </span>
            <span className="text-xs font-mono text-orange-300/90 bg-orange-500/10 border border-orange-500/20 rounded-full px-2.5 py-0.5">
              Tachiyomi & Aniyomi Inspired
            </span>
          </div>

          <div className="space-y-4">
            <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-[1.05] text-white">
              The Next Gen Media{" "}
              <span className="text-gradient font-black">Framework</span>
            </h1>
            <p className="text-lg md:text-xl text-zinc-400 leading-relaxed font-sans font-medium">
              AutaKimi is a professional, privacy-first media reader for Windows
              and Android. Enjoy local Wi-Fi sync, AniList tracking, offline CBZ
              downloads, and sandboxed community extensions.
            </p>
          </div>

          {/* Quick Stats Mock */}
          <div className="grid grid-cols-3 gap-6 py-4 border-y border-white/5 max-w-md">
            <div>
              <p className="text-2xl font-black text-white">100%</p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">
                Privacy First
              </p>
            </div>
            <div>
              <p className="text-2xl font-black text-white">0ms</p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">
                Lag Response
              </p>
            </div>
            <div>
              <p className="text-2xl font-black text-white">2+</p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">
                Languages
              </p>
            </div>
          </div>

          {/* Action Callouts */}
          <div className="flex flex-wrap gap-4 pt-2">
            <MediaButton
              label="Download for Windows"
              href="https://github.com/anasx07/AutaKimi/releases/latest/download/AutaKimi.exe"
              icon={<Download className="w-5 h-5 text-white" />}
              mediaUrl="/AutaKimi/assets/installer-preview.mp4"
              className="w-full sm:w-auto shadow-lg shadow-orange-500/10"
            />
            <MediaButton
              label="Download Android APK"
              href="https://github.com/anasx07/AutaKimi/releases/latest/download/app-universal-release.apk"
              icon={<Smartphone className="w-5 h-5 text-white" />}
              mediaUrl="/AutaKimi/assets/installer-preview.mp4"
              className="w-full sm:w-auto shadow-lg shadow-amber-500/10"
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

        {/* Right column: Interactive App Window Preview */}
        <div className="lg:col-span-5 relative flex justify-center items-center z-10 w-full">
          <div className="absolute w-80 h-80 rounded-full bg-orange-500/15 blur-[90px] -z-10 animate-pulse" />
          <div className="absolute w-60 h-60 rounded-full bg-amber-500/10 blur-[60px] -z-10" />

          <div className="relative glass-card rounded-[24px] p-2.5 sm:p-3 border border-white/10 hover:border-white/20 transition-all duration-700 shadow-2xl w-full group overflow-hidden">
            {/* Window title bar */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 mb-2.5">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/80 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-500/80 inline-block" />
              </div>
              <span className="text-[11px] font-mono text-zinc-400 flex items-center gap-1.5">
                <MonitorSmartphone className="w-3.5 h-3.5 text-orange-400" />
                AutaKimi v{version}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                Live Desktop
              </span>
            </div>

            {/* Window preview screenshot */}
            <div className="relative rounded-[16px] overflow-hidden border border-white/5 shadow-inner">
              <Image
                src="/AutaKimi/assets/manga-browse.webp"
                alt="AutaKimi Desktop Reader Interface"
                width={1280}
                height={700}
                className="w-full group-hover:scale-[1.02] transition-transform duration-700 z-0"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
              <div className="absolute bottom-2.5 inset-x-3 flex items-center justify-between text-[11px] text-zinc-300">
                <span className="bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10">
                  Manga & Webtoon Hub
                </span>
                <span className="bg-orange-500/20 backdrop-blur-md text-orange-300 px-2.5 py-1 rounded-full border border-orange-500/30">
                  0% Tracking
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* DETAILED FEATURES SECTION */}
      <section
        id="features"
        className="py-24 px-6 max-w-6xl w-full relative z-10"
      >
        <div className="text-center mb-16 space-y-4">
          <span className="premium-pill">Features</span>
          <h2 className="text-4xl md:text-5xl font-black tracking-tight">
            Tailored for content enthusiasts
          </h2>
          <p className="text-zinc-400 max-w-md mx-auto text-sm">
            Every feature crafted with precision to deliver a seamless reader
            performance.
          </p>
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
              <h3 className="text-lg font-bold mb-3 text-white z-10 relative group-hover:text-orange-300 transition-colors">
                {f.title}
              </h3>
              <p className="text-zinc-400 leading-relaxed text-xs z-10 relative">
                {f.description}
              </p>
            </GlowCard>
          ))}
        </div>
      </section>

      {/* CORE SHOWCASE MODULES */}
      <section
        id="showcase"
        className="py-24 w-full bg-gradient-to-b from-transparent via-white/[0.01] to-transparent relative z-10"
      >
        <div className="max-w-6xl mx-auto px-6 space-y-36">
          {showcases.map((s, i) => (
            <div
              key={i}
              className={`grid grid-cols-1 lg:grid-cols-2 gap-16 items-center ${s.reverse ? "lg:flex-row-reverse" : ""}`}
            >
              <div className={`space-y-6 ${s.reverse ? "lg:order-2" : ""}`}>
                <span className="premium-pill">{s.badge}</span>
                <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white leading-tight">
                  {s.title}
                </h2>
                <p className="text-zinc-400 text-sm leading-relaxed max-w-lg">
                  {s.description}
                </p>
                <div className="flex gap-4">
                  <span className="text-xs font-semibold text-zinc-500 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-orange-400" />
                    {s.shield || "Secure Local Storage"}
                  </span>
                </div>
              </div>
              <div
                className={`relative rounded-[28px] overflow-hidden border border-white/10 shadow-2xl transition-all duration-700 hover:border-white/20 group ${s.reverse ? "lg:order-1" : ""}`}
              >
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
          <h2 className="text-4xl font-extrabold tracking-tight text-white">
            Common Questions
          </h2>
          <p className="text-zinc-400 text-sm">
            Need help? Read through our quick FAQ list.
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((f, i) => (
            <div
              key={i}
              className="glass-card rounded-[20px] overflow-hidden border border-white/5 hover:border-white/10 transition-colors"
            >
              <button
                className="w-full p-6 flex justify-between items-center text-left font-bold text-sm md:text-base hover:bg-white/[0.02] transition-colors text-white"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                <span className="pr-4">{f.q}</span>
                <ChevronDown
                  className={`w-4 h-4 text-zinc-500 transition-transform duration-500 ${openFaq === i ? "rotate-180 text-orange-400" : ""}`}
                />
              </button>
              <div
                className={`grid transition-all duration-500 ease-in-out ${openFaq === i ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
              >
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
  );
}
