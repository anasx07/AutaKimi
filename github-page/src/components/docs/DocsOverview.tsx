import Link from "next/link";
import { ArrowRight, BookOpen, HelpCircle, Images } from "lucide-react";
import { DOCS_NAV_GROUPS, DOC_PAGES } from "@/data/docs";
import { DocsShell } from "@/components/docs/DocsShell";

export function DocsOverview() {
  const guideCount = DOC_PAGES.filter((p) => p.category === "guides").length;
  const faqCount = DOC_PAGES.filter((p) => p.category === "faq").length;

  return (
    <DocsShell
      overviewContent={
        <div className="space-y-10">
          <header className="space-y-3 border-b border-white/[0.08] pb-7">
            <span className="section-kicker">AutaKimi Documentation</span>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white font-[family-name:var(--font-outfit)]">
              Knowledge Base &amp; Guides
            </h1>
            <p className="text-zinc-400 text-base leading-relaxed">
              Everything you need to install AutaKimi, manage isolated
              extension repositories, configure Floating PiP &amp; Night
              Eye-Care, and sync progress between Windows and Android.
            </p>
          </header>

          {/* Quick Jump Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Link
              href="/docs/guides/getting-started/"
              className="group studio-surface rounded-2xl p-5 hover:border-white/20 transition-colors"
            >
              <BookOpen className="w-5 h-5 text-rose-400 mb-3" />
              <h2 className="text-sm font-semibold text-white mb-1">
                {guideCount} Feature Guides
              </h2>
              <p className="text-xs text-zinc-400 leading-relaxed mb-3">
                Step-by-step setup for Desktop, Android, Multi-Repo, PiP, and
                LAN Sync.
              </p>
              <span className="text-xs font-medium text-rose-400 inline-flex items-center gap-1 group-hover:gap-1.5 transition-all">
                Start with Getting Started <ArrowRight className="w-3 h-3" />
              </span>
            </Link>

            <Link
              href="/docs/faq/general/"
              className="group studio-surface rounded-2xl p-5 hover:border-white/20 transition-colors"
            >
              <HelpCircle className="w-5 h-5 text-emerald-400 mb-3" />
              <h2 className="text-sm font-semibold text-white mb-1">
                {faqCount} FAQ Topics
              </h2>
              <p className="text-xs text-zinc-400 leading-relaxed mb-3">
                Quick answers about covers, source badges, Smart Downloads, and
                updates.
              </p>
              <span className="text-xs font-medium text-emerald-400 inline-flex items-center gap-1 group-hover:gap-1.5 transition-all">
                Browse FAQs <ArrowRight className="w-3 h-3" />
              </span>
            </Link>

            <Link
              href="/docs/gallery/"
              className="group studio-surface rounded-2xl p-5 hover:border-white/20 transition-colors"
            >
              <Images className="w-5 h-5 text-zinc-200 mb-3" />
              <h2 className="text-sm font-semibold text-white mb-1">
                Screenshots Gallery
              </h2>
              <p className="text-xs text-zinc-400 leading-relaxed mb-3">
                Explore 16 high-resolution desktop views in the fullscreen
                viewer.
              </p>
              <span className="text-xs font-medium text-zinc-200 inline-flex items-center gap-1 group-hover:gap-1.5 transition-all">
                Open Gallery <ArrowRight className="w-3 h-3" />
              </span>
            </Link>
          </div>

          {/* All Pages Directory */}
          <div className="space-y-6">
            {DOCS_NAV_GROUPS.map((group) => (
              <div key={group.id} className="space-y-3">
                <h2 className="text-xs font-mono uppercase tracking-wider text-zinc-400">
                  {group.title}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {group.items.map((item) => {
                    const page = DOC_PAGES.find((p) => p.slug === item.slug);
                    return (
                      <Link
                        key={item.slug}
                        href={`/docs/${item.slug}/`}
                        className="studio-surface rounded-xl p-4 hover:border-white/20 transition-colors flex items-start justify-between gap-3 group"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white group-hover:text-rose-400 transition-colors">
                            {item.title}
                          </p>
                          {page && (
                            <p className="text-xs text-zinc-400 line-clamp-2 mt-1">
                              {page.subtitle}
                            </p>
                          )}
                        </div>
                        <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-rose-400 shrink-0 mt-0.5 transition-colors" />
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      }
    />
  );
}
