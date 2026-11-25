import type { Metadata } from "next";
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
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Documentation - AutaKimi (Windows & Android)",
  description:
    "Learn how to get started with AutaKimi on Windows and Android, configure multi-repo extensions, sync over LAN, enable Floating PiP, and download CBZ archives.",
  openGraph: {
    title: "Documentation - AutaKimi (Windows & Android)",
    description:
      "Learn how to get started with AutaKimi on Windows and Android, configure multi-repo extensions, sync over LAN, enable Floating PiP, and download CBZ archives.",
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
              <strong className="text-zinc-200">Repo Color &amp; Version Isolation:</strong>{" "}
              Add AutaKimi and Keiyoushi repositories side by side. Each repo
              keeps an isolated catalog, distinct badge color, and independent
              version checks.
            </li>
            <li>
              <strong className="text-zinc-200">Source Badges Everywhere:</strong>{" "}
              Cards in History, Library, and Downloads automatically display the
              owning extension badge so duplicate series names never blur
              together.
            </li>
            <li>
              <strong className="text-zinc-200">One-Click Updates &amp; Bulk Refresh:</strong>{" "}
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
          <div className="rounded-xl overflow-hidden border border-white/[0.08] mt-4 group relative">
            <a
              href="/AutaKimi/assets/screenshots/manga-browse.png"
              target="_blank"
              rel="noopener noreferrer"
              title="Open full resolution"
              className="block relative"
            >
              <Image
                src="/AutaKimi/assets/screenshots/manga-browse.webp"
                alt="AutaKimi Extension Catalog and Feed"
                width={1280}
                height={700}
                className="w-full group-hover:scale-[1.01] transition-transform duration-500"
              />
              <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/75 border border-white/10 text-[11px] font-medium text-zinc-200 backdrop-blur-md">
                <Expand className="w-3 h-3" />
                <span>Full resolution</span>
              </span>
            </a>
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
              <strong className="text-zinc-200">Floating PiP &amp; Mini Player:</strong>{" "}
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
              <strong className="text-zinc-200">Local Wrapped &amp; Discord Presence:</strong>{" "}
              View weekly watch/read hours, streaks, and top genres locally, or
              toggle optional Discord Rich Presence in Settings.
            </li>
          </ul>
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
              <strong className="text-zinc-200">Offline SQLite Retry Queue:</strong>{" "}
              Updates made offline queue safely in SQLite and replay when
              connectivity returns.
            </li>
          </ul>
          <div className="rounded-xl overflow-hidden border border-white/[0.08] mt-4 group relative">
            <a
              href="/AutaKimi/assets/screenshots/manga-details-rtl.png"
              target="_blank"
              rel="noopener noreferrer"
              title="Open full resolution"
              className="block relative"
            >
              <Image
                src="/AutaKimi/assets/screenshots/manga-details-rtl.png"
                alt="AutaKimi Media Details and Progress Tracking"
                width={1280}
                height={700}
                className="w-full group-hover:scale-[1.01] transition-transform duration-500"
              />
              <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/75 border border-white/10 text-[11px] font-medium text-zinc-200 backdrop-blur-md">
                <Expand className="w-3 h-3" />
                <span>Full resolution</span>
              </span>
            </a>
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
          <span className="section-kicker">Documentation</span>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white font-[family-name:var(--font-outfit)]">
            Knowledge Base
          </h1>
          <p className="text-zinc-400 text-base max-w-2xl leading-relaxed">
            Setup guides, multi-repo extension management, local LAN sync, and
            offline playback tips across Windows and Android.
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
    </div>
  );
}
