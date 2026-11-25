"use client";

import {
  Download,
  ChevronDown,
  ArrowRight,
  ArrowUpRight,
  Play,
  BookOpen,
  Wifi,
  Puzzle,
  CheckCircle2,
  BarChart3,
  Expand,
} from "lucide-react";
import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";

import { MediaButton } from "@/components/ui/media-button";
import { ApkDownloadButton } from "@/components/ui/apk-download-button";
import { ImageLightbox, LightboxImage } from "@/components/ui/image-lightbox";

const HERO_TABS = [
  {
    id: "player",
    label: "Anime Player",
    src: "/AutaKimi/assets/screenshots/anime-player-sidebar.png",
    caption: "Hardware-accelerated player · Skip Intro · Ambient Glow",
  },
  {
    id: "pip",
    label: "Floating PiP",
    src: "/AutaKimi/assets/screenshots/anime-mini-pip.png",
    caption: "Always-on-top Mini Player & system Picture-in-Picture",
  },
  {
    id: "reader",
    label: "Manga Reader",
    src: "/AutaKimi/assets/screenshots/manga-reader-vertical.png",
    caption: "Continuous vertical webtoon scroll & Night Eye-Care tint",
  },
  {
    id: "history",
    label: "History & Badges",
    src: "/AutaKimi/assets/screenshots/history-anime.png",
    caption: "Cross-source playback history with extension badges",
  },
  {
    id: "browse",
    label: "Manga Catalog",
    src: "/AutaKimi/assets/screenshots/manga-browse.webp",
    caption: "Unified discovery across community repositories",
  },
];

const SHOWCASES = [
  {
    step: "01",
    badge: "Anime Streaming",
    title: "Built-in Player, Skip Intro & Multi-Server",
    description:
      "Stream directly inside AutaKimi with automatic Skip Intro controls, edge ambient lighting, Auto-Next episode transitions, and instant mirror switching—no browser popups.",
    image: "/AutaKimi/assets/screenshots/anime-player-sidebar.png",
  },
  {
    step: "02",
    badge: "Multitasking",
    title: "Dockable Mini Player & Desktop Floating PiP",
    description:
      "Keep watching while browsing your library or detach playback into an always-on-top floating window that stays visible over any desktop app.",
    image: "/AutaKimi/assets/screenshots/anime-floating-pip.png",
  },
  {
    step: "03",
    badge: "Manga & Webtoon",
    title: "Continuous Vertical Scroll & Eye-Care Mode",
    description:
      "Switch smoothly between continuous webtoon scrolling, RTL/LTR paged modes, drag-to-scroll, quick chapter jumping, and warm Night Eye-Care tinting.",
    image: "/AutaKimi/assets/screenshots/manga-reader-vertical.png",
  },
  {
    step: "04",
    badge: "Source Clarity",
    title: "Per-Extension Badges Across History & Library",
    description:
      "Follow the same series from multiple sources without confusion. Every card in History, Library, and Downloads clearly displays its source badge and repo color.",
    image: "/AutaKimi/assets/screenshots/history-anime.png",
  },
  {
    step: "05",
    badge: "Arabic & English",
    title: "Native RTL Interface & Rich Series Details",
    description:
      "First-class Arabic (العربية) RTL layout alongside English—with synopses, unread chapter filters, Smart Downloads, and offline .cbz archive caching.",
    image: "/AutaKimi/assets/screenshots/manga-details-rtl.png",
  },
  {
    step: "06",
    badge: "Personalization",
    title: "Character & Monochrome Studio Themes",
    description:
      "Tailor every workspace from distraction-free dark studio presets to character-inspired palettes with instant theme switching.",
    image: "/AutaKimi/assets/screenshots/themes-showcase.png",
  },
];

