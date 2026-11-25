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
  Images,
} from "lucide-react";
import { useState, useEffect } from "react";
import Link from "next/link";

import { MediaButton } from "@/components/ui/media-button";
import { ApkDownloadButton } from "@/components/ui/apk-download-button";

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

  return (
    <div className="w-full flex flex-col items-center">
      {/* HERO */}
      <section className="w-full max-w-5xl px-5 pt-20 pb-20 md:pt-28 md:pb-24">
        <div className="max-w-3xl mx-auto text-center space-y-7">
          <Link
            href="/changelog"
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] hover:border-white/20 transition-colors text-xs text-zinc-300"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            <span className="font-mono">v{version}</span>
            <span className="text-zinc-600">·</span>
            <span>Windows &amp; Android · GPL-3.0</span>
            <ArrowRight className="w-3 h-3 text-zinc-500" />
          </Link>

          <h1 className="text-4xl sm:text-6xl md:text-[66px] font-bold tracking-[-0.03em] leading-[1.06] text-white font-[family-name:var(--font-outfit)]">
            Read <span className="text-[#e11d48]">manga</span>. Watch{" "}
            <span className="text-[#e11d48]">anime</span>.{" "}
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
              href="/docs/gallery/"
              className="inline-flex items-center gap-1.5 h-11 px-4 rounded-xl text-sm font-medium text-zinc-300 hover:text-white border border-white/[0.08] hover:border-white/20 transition-colors"
            >
              <Images className="w-4 h-4 text-zinc-400" />
              <span>Screenshots &amp; Docs</span>
            </Link>
          </div>

          <div className="pt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-mono text-zinc-500">
            <span>Windows 10 / 11 (.exe)</span>
            <span className="hidden sm:inline text-zinc-700">/</span>
            <span>Android 5.0+ (arm64-v8a)</span>
            <span className="hidden sm:inline text-zinc-700">/</span>
            <span>Arabic (RTL) &amp; English</span>
            <span className="hidden sm:inline text-zinc-700">/</span>
            <span>Local SQLite</span>
          </div>
        </div>
      </section>

      {/* BENTO CAPABILITIES */}
      <section
        id="features"
        className="w-full max-w-6xl px-5 py-16 border-t border-white/[0.06]"
      >
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
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
          <div className="md:col-span-3 rounded-2xl studio-surface p-6 space-y-3 hover:border-white/[0.15] transition-colors">
            <div className="inline-flex items-center gap-2 text-xs font-mono text-rose-400">
              <Play className="w-3.5 h-3.5" />
              <span>STREAMING &amp; PIP</span>
            </div>
            <h3 className="text-lg font-semibold text-white">
              Hardware-accelerated player &amp; Floating PiP
            </h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Built-in Skip Intro, edge ambient glow, Auto-Next, fast
              multi-server fallback, dockable Mini Player, and an always-on-top
              Floating PiP window.
            </p>
          </div>

          <div className="md:col-span-3 rounded-2xl studio-surface p-6 space-y-3 hover:border-white/[0.15] transition-colors">
            <div className="inline-flex items-center gap-2 text-xs font-mono text-rose-400">
              <BookOpen className="w-3.5 h-3.5" />
              <span>READER ENGINE</span>
            </div>
            <h3 className="text-lg font-semibold text-white">
              Vertical Webtoon, Night Eye-Care &amp; Smart Downloads
            </h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Continuous vertical scroll, RTL/LTR paged modes, warm Eye-Care
              dimming tint, automatic next-chapter caching, and offline{" "}
              <code className="text-zinc-200 font-mono text-xs">.cbz</code>{" "}
              archives.
            </p>
          </div>

          <div className="md:col-span-2 rounded-2xl studio-surface p-6 flex flex-col justify-between gap-5 hover:border-white/[0.15] transition-colors">
            <div className="space-y-2.5">
              <div className="w-9 h-9 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-zinc-200">
                <Puzzle className="w-4 h-4" />
              </div>
              <h3 className="text-base font-semibold text-white">
                Isolated Multi-Repo Catalogs
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Run AutaKimi &amp; Keiyoushi repos side by side with repo badge
                colors, isolated versions, and source pills across History and
                Library.
              </p>
            </div>
            <a
              href="https://github.com/Autakimi-Ecosystem/autakimi-extensions"
              target="_blank"
              rel="noopener noreferrer"
              className="pt-3 border-t border-white/[0.06] inline-flex items-center justify-between text-xs font-medium text-zinc-300 hover:text-white transition-colors"
            >
              <span>Browse extensions repo</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-zinc-500" />
            </a>
          </div>

          <div className="md:col-span-2 rounded-2xl studio-surface p-6 flex flex-col justify-between gap-5 hover:border-white/[0.15] transition-colors">
            <div className="space-y-2.5">
              <div className="w-9 h-9 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-zinc-200">
                <Wifi className="w-4 h-4" />
              </div>
              <h3 className="text-base font-semibold text-white">
                Local Wi-Fi Sync &amp; Backups
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Pair Android with Desktop over home Wi-Fi to merge progress—or
                export{" "}
                <code className="text-zinc-200 font-mono text-xs">.json.gz</code>{" "}
                backups with zero cloud servers.
              </p>
            </div>
            <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs font-mono text-zinc-500">
              <span>Zero cloud</span>
              <span className="text-emerald-400">LAN Auto-Discovery</span>
            </div>
          </div>

          <div className="md:col-span-2 rounded-2xl studio-surface p-6 flex flex-col justify-between gap-5 hover:border-white/[0.15] transition-colors">
            <div className="space-y-2.5">
              <div className="w-9 h-9 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-zinc-200">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <h3 className="text-base font-semibold text-white">
                AniList Tracking &amp; Local Stats
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Two-way AniList scrobbling with an offline SQLite queue, plus
                weekly Wrapped stats and opt-in Discord Rich Presence.
              </p>
            </div>
            <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs font-mono text-zinc-500">
              <span className="inline-flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-zinc-400" />
                100% Local Stats
              </span>
              <span>Offline Queue</span>
            </div>
          </div>
        </div>

        {/* Clean Docs & Visual Tour Callout */}
        <div className="mt-6 rounded-2xl studio-surface p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-white">
              Want to see the interface in action?
            </h3>
            <p className="text-sm text-zinc-400">
              All 16 high-resolution desktop screenshots, setup guides, and the
              interactive gallery live inside Documentation.
            </p>
          </div>
          <Link
            href="/docs/gallery/"
            className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 text-xs font-semibold transition-colors shrink-0"
          >
            <Images className="w-3.5 h-3.5" />
            <span>View Screenshots in Docs</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
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
    </div>
  );
}
