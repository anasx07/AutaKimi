"use client";

import { useState, useEffect, useMemo, useCallback, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Expand,
  ExternalLink,
  Menu,
  X,
  Info,
  Lightbulb,
  AlertTriangle,
  Copy,
  Check,
  Edit3,
  BookOpen,
} from "lucide-react";
import {
  DOCS_NAV_GROUPS,
  DOCS_GALLERY,
  DOC_PAGES,
  getPrevNextDocs,
  type DocPage,
  type DocCallout,
} from "@/data/docs";
import { ImageLightbox } from "@/components/ui/image-lightbox";

interface SearchHit {
  slug: string;
  pageTitle: string;
  categoryLabel: string;
  sectionId?: string;
  sectionTitle?: string;
  snippet: string;
}

function CopySnippet({ label, snippet }: { label?: string; snippet: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard?.writeText(snippet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <div className="rounded-xl border border-white/[0.08] bg-zinc-950 overflow-hidden my-3">
      {label && (
        <div className="px-3.5 py-2 border-b border-white/[0.06] flex items-center justify-between text-[11px] font-mono text-zinc-400">
          <span>{label}</span>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      )}
      <pre className="p-3.5 text-xs font-mono text-zinc-200 overflow-x-auto">
        <code>{snippet}</code>
      </pre>
    </div>
  );
}

function CalloutBox({ callout }: { callout: DocCallout }) {
  const toneStyles = {
    note: {
      border: "border-l-zinc-400 bg-zinc-900/60 border-white/[0.08]",
      icon: <Info className="w-4 h-4 text-zinc-300 shrink-0 mt-0.5" />,
      title: callout.title || "Note",
      titleColor: "text-zinc-200",
    },
    tip: {
      border: "border-l-emerald-400 bg-emerald-500/[0.06] border-emerald-500/20",
      icon: <Lightbulb className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />,
      title: callout.title || "Tip",
      titleColor: "text-emerald-300",
    },
    warning: {
      border: "border-l-amber-400 bg-amber-500/[0.06] border-amber-500/20",
      icon: (
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
      ),
      title: callout.title || "Heads up",
      titleColor: "text-amber-300",
    },
  }[callout.tone];

  return (
    <div
      className={`rounded-xl border border-l-2 p-4 my-3 flex items-start gap-3 ${toneStyles.border}`}
    >
      {toneStyles.icon}
      <div className="space-y-1 text-xs leading-relaxed">
        <p className={`font-semibold uppercase tracking-wider text-[11px] ${toneStyles.titleColor}`}>
          {toneStyles.title}
        </p>
        <p className="text-zinc-300">{callout.body}</p>
      </div>
    </div>
  );
}

export function DocsShell({
  page,
  overviewContent,
}: {
  page?: DocPage;
  overviewContent?: ReactNode;
}) {
  const router = useRouter();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    guides: true,
    faq: true,
    gallery: true,
  });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedHit, setSelectedHit] = useState(0);
  const [activeAnchor, setActiveAnchor] = useState<string>(
    page?.sections[0]?.id || "",
  );
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const currentSlug = page?.slug || "";
  const { prev, next } = page ? getPrevNextDocs(page.slug) : {};

  // Scroll spy for "On this page"
  useEffect(() => {
    if (!page || page.sections.length === 0) return;
    setActiveAnchor(page.sections[0].id);

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveAnchor(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: "-96px 0px -65% 0px", threshold: 0 },
    );

    for (const sec of page.sections) {
      const el = document.getElementById(sec.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [page]);

  // Search index
  const searchResults = useMemo<SearchHit[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return DOC_PAGES.slice(0, 8).map((p) => ({
        slug: p.slug,
        pageTitle: p.title,
        categoryLabel: p.categoryLabel,
        snippet: p.subtitle,
      }));
    }

    const hits: SearchHit[] = [];
    for (const p of DOC_PAGES) {
      const titleMatch =
        p.title.toLowerCase().includes(q) ||
        p.subtitle.toLowerCase().includes(q);
      if (titleMatch) {
        hits.push({
          slug: p.slug,
          pageTitle: p.title,
          categoryLabel: p.categoryLabel,
          snippet: p.subtitle,
        });
      }

      for (const s of p.sections) {
        const textPool = [
          s.title,
          ...(s.paragraphs || []),
          ...(s.steps || []),
          ...(s.bullets || []).map((b) => `${b.label || ""} ${b.text}`),
        ].join(" ");
        if (textPool.toLowerCase().includes(q)) {
          hits.push({
            slug: p.slug,
            pageTitle: p.title,
            categoryLabel: p.categoryLabel,
            sectionId: s.id,
            sectionTitle: s.title,
            snippet:
              (s.paragraphs && s.paragraphs[0]) ||
              (s.steps && s.steps[0]) ||
              (s.bullets && s.bullets[0]?.text) ||
              p.subtitle,
          });
        }
      }
    }
    return hits.slice(0, 12);
  }, [query]);

  useEffect(() => {
    setSelectedHit(0);
  }, [query]);

  const navigateToHit = useCallback(
    (hit: SearchHit) => {
      setSearchOpen(false);
      setQuery("");
      setMobileNavOpen(false);
      const target = hit.sectionId
        ? `/docs/${hit.slug}/#${hit.sectionId}`
        : `/docs/${hit.slug}/`;
      router.push(target);
    },
    [router],
  );

  // Global Ctrl+K / Cmd+K shortcut
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      } else if (e.key === "Escape" && searchOpen) {
        setSearchOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [searchOpen]);

  const openLightbox = (src: string) => {
    const idx = DOCS_GALLERY.findIndex((item) => item.src === src);
    setActiveImageIndex(idx >= 0 ? idx : 0);
    setLightboxOpen(true);
  };

  const renderSidebarNav = (onLinkClick?: () => void) => (
    <div className="space-y-5">
      {/* Overview Link */}
      <div>
        <Link
          href="/docs/"
          onClick={onLinkClick}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            !page
              ? "text-rose-400 bg-rose-500/[0.08]"
              : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Overview</span>
        </Link>
      </div>

      {DOCS_NAV_GROUPS.map((group) => {
        const isOpen = openGroups[group.id] !== false;
        return (
          <div key={group.id} className="space-y-1">
            <button
              type="button"
              onClick={() =>
                setOpenGroups((prevState) => ({
                  ...prevState,
                  [group.id]: !isOpen,
                }))
              }
              className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              <span>{group.title}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-zinc-500 transition-transform ${
                  isOpen ? "" : "-rotate-90"
                }`}
              />
            </button>

            {isOpen && (
              <div className="space-y-0.5 border-l border-white/[0.08] ml-3 pl-2">
                {group.items.map((item) => {
                  const active = currentSlug === item.slug;
                  return (
                    <Link
                      key={item.slug}
                      href={`/docs/${item.slug}/`}
                      onClick={onLinkClick}
                      className={`block px-2.5 py-1.5 rounded-md text-[13px] transition-colors ${
                        active
                          ? "text-rose-400 font-medium bg-rose-500/[0.08]"
                          : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
                      }`}
                    >
                      {item.title}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="w-full max-w-7xl mx-auto px-5 pt-6 pb-24 relative z-10">
      {/* Top Mobile Bar (Search + Drawer Toggle) */}
      <div className="flex lg:hidden items-center gap-2 mb-6 pb-4 border-b border-white/[0.06]">
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-white/[0.1] bg-zinc-900/70 text-xs font-medium text-zinc-200"
        >
          <Menu className="w-3.5 h-3.5" />
          <span>Menu</span>
        </button>

        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="flex-1 inline-flex items-center justify-between h-9 px-3 rounded-lg border border-white/[0.1] bg-zinc-900/70 text-xs text-zinc-400"
        >
          <span className="inline-flex items-center gap-2">
            <Search className="w-3.5 h-3.5" />
            <span>Search docs...</span>
          </span>
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.06] text-zinc-400">
            Ctrl K
          </kbd>
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-[120] lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] h-full bg-[#09090b] border-r border-white/[0.08] p-5 overflow-y-auto z-10">
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-white/[0.06]">
              <span className="text-sm font-semibold text-white">
                AutaKimi Docs
              </span>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="p-1 text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {renderSidebarNav(() => setMobileNavOpen(false))}
          </div>
        </div>
      )}

      {/* 3-Column Portal */}
      <div className="flex items-start gap-10">
        {/* LEFT SIDEBAR */}
        <aside className="hidden lg:block w-64 shrink-0 sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-2 no-scrollbar">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="w-full mb-5 flex items-center justify-between h-9 px-3 rounded-lg border border-white/[0.09] bg-zinc-900/60 hover:border-white/20 text-xs text-zinc-400 transition-colors cursor-pointer"
          >
            <span className="inline-flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-zinc-500" />
              <span>Search docs...</span>
            </span>
            <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.05] border border-white/[0.08] text-zinc-400">
              Ctrl K
            </kbd>
          </button>

          {renderSidebarNav()}
        </aside>

        {/* CENTER READING CANVAS */}
        <article className="flex-1 min-w-0 max-w-3xl">
          {overviewContent ? (
            overviewContent
          ) : page ? (
            <div className="space-y-8">
              {/* Breadcrumb + Header */}
              <header className="space-y-3 border-b border-white/[0.08] pb-7">
                <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono">
                  <Link
                    href="/docs/"
                    className="hover:text-zinc-200 transition-colors"
                  >
                    Docs
                  </Link>
                  <span>/</span>
                  <span className="text-zinc-400">{page.categoryLabel}</span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white font-[family-name:var(--font-outfit)]">
                  {page.title}
                </h1>
                <p className="text-zinc-400 text-base leading-relaxed">
                  {page.subtitle}
                </p>
              </header>

              {/* Gallery Special View */}
              {page.isGallery ? (
                <section id="all-screenshots" className="scroll-mt-24 space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {DOCS_GALLERY.map((item) => (
                      <button
                        key={item.src}
                        type="button"
                        onClick={() => openLightbox(item.src)}
                        className="group relative rounded-xl overflow-hidden border border-white/[0.08] bg-zinc-950 hover:border-white/25 transition-all text-left cursor-zoom-in"
                      >
                        <div className="relative aspect-[16/9] w-full">
                          <Image
                            src={item.src}
                            alt={item.alt}
                            fill
                            sizes="(max-width: 768px) 100vw, 380px"
                            className="object-cover object-top group-hover:scale-[1.02] transition-transform duration-500"
                          />
                        </div>
                        <div className="px-3.5 py-2.5 border-t border-white/[0.06] bg-zinc-950 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            {item.badge && (
                              <span className="text-[10px] font-mono uppercase tracking-wider text-rose-400 block">
                                {item.badge}
                              </span>
                            )}
                            <span className="text-xs font-medium text-zinc-200 truncate block">
                              {item.title || item.alt}
                            </span>
                          </div>
                          <Expand className="w-3.5 h-3.5 text-zinc-500 group-hover:text-white shrink-0" />
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              ) : (
                <div className="divide-y divide-white/[0.06]">
                  {page.sections.map((section, idx) => (
                    <section
                      key={section.id}
                      id={section.id}
                      className={`scroll-mt-24 ${idx === 0 ? "pb-8" : "py-8"}`}
                    >
                      <h2 className="text-xl font-semibold text-white mb-4">
                        {section.title}
                      </h2>

                      {section.paragraphs?.map((p, i) => (
                        <p
                          key={i}
                          className="text-sm text-zinc-300 leading-relaxed mb-3"
                        >
                          {p}
                        </p>
                      ))}

                      {section.steps && section.steps.length > 0 && (
                        <ol className="space-y-3 my-4">
                          {section.steps.map((step, i) => (
                            <li
                              key={i}
                              className="flex items-start gap-3 text-sm text-zinc-300 leading-relaxed"
                            >
                              <span className="w-5 h-5 rounded-full bg-white/[0.06] border border-white/[0.1] text-[11px] font-mono text-zinc-200 flex items-center justify-center shrink-0 mt-0.5">
                                {i + 1}
                              </span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ol>
                      )}

                      {section.bullets && section.bullets.length > 0 && (
                        <ul className="space-y-2.5 my-4">
                          {section.bullets.map((b, i) => (
                            <li
                              key={i}
                              className="flex items-start gap-2.5 text-sm text-zinc-300 leading-relaxed"
                            >
                              <span className="text-rose-400 mt-1 shrink-0">
                                •
                              </span>
                              <span>
                                {b.label && (
                                  <strong className="text-white font-semibold">
                                    {b.label}:{" "}
                                  </strong>
                                )}
                                {b.text}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}

                      {section.code && (
                        <CopySnippet
                          label={section.code.label}
                          snippet={section.code.snippet}
                        />
                      )}

                      {section.callout && (
                        <CalloutBox callout={section.callout} />
                      )}

                      {section.screenshots && section.screenshots.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                          {section.screenshots.map((shot) => (
                            <button
                              key={shot.src}
                              type="button"
                              onClick={() => openLightbox(shot.src)}
                              className="group relative rounded-xl overflow-hidden border border-white/[0.08] bg-zinc-950 hover:border-white/25 transition-all text-left cursor-zoom-in"
                            >
                              <div className="relative aspect-[16/9] w-full">
                                <Image
                                  src={shot.src}
                                  alt={shot.alt}
                                  fill
                                  sizes="(max-width: 768px) 100vw, 360px"
                                  className="object-cover object-top group-hover:scale-[1.02] transition-transform duration-500"
                                />
                              </div>
                              <div className="px-3 py-2 border-t border-white/[0.06] bg-zinc-950 flex items-center justify-between gap-2">
                                <span className="text-[11px] font-medium text-zinc-300 truncate">
                                  {shot.caption}
                                </span>
                                <Expand className="w-3 h-3 text-zinc-500 group-hover:text-white shrink-0" />
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {section.links && section.links.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-3">
                          {section.links.map((lnk) =>
                            lnk.external ? (
                              <a
                                key={lnk.href}
                                href={lnk.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.1] bg-white/[0.03] hover:bg-white/[0.08] text-xs font-medium text-zinc-200 transition-colors"
                              >
                                <span>{lnk.label}</span>
                                <ExternalLink className="w-3 h-3 text-zinc-500" />
                              </a>
                            ) : (
                              <Link
                                key={lnk.href}
                                href={lnk.href}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.1] bg-white/[0.03] hover:bg-white/[0.08] text-xs font-medium text-zinc-200 transition-colors"
                              >
                                <span>{lnk.label}</span>
                                <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
                              </Link>
                            ),
                          )}
                        </div>
                      )}
                    </section>
                  ))}
                </div>
              )}

              {/* Page Meta + Previous / Next Footer (Mihon style) */}
              <footer className="pt-6 border-t border-white/[0.08] space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500">
                  <a
                    href="https://github.com/anasx07/AutaKimi/edit/main/github-page/src/data/docs.ts"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-rose-400 hover:text-rose-300 transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Help us improve this page</span>
                  </a>
                  <span className="font-mono">
                    AutaKimi Docs · {page.categoryLabel}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {prev ? (
                    <Link
                      href={`/docs/${prev.slug}/`}
                      className="group rounded-xl border border-white/[0.08] bg-zinc-900/40 hover:border-white/20 p-4 transition-colors"
                    >
                      <span className="text-[11px] font-mono text-zinc-500 flex items-center gap-1 mb-1">
                        <ChevronLeft className="w-3 h-3" />
                        Previous page
                      </span>
                      <span className="text-sm font-medium text-rose-400 group-hover:text-rose-300">
                        {prev.title}
                      </span>
                    </Link>
                  ) : (
                    <div />
                  )}

                  {next ? (
                    <Link
                      href={`/docs/${next.slug}/`}
                      className="group rounded-xl border border-white/[0.08] bg-zinc-900/40 hover:border-white/20 p-4 text-right transition-colors"
                    >
                      <span className="text-[11px] font-mono text-zinc-500 flex items-center justify-end gap-1 mb-1">
                        Next page
                        <ChevronRight className="w-3 h-3" />
                      </span>
                      <span className="text-sm font-medium text-rose-400 group-hover:text-rose-300">
                        {next.title}
                      </span>
                    </Link>
                  ) : (
                    <div />
                  )}
                </div>
              </footer>
            </div>
          ) : null}
        </article>

        {/* RIGHT SIDEBAR: ON THIS PAGE */}
        <aside className="hidden xl:block w-52 shrink-0 sticky top-24">
          {page && page.sections.length > 0 && (
            <div className="space-y-3 border-l border-white/[0.06] pl-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                On this page
              </p>
              <nav className="flex flex-col space-y-2">
                {page.sections.map((s) => {
                  const isActive = activeAnchor === s.id;
                  return (
                    <a
                      key={s.id}
                      href={`#${s.id}`}
                      className={`text-xs transition-colors leading-snug ${
                        isActive
                          ? "text-rose-400 font-medium"
                          : "text-zinc-500 hover:text-zinc-200"
                      }`}
                    >
                      {s.title}
                    </a>
                  );
                })}
              </nav>
            </div>
          )}
        </aside>
      </div>

      {/* CTRL+K COMMAND SEARCH MODAL */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-[150] flex items-start justify-center pt-20 px-4 bg-black/75 backdrop-blur-sm"
          onClick={() => setSearchOpen(false)}
        >
          <div
            className="w-full max-w-xl rounded-2xl border border-white/[0.12] bg-[#0d0d10] shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.08]">
              <Search className="w-4 h-4 text-zinc-400 shrink-0" />
              <input
                type="text"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setSelectedHit((i) =>
                      searchResults.length ? (i + 1) % searchResults.length : 0,
                    );
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setSelectedHit((i) =>
                      searchResults.length
                        ? (i - 1 + searchResults.length) % searchResults.length
                        : 0,
                    );
                  } else if (e.key === "Enter" && searchResults[selectedHit]) {
                    e.preventDefault();
                    navigateToHit(searchResults[selectedHit]);
                  }
                }}
                placeholder="Search documentation, guides, or FAQs..."
                className="flex-1 bg-transparent text-sm text-white placeholder:text-zinc-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-white/[0.06] text-zinc-400 hover:text-white"
              >
                ESC
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto p-2 space-y-1">
              {searchResults.length === 0 ? (
                <p className="py-10 text-center text-xs text-zinc-500">
                  No results matching &ldquo;{query}&rdquo;
                </p>
              ) : (
                searchResults.map((hit, idx) => {
                  const active = idx === selectedHit;
                  return (
                    <button
                      key={`${hit.slug}-${hit.sectionId || "root"}-${idx}`}
                      type="button"
                      onClick={() => navigateToHit(hit)}
                      onMouseEnter={() => setSelectedHit(idx)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors cursor-pointer ${
                        active
                          ? "bg-rose-500/15 border border-rose-500/30"
                          : "border border-transparent hover:bg-white/[0.04]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-white">
                          {hit.pageTitle}
                          {hit.sectionTitle ? ` › ${hit.sectionTitle}` : ""}
                        </span>
                        <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                          {hit.categoryLabel}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 line-clamp-1 mt-0.5">
                        {hit.snippet}
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

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