const LIGHTBOX_GALLERY: LightboxImage[] = [
  ...SHOWCASES.map((s) => ({
    src: s.image,
    alt: s.title,
    title: s.title,
    badge: s.badge,
    description: s.description,
  })),
  {
    src: "/AutaKimi/assets/screenshots/anime-mini-pip.png",
    alt: "Library with Mini Player",
    title: "Docked Mini Player Inside Library",
    badge: "Mini Player",
    description:
      "Browse your saved anime and manga while keeping playback docked in the corner.",
  },
  {
    src: "/AutaKimi/assets/screenshots/anime-player-fullscreen.png",
    alt: "Fullscreen Anime Player",
    title: "Clean Fullscreen Playback Overlay",
    badge: "Theater Mode",
    description:
      "Auto-Next, quick server selector, and crisp 1080p quality toggle.",
  },
  {
    src: "/AutaKimi/assets/screenshots/manga-reader-chapters.png",
    alt: "Manga Reader Chapter Switcher",
    title: "Instant Chapter Dropdown Switcher",
    badge: "Manga Reader",
    description:
      "Jump directly between chapters without leaving your reading session.",
  },
  {
    src: "/AutaKimi/assets/screenshots/anime-details-episode-list.png",
    alt: "Anime Episode Tracking",
    title: "Episode Tracking & AniList Sync",
    badge: "AniList Sync",
    description: "Automatic last-watched indicators and 2-way AniList updates.",
  },
  {
    src: "/AutaKimi/assets/screenshots/library-anime.png",
    alt: "Anime Library",
    title: "Saved Library With Source Badges",
    badge: "Library",
    description: "Clean anime and manga shelves with extension attribution.",
  },
  {
    src: "/AutaKimi/assets/screenshots/history-manga.png",
    alt: "Manga History",
    title: "Manga Reading History",
    badge: "History",
    description: "Pick up right where you left off across every source.",
  },
];

const FAQS = [
  {
    q: "Is AutaKimi free and open source?",
    a: "Yes. AutaKimi is 100% free and licensed under GPL-3.0 with zero ads, zero telemetry, and no hosted media.",
  },
  {
    q: "How is it different from Tachiyomi, Mihon, or Aniyomi?",
    a: "AutaKimi brings the extension-based library & reader workflow natively to Windows PC alongside Android—without needing an Android emulator—with local Wi-Fi sync between devices.",
  },
  {
    q: "How do extensions and multi-repo isolation work?",
    a: "AutaKimi is an empty shell. Add AutaKimi or Keiyoushi-compatible repositories inside Settings/Browse. Each repository keeps its own color, version state, and isolated source entries.",
  },
  {
    q: "Can I sync progress between Windows and Android without a cloud account?",
    a: "Yes. Pair over your local Wi-Fi network to sync library items, reading history, and chapters directly between PC and Android, or export portable .json.gz backups anytime.",
  },
  {
    q: "Does it support AniList and offline CBZ reading?",
    a: "Yes. Two-way AniList tracking automatically updates progress and queues updates offline in SQLite. You can also download chapters as .cbz archives or open local files.",
  },
];

