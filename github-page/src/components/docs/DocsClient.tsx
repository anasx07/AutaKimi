"use client";

import { useState } from "react";
import {
  BookOpen,
  Database,
  Puzzle,
  Zap,
  ChevronRight,
  Download,
  Wifi,
  CheckCircle2,
  Smartphone,
  Monitor,
  HardDrive,
  Sliders,
  Expand,
  ArrowUpRight,
  Images,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { ImageLightbox, LightboxImage } from "@/components/ui/image-lightbox";

const DOCS_GALLERY: LightboxImage[] = [
  {
    src: "/AutaKimi/assets/screenshots/manga-browse.webp",
    alt: "AutaKimi Manga Catalog",
    badge: "Catalog",
    title: "Unified Manga & Webtoon Discovery",
    description:
      "Multi-language catalogs across community repositories with repository filters.",
  },
  {
    src: "/AutaKimi/assets/screenshots/anime-source-browse.png",
    alt: "Anime Source Browse Feed",
    badge: "Anime Feed",
    title: "Source Feed & Popular Catalog",
    description:
      "Browse Popular, Latest, and direct search feeds inside any installed anime source.",
  },
  {
    src: "/AutaKimi/assets/screenshots/history-anime.png",
    alt: "Anime History with Source Badges",
    badge: "Source Badges",
    title: "Cross-Source Anime History",
    description:
      "Every card displays its owning extension badge so duplicate series names never blur together.",
  },
  {
    src: "/AutaKimi/assets/screenshots/history-manga.png",
    alt: "Manga Reading History",
    badge: "Source Badges",
    title: "Cross-Source Manga History",
    description:
      "Resume from the last read chapter with per-extension attribution.",
  },
  {
    src: "/AutaKimi/assets/screenshots/library-anime.png",
    alt: "Saved Anime Library",
    badge: "Library",
    title: "Saved Anime Library",
    description: "Clean Anime & Manga shelves displaying source tags on covers.",
  },
  {
    src: "/AutaKimi/assets/screenshots/library-manga.png",
    alt: "Saved Manga Library",
    badge: "Library",
    title: "Saved Manga Library",
    description: "Local SQLite library with status metadata and source pills.",
  },
  {
    src: "/AutaKimi/assets/screenshots/anime-player-sidebar.png",
    alt: "Anime Video Player with Sidebar",
    badge: "Anime Player",
    title: "Built-In Player, Skip Intro & Multi-Server",
    description:
      "Hardware-accelerated player with Skip Intro, Ambient Glow, Episode Sidebar, and instant server switch.",
  },
  {
    src: "/AutaKimi/assets/screenshots/anime-player-fullscreen.png",
    alt: "Fullscreen Anime Player",
    badge: "Theater Mode",
    title: "Clean Fullscreen Overlay",
    description:
      "Minimal top controls with Auto-Next, server selector, and 1080p quality switch.",
  },
  {
    src: "/AutaKimi/assets/screenshots/anime-mini-pip.png",
    alt: "Docked Mini Player",
    badge: "Mini Player",
    title: "In-App Dockable Mini Player",
    description:
      "Keep watching in the corner while browsing your library or managing downloads.",
  },
  {
    src: "/AutaKimi/assets/screenshots/anime-floating-pip.png",
    alt: "System-wide Floating PiP",
    badge: "Floating PiP",
    title: "Always-On-Top Desktop Floating PiP",
    description:
      "Detach playback to float smoothly over other desktop windows.",
  },
  {
    src: "/AutaKimi/assets/screenshots/anime-floating-pip-hover.png",
    alt: "Floating PiP Hover Controls",
    badge: "Floating PiP",
    title: "Floating PiP Quick Return & Playback Controls",
    description:
      "Hover the floating window to pause, skip, or snap straight back into the main tab.",
  },
  {
    src: "/AutaKimi/assets/screenshots/manga-reader-vertical.png",
    alt: "Vertical Webtoon Reader",
    badge: "Manga Reader",
    title: "Continuous Vertical Webtoon Reader",
    description:
      "Silky vertical scrolling with drag mode, Night Eye-Care tint, and minimal chrome.",
  },
  {
    src: "/AutaKimi/assets/screenshots/manga-reader-chapters.png",
    alt: "Reader Chapter Switcher",
    badge: "Manga Reader",
    title: "Instant Chapter Dropdown in Reader",
    description:
      "Switch directly between chapters without exiting your reading flow.",
  },
  {
    src: "/AutaKimi/assets/screenshots/themes-showcase.png",
    alt: "Themes Showcase",
    badge: "Themes",
    title: "Studio & Character Themes",
    description:
      "Customize workspace colors, monochrome studio modes, and character palettes.",
  },
  {
    src: "/AutaKimi/assets/screenshots/manga-details-rtl.png",
    alt: "Manga Details in Arabic RTL",
    badge: "Arabic RTL",
    title: "Native Arabic RTL & Chapter Details",
    description:
      "Complete right-to-left Arabic support with synopses, Smart Downloads, and AniList tracking.",
  },
  {
    src: "/AutaKimi/assets/screenshots/anime-details-episode-list.png",
    alt: "Anime Details & Episode List",
    badge: "AniList Sync",
    title: "Episode Tracking & Last-Watched State",
    description:
      "Track watched episodes with unread filters and automatic two-way AniList updates.",
  },
];

export function DocsClient() {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const openLightbox = (src: string) => {
    const idx = DOCS_GALLERY.findIndex((item) => item.src === src);
    setActiveImageIndex(idx >= 0 ? idx : 0);
    setLightboxOpen(true);
  };

  const ScreenshotThumb = ({
    src,
    alt,
    caption,
  }: {
    src: string;
    alt: string;
    caption: string;
  }) => (
    <button
      type="button"
      onClick={() => openLightbox(src)}
      className="group relative rounded-xl overflow-hidden border border-white/[0.08] bg-zinc-950 hover:border-white/25 transition-all text-left cursor-zoom-in"
      title="Click to inspect full resolution"
    >
      <div className="relative aspect-[16/9] w-full">
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(max-width: 768px) 100vw, 420px"
          className="object-cover object-top group-hover:scale-[1.02] transition-transform duration-500"
        />
      </div>
      <div className="px-3 py-2 border-t border-white/[0.06] bg-zinc-950/90 flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-zinc-300 truncate">
          {caption}
        </span>
        <Expand className="w-3 h-3 text-zinc-500 group-hover:text-white shrink-0 transition-colors" />
      </div>
    </button>
  );

  const sections = [
    {
      id: "getting-started",
      title: "Getting Started",
      icon: <Zap className="w-4 h-4 text-rose-400" />,
      content: (
        <div className="space-y-4 text-sm text-zinc-300 leading-relaxed">
          <p>
            AutaKimi is completely local-first and runs natively on Windows
            10/11 and Android devices without emulators or cloud accounts.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            <div className="bg-zinc-950/70 border border-white/[0.08] rounded-xl p-4">
              <h4 className="text-white font-semibold flex items-center gap-2 mb-2.5 text-sm">
                <Monitor className="w-4 h-4 text-rose-400" /> Windows Desktop
              </h4>
              <ol className="list-decimal pl-5 space-y-1.5 text-xs text-zinc-400">
                <li>
                  Download{" "}
                  <code className="bg-zinc-900 px-1.5 py-0.5 rounded text-zinc-200 border border-white/[0.08]">
                    AutaKimi.exe
                  </code>{" "}
                  from the{" "}
                  <Link
                    href="/changelog"
                    className="text-rose-400 hover:text-rose-300 hover:underline"
                  >
                    Releases Page
                  </Link>
                  .
                </li>
                <li>Run the installer or portable build directly.</li>
                <li>
                  Pick English or Arabic (RTL) and select your studio theme.
                </li>
              </ol>
            </div>
            <div className="bg-zinc-950/70 border border-white/[0.08] rounded-xl p-4">
              <h4 className="text-white font-semibold flex items-center gap-2 mb-2.5 text-sm">
                <Smartphone className="w-4 h-4 text-emerald-400" /> Android
                Mobile
              </h4>
              <ol className="list-decimal pl-5 space-y-1.5 text-xs text-zinc-400">
                <li>
                  Download{" "}
                  <code className="bg-zinc-900 px-1.5 py-0.5 rounded text-zinc-200 font-mono border border-white/[0.08]">
                    app-arm64-v8a-release.apk
                  </code>{" "}
                  (51&nbsp;MB, recommended for 64-bit phones).
                </li>
                <li>Install the APK on your Android device.</li>
                <li>
                  Pair with Desktop over LAN Wi-Fi or restore a{" "}
                  <code className="bg-zinc-900 px-1.5 py-0.5 rounded text-zinc-200 border border-white/[0.08]">
                    .json.gz
                  </code>{" "}
                  backup.
                </li>
              </ol>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "extensions",
      title: "Multi-Repo Extensions",
      icon: <Puzzle className="w-4 h-4 text-rose-400" />,
      content: (
        <div className="space-y-4 text-sm text-zinc-300 leading-relaxed">
          <p>
            AutaKimi ships as an empty shell and hosts no media. You install
            sandboxed extensions from your chosen repositories with full feature
            parity across Desktop and Android.
          </p>
          <ul className="list-disc pl-5 space-y-2 text-zinc-400">
            <li>
              <strong className="text-zinc-200">
                Repo Color &amp; Version Isolation:
              </strong>{" "}
              Add AutaKimi and Keiyoushi repositories side by side. Each repo
              keeps an isolated catalog, distinct badge color, and independent
              version checks.
            </li>
            <li>
              <strong className="text-zinc-200">
                Source Badges Everywhere:
              </strong>{" "}
              Cards in History, Library, and Downloads automatically display the
              owning extension badge so duplicate series names never blur
              together.
            </li>
            <li>
              <strong className="text-zinc-200">
                One-Click Updates &amp; Bulk Refresh:
              </strong>{" "}
              Check available updates directly inside Extensions on both Windows
              and Android.
            </li>
          </ul>
          <div className="p-4 rounded-xl bg-zinc-950/70 border border-white/[0.08] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-white text-sm">
                Community Extensions Repository
              </p>
              <p className="text-xs text-zinc-400 mt-0.5">
                Explore community templates, source manifests, and scrapers.
              </p>
            </div>
            <a
              href="https://github.com/Autakimi-Ecosystem/autakimi-extensions"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white text-zinc-950 hover:bg-zinc-200 font-semibold text-xs transition-colors whitespace-nowrap"
            >
              <span>Open Repository</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </a>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <ScreenshotThumb
              src="/AutaKimi/assets/screenshots/manga-browse.webp"
              alt="Manga Catalog Feed"
              caption="Manga Catalog & Discovery"
            />
            <ScreenshotThumb
              src="/AutaKimi/assets/screenshots/history-anime.png"
              alt="History with Source Badges"
              caption="Per-Extension Source Badges in History"
            />
          </div>
        </div>
      ),
    },
    {
      id: "reader-and-playback",
      title: "Player, Reader & Comfort",
      icon: <Sliders className="w-4 h-4 text-rose-400" />,
      content: (
        <div className="space-y-4 text-sm text-zinc-300 leading-relaxed">
          <p>
            Designed for long reading and binge-watching sessions without
            visual fatigue or clutter.
          </p>
          <ul className="list-disc pl-5 space-y-2 text-zinc-400">
            <li>
              <strong className="text-zinc-200">
                Floating PiP &amp; Mini Player:
              </strong>{" "}
              Shrink playback into an in-app corner player while browsing or pop
              it into an always-on-top desktop window.
            </li>
            <li>
              <strong className="text-zinc-200">Night Eye-Care Filter:</strong>{" "}
              Apply a warm sepia tint and custom dimming overlay directly inside
              the reader without changing Windows or Android system brightness.
            </li>
            <li>
              <strong className="text-zinc-200">Smart Downloads:</strong>{" "}
              Automatically caches the next 3 chapters as you read and cleans up
              completed ones to protect storage.
            </li>
            <li>
              <strong className="text-zinc-200">
                Local Wrapped &amp; Discord Presence:
              </strong>{" "}
              View weekly watch/read hours, streaks, and top genres locally, or
              toggle optional Discord Rich Presence in Settings.
            </li>
          </ul>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <ScreenshotThumb
              src="/AutaKimi/assets/screenshots/anime-player-sidebar.png"
              alt="Anime Player with Episode Sidebar"
              caption="Anime Player · Skip Intro & Ambient Glow"
            />
            <ScreenshotThumb
              src="/AutaKimi/assets/screenshots/anime-floating-pip.png"
              alt="Floating PiP Over Desktop"
              caption="Always-On-Top Floating PiP"
            />
            <ScreenshotThumb
              src="/AutaKimi/assets/screenshots/manga-reader-vertical.png"
              alt="Continuous Vertical Reader"
              caption="Vertical Webtoon Reader & Eye-Care"
            />
            <ScreenshotThumb
              src="/AutaKimi/assets/screenshots/anime-mini-pip.png"
              alt="Docked Mini Player in Library"
              caption="Docked Mini Player Inside Library"
            />
          </div>
        </div>
      ),
    },
    {
      id: "lan-sync",
      title: "Local Wi-Fi Sync & Backups",
      icon: <Wifi className="w-4 h-4 text-rose-400" />,
      content: (
        <div className="space-y-4 text-sm text-zinc-300 leading-relaxed">
          <p>
            Keep reading state, library entries, and history synchronized
            between Windows and Android with zero third-party cloud servers.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-zinc-950/70 border border-white/[0.08] rounded-xl p-4">
              <h4 className="text-white font-semibold flex items-center gap-2 mb-1.5 text-sm">
                <Wifi className="w-4 h-4 text-zinc-300" /> LAN Wi-Fi Discovery
              </h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                When Desktop and Android are on the same local network, your
                phone discovers the Desktop sync host automatically to merge
                reading progress.
              </p>
            </div>
            <div className="bg-zinc-950/70 border border-white/[0.08] rounded-xl p-4">
              <h4 className="text-white font-semibold flex items-center gap-2 mb-1.5 text-sm">
                <HardDrive className="w-4 h-4 text-zinc-300" /> Offline .json.gz
                Backups
              </h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Export your complete SQLite library as a compressed{" "}
                <code className="bg-zinc-900 px-1 py-0.5 rounded text-zinc-200 border border-white/[0.08]">
                  .json.gz
                </code>{" "}
                archive and restore it on any device offline.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "anilist-tracking",
      title: "AniList Smart Tracking",
      icon: <CheckCircle2 className="w-4 h-4 text-rose-400" />,
      content: (
        <div className="space-y-4 text-sm text-zinc-300 leading-relaxed">
          <p>
            Synchronize your anime and manga progress to AniList automatically
            as you finish chapters and episodes.
          </p>
          <ul className="list-disc pl-5 space-y-2 text-zinc-400">
            <li>
              <strong className="text-zinc-200">Automated Scrobbling:</strong>{" "}
              Progress updates immediately when completing an episode or
              chapter.
            </li>
            <li>
              <strong className="text-zinc-200">Smart Completion:</strong>{" "}
              Automatically transitions status from <em>CURRENT</em> to{" "}
              <em>COMPLETED</em> on the final entry.
            </li>
            <li>
              <strong className="text-zinc-200">
                Offline SQLite Retry Queue:
              </strong>{" "}
              Updates made offline queue safely in SQLite and replay when
              connectivity returns.
            </li>
          </ul>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <ScreenshotThumb
              src="/AutaKimi/assets/screenshots/manga-details-rtl.png"
              alt="Manga Details Arabic RTL"
              caption="Native Arabic RTL Details & Chapters"
            />
            <ScreenshotThumb
              src="/AutaKimi/assets/screenshots/anime-details-episode-list.png"
              alt="Anime Episode List & Tracking"
              caption="Episode Progress & AniList Tracking"
            />
          </div>
        </div>
      ),
    },
    {
      id: "offline-reading",
      title: "Offline Reading & CBZ Storage",
      icon: <Database className="w-4 h-4 text-rose-400" />,
      content: (
        <div className="space-y-4 text-sm text-zinc-300 leading-relaxed">
          <p>
            Your library, chapters, and history live strictly in local SQLite
            storage. Download chapters for offline trips anytime.
          </p>
          <div className="bg-zinc-950/70 border border-white/[0.08] rounded-xl p-4">
            <h4 className="text-white font-semibold flex items-center gap-2 mb-1.5 text-sm">
              <Download className="w-4 h-4 text-emerald-400" /> Bulk Downloading
              &amp; CBZ Export
            </h4>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Queue chapters into the background downloader and store them as
              standard{" "}
              <code className="bg-zinc-900 px-1 py-0.5 rounded text-zinc-200 border border-white/[0.08]">
                .cbz
              </code>{" "}
              archives ready for offline reading or portable export.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "screenshots-gallery",
      title: "Screenshots Gallery",
      icon: <Images className="w-4 h-4 text-rose-400" />,
      content: (
        <div className="space-y-4 text-sm text-zinc-300 leading-relaxed">
          <p>
            Browse every desktop view in full resolution—click any card to
            open the interactive gallery viewer.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {DOCS_GALLERY.map((item) => (
              <ScreenshotThumb
                key={item.src}
                src={item.src}
                alt={item.alt}
                caption={item.title || item.alt}
              />
            ))}
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="w-full max-w-6xl mx-auto px-5 pt-12 pb-24 flex flex-col md:flex-row gap-10 relative z-10">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 shrink-0">
        <div className="sticky top-24 studio-surface rounded-2xl p-5">
          <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-white/[0.06]">
            <BookOpen className="w-4 h-4 text-rose-400" />
            <h3 className="font-semibold text-sm text-white">Contents</h3>
          </div>
          <nav className="flex flex-col space-y-1">
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/[0.05] px-3 py-2 rounded-lg transition-colors flex items-center justify-between group"
              >
                <span>{s.title}</span>
                <ChevronRight className="w-3.5 h-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-zinc-500" />
              </a>
            ))}
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 min-w-0 space-y-10">
        <div className="space-y-3 border-b border-white/[0.06] pb-8">
          <span className="section-kicker">Documentation &amp; Visual Tour</span>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white font-[family-name:var(--font-outfit)]">
            Knowledge Base
          </h1>
          <p className="text-zinc-400 text-base max-w-2xl leading-relaxed">
            Setup guides, multi-repo extension management, local LAN sync,
            offline playback tips, and full desktop screenshots.
          </p>
        </div>

        <div className="space-y-6">
          {sections.map((section) => (
            <section
              key={section.id}
              id={section.id}
              className="scroll-mt-24 studio-surface rounded-2xl p-6 sm:p-8"
            >
              <div className="flex items-center gap-3 mb-5 pb-4 border-b border-white/[0.06]">
                <div className="w-8 h-8 bg-white/[0.05] border border-white/[0.08] rounded-lg flex items-center justify-center shrink-0">
                  {section.icon}
                </div>
                <h2 className="text-lg font-semibold text-white">
                  {section.title}
                </h2>
              </div>
              {section.content}
            </section>
          ))}
        </div>
      </div>

      <ImageLightbox
        images={DOCS_GALLERY}
        currentIndex={activeImageIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        onNavigate={setActiveImageIndex}
      />
    </div>
  );
}