export default function Home() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [version, setVersion] = useState("2.3.0");
  const [heroTab, setHeroTab] = useState(0);
  const [activeShowcase, setActiveShowcase] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

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
      .catch(() => {});
  }, []);

  const openLightboxForSrc = (src: string) => {
    const idx = LIGHTBOX_GALLERY.findIndex((img) => img.src === src);
    setActiveImageIndex(idx >= 0 ? idx : 0);
    setLightboxOpen(true);
  };

  const currentHero = HERO_TABS[heroTab];
  const currentShowcase = SHOWCASES[activeShowcase];

  return (
    <div className="w-full flex flex-col items-center">
      {/* HERO */}
      <section className="w-full max-w-6xl px-5 pt-14 pb-20 md:pt-20 md:pb-28">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <Link
            href="/changelog"
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] hover:border-white/20 transition-colors text-xs text-zinc-300"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            <span className="font-mono">v{version}</span>
            <span className="text-zinc-500">·</span>
            <span>Windows &amp; Android · GPL-3.0</span>
            <ArrowRight className="w-3 h-3 text-zinc-500" />
          </Link>

          <h1 className="text-4xl sm:text-6xl md:text-[64px] font-bold tracking-[-0.03em] leading-[1.06] text-white font-[family-name:var(--font-outfit)]">
            Read manga. Watch anime.{" "}
            <span className="text-zinc-400">Keep everything local.</span>
          </h1>

          <p className="text-base sm:text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            A native desktop and mobile media viewer for Windows and Android.
            Sandboxed multi-repo extensions, always-on-top PiP playback, LAN
            Wi-Fi sync, offline CBZ downloads, and AniList tracking—with zero ads
            or telemetry.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <MediaButton
              label="Download for Windows"
              href="https://github.com/anasx07/AutaKimi/releases/latest/download/AutaKimi.exe"
              icon={<Download className="w-4 h-4" />}
              mediaUrl="/AutaKimi/assets/videos/installer-preview.mp4"
              variant="primary"
              className="w-full sm:w-auto"
            />
            <ApkDownloadButton
              mediaUrl="/AutaKimi/assets/videos/installer-preview.mp4"
              className="w-full sm:w-auto"
            />
            <Link
              href="/docs"
              className="inline-flex items-center gap-1.5 h-11 px-4 rounded-xl text-sm font-medium text-zinc-300 hover:text-white border border-white/[0.08] hover:border-white/20 transition-colors"
            >
              <span>Setup Guide</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-zinc-500" />
            </Link>
          </div>
        </div>

        {/* INTERACTIVE HERO STAGE */}
        <div className="mt-14 max-w-5xl mx-auto">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3 px-1">
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar p-1 rounded-xl bg-zinc-900/80 border border-white/[0.07]">
              {HERO_TABS.map((tab, i) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setHeroTab(i)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    heroTab === i
                      ? "bg-white text-zinc-950"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <span className="hidden sm:inline text-xs font-mono text-zinc-500">
              {currentHero.caption}
            </span>
          </div>

          <button
            type="button"
            onClick={() => openLightboxForSrc(currentHero.src)}
            className="group relative block w-full rounded-2xl overflow-hidden border border-white/[0.1] bg-zinc-950 shadow-[0_30px_90px_-20px_rgba(0,0,0,0.85)] hover:border-white/20 transition-all cursor-zoom-in text-left"
            title="Click to inspect full resolution"
          >
            <div className="relative aspect-[16/9] w-full bg-zinc-950">
              <Image
                src={currentHero.src}
                alt={currentHero.label}
                fill
                sizes="(max-width: 1024px) 100vw, 1024px"
                className="object-cover object-top transition-transform duration-500 group-hover:scale-[1.01]"
                priority
              />
            </div>
            <div className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/75 border border-white/10 text-[11px] font-medium text-zinc-200 backdrop-blur-md opacity-80 group-hover:opacity-100 transition-opacity">
              <Expand className="w-3 h-3" />
              <span>Expand</span>
            </div>
          </button>
        </div>
      </section>

      {/* BENTO CAPABILITIES */}
      <section
        id="features"
        className="w-full max-w-6xl px-5 py-20 border-t border-white/[0.06]"
      >
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-12">
          <div className="space-y-2 max-w-xl">
            <span className="section-kicker">Architecture</span>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white font-[family-name:var(--font-outfit)]">
              Built for fast reading and clean playback
            </h2>
          </div>
          <p className="text-sm text-zinc-400 max-w-md">
            Identical TypeScript SDK engine across Electron Desktop and React
            Native Android—backed by local SQLite storage.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          {/* Card 1: Anime + PiP (Wide) */}
          <div className="md:col-span-4 rounded-2xl studio-surface p-6 flex flex-col justify-between gap-6 overflow-hidden hover:border-white/[0.15] transition-colors">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 text-xs font-mono text-rose-400">
                <Play className="w-3.5 h-3.5" />
                <span>STREAMING &amp; PIP</span>
              </div>
              <h3 className="text-xl font-semibold text-white">
                Hardware-accelerated player with Floating PiP
              </h3>
              <p className="text-sm text-zinc-400 max-w-xl leading-relaxed">
                Built-in Skip Intro, edge ambient glow, Auto-Next, multi-server
                fallback, and a detachable PiP window that floats above any
                application.
              </p>
            </div>
            <div
              onClick={() =>
                openLightboxForSrc(
                  "/AutaKimi/assets/screenshots/anime-floating-pip.png",
                )
              }
              className="relative aspect-[16/8.5] rounded-xl overflow-hidden border border-white/[0.08] cursor-zoom-in group"
            >
              <Image
                src="/AutaKimi/assets/screenshots/anime-floating-pip.png"
                alt="System-wide Floating PiP"
                fill
                sizes="(max-width: 768px) 100vw, 680px"
                className="object-cover object-top group-hover:scale-[1.02] transition-transform duration-500"
              />
            </div>
          </div>

          {/* Card 2: LAN Sync */}
          <div className="md:col-span-2 rounded-2xl studio-surface p-6 flex flex-col justify-between gap-6 hover:border-white/[0.15] transition-colors">
            <div className="space-y-3">
              <div className="w-9 h-9 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-zinc-200">
                <Wifi className="w-4 h-4" />
              </div>
              <h3 className="text-lg font-semibold text-white">
                Local Wi-Fi Sync &amp; Backups
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Pair Android with Desktop over your home Wi-Fi to merge library,
                history, and progress—or export portable{" "}
                <code className="text-zinc-200 font-mono text-xs">.json.gz</code>{" "}
                archives anytime.
              </p>
            </div>
            <div className="pt-4 border-t border-white/[0.06] flex items-center justify-between text-xs font-mono text-zinc-500">
              <span>Zero cloud servers</span>
              <span className="text-emerald-400">LAN Auto-Discovery</span>
            </div>
          </div>

          {/* Card 3: Multi-Repo Extensions */}
          <div className="md:col-span-2 rounded-2xl studio-surface p-6 flex flex-col justify-between gap-6 hover:border-white/[0.15] transition-colors">
            <div className="space-y-3">
              <div className="w-9 h-9 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-zinc-200">
                <Puzzle className="w-4 h-4" />
              </div>
              <h3 className="text-lg font-semibold text-white">
                Isolated Multi-Repo Catalogs
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Add AutaKimi or Keiyoushi repositories side by side. Each source
                keeps its own repository badge color, update stream, and
                sandboxed runtime.
              </p>
            </div>
            <a
              href="https://github.com/Autakimi-Ecosystem/autakimi-extensions"
              target="_blank"
              rel="noopener noreferrer"
              className="pt-4 border-t border-white/[0.06] flex items-center justify-between text-xs font-medium text-zinc-300 hover:text-white transition-colors"
            >
              <span>Browse extensions repo</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-zinc-500" />
            </a>
          </div>

          {/* Card 4: Webtoon & CBZ Reader (Wide) */}
          <div className="md:col-span-4 rounded-2xl studio-surface p-6 flex flex-col justify-between gap-6 overflow-hidden hover:border-white/[0.15] transition-colors">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 text-xs font-mono text-rose-400">
                <BookOpen className="w-3.5 h-3.5" />
                <span>READER ENGINE</span>
              </div>
              <h3 className="text-xl font-semibold text-white">
                Vertical Webtoon Scroll, Night Eye-Care &amp; Smart Downloads
              </h3>
              <p className="text-sm text-zinc-400 max-w-xl leading-relaxed">
                Seamless continuous chapters, Night Eye-Care warm dimming tint,
                automatic next-chapter prefetching, and native{" "}
                <code className="text-zinc-200 font-mono text-xs">.cbz</code>{" "}
                archive downloads.
              </p>
            </div>
            <div
              onClick={() =>
                openLightboxForSrc(
                  "/AutaKimi/assets/screenshots/manga-reader-chapters.png",
                )
              }
              className="relative aspect-[16/8.5] rounded-xl overflow-hidden border border-white/[0.08] cursor-zoom-in group"
            >
              <Image
                src="/AutaKimi/assets/screenshots/manga-reader-chapters.png"
                alt="Manga Reader Controls"
                fill
                sizes="(max-width: 768px) 100vw, 680px"
                className="object-cover object-top group-hover:scale-[1.02] transition-transform duration-500"
              />
            </div>
          </div>

          {/* Card 5: AniList */}
          <div className="md:col-span-3 rounded-2xl studio-surface p-6 flex items-start gap-4 hover:border-white/[0.15] transition-colors">
            <div className="w-9 h-9 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-zinc-200 shrink-0 mt-0.5">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-semibold text-white">
                AniList Two-Way Tracking &amp; Offline Queue
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Updates progress automatically as you watch or read, marks
                completed series on the final chapter, and safely queues offline
                syncs in SQLite.
              </p>
            </div>
          </div>

          {/* Card 6: Stats + Discord */}
          <div className="md:col-span-3 rounded-2xl studio-surface p-6 flex items-start gap-4 hover:border-white/[0.15] transition-colors">
            <div className="w-9 h-9 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-zinc-200 shrink-0 mt-0.5">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-semibold text-white">
                Local Wrapped Stats &amp; Discord Presence
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Review weekly reading streaks, watch time, and top genres 100%
                locally—plus optional Discord Rich Presence for your profile.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* INTERACTIVE PRODUCT TOUR */}
      <section
        id="showcase"
        className="w-full max-w-6xl px-5 py-20 border-t border-white/[0.06]"
      >
        <div className="space-y-2 mb-10">
          <span className="section-kicker">Product Tour</span>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white font-[family-name:var(--font-outfit)]">
            Every view, crafted for daily use
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left selector list */}
          <div className="lg:col-span-5 space-y-2">
            {SHOWCASES.map((item, idx) => {
              const isActive = activeShowcase === idx;
              return (
                <button
                  key={item.step}
                  type="button"
                  onClick={() => setActiveShowcase(idx)}
                  className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer ${
                    isActive
                      ? "bg-zinc-900/90 border-white/[0.16]"
                      : "bg-transparent border-transparent hover:bg-white/[0.03] hover:border-white/[0.06]"
                  }`}
                >
                  <div className="flex items-center gap-2.5 mb-1">
                    <span
                      className={`text-[11px] font-mono ${isActive ? "text-rose-400" : "text-zinc-500"}`}
                    >
                      {item.step}
                    </span>
                    <span className="text-sm font-semibold text-white">
                      {item.title}
                    </span>
                  </div>
                  {isActive && (
                    <p className="text-xs text-zinc-400 leading-relaxed pl-6">
                      {item.description}
                    </p>
                  )}
                </button>
              );
            })}
          </div>

          {/* Right active preview */}
          <div className="lg:col-span-7 space-y-3">
            <button
              type="button"
              onClick={() => openLightboxForSrc(currentShowcase.image)}
              className="group relative block w-full rounded-2xl overflow-hidden border border-white/[0.1] bg-zinc-950 hover:border-white/25 transition-all cursor-zoom-in text-left"
              title="Click to enlarge in gallery"
            >
              <div className="relative aspect-[16/9] w-full">
                <Image
                  src={currentShowcase.image}
                  alt={currentShowcase.title}
                  fill
                  sizes="(max-width: 1024px) 100vw, 680px"
                  className="object-cover object-top group-hover:scale-[1.015] transition-transform duration-500"
                />
              </div>
              <div className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/75 border border-white/10 text-[11px] font-medium text-zinc-200 backdrop-blur-md">
                <Expand className="w-3 h-3" />
                <span>Open Gallery ({LIGHTBOX_GALLERY.length})</span>
              </div>
            </button>

            {/* Quick thumbnail strip */}
            <div className="grid grid-cols-6 gap-2">
              {SHOWCASES.map((item, idx) => (
                <button
                  key={item.step}
                  type="button"
                  onClick={() => setActiveShowcase(idx)}
                  className={`relative aspect-video rounded-lg overflow-hidden border transition-all cursor-pointer ${
                    activeShowcase === idx
                      ? "border-rose-500 ring-1 ring-rose-500/40"
                      : "border-white/[0.08] opacity-55 hover:opacity-100"
                  }`}
                  title={item.title}
                >
                  <Image
                    src={item.image}
                    alt={item.badge}
                    fill
                    sizes="120px"
                    className="object-cover object-top"
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="w-full max-w-3xl px-5 py-20">
        <div className="mb-10 space-y-2">
          <span className="section-kicker">FAQ</span>
          <h2 className="text-3xl font-bold tracking-tight text-white font-[family-name:var(--font-outfit)]">
            Frequently asked questions
          </h2>
        </div>

        <div className="divide-y divide-white/[0.06] border-y border-white/[0.06]">
          {FAQS.map((f, i) => {
            const isOpen = openFaq === i;
            return (
              <div key={i}>
                <button
                  type="button"
                  className="w-full py-5 flex items-center justify-between gap-4 text-left text-sm sm:text-base font-medium text-zinc-100 hover:text-white transition-colors cursor-pointer"
                  onClick={() => setOpenFaq(isOpen ? null : i)}
                >
                  <span>{f.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-zinc-500 shrink-0 transition-transform duration-200 ${
                      isOpen ? "rotate-180 text-white" : ""
                    }`}
                  />
                </button>
                {isOpen && (
                  <p className="pb-5 text-sm text-zinc-400 leading-relaxed pr-8">
                    {f.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* LIGHTBOX */}
      <ImageLightbox
        images={LIGHTBOX_GALLERY}
        currentIndex={activeImageIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        onNavigate={setActiveImageIndex}
      />
    </div>
  );
}
