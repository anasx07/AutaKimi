"use client";

import { useEffect, useState, type ReactNode } from "react";
import { History, Download, Calendar, ArrowUpRight } from "lucide-react";

interface Release {
  id: number;
  name: string;
  tag_name: string;
  published_at: string;
  html_url: string;
  body: string;
}

function renderMarkdownInline(text: string): ReactNode[] {
  const tokenRegex =
    /(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|(https?:\/\/[^\s<]+)|(@[a-zA-Z0-9_-]+))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const nodes: ReactNode[] = [];
  let key = 0;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    if (match[2] && match[3]) {
      nodes.push(
        <a
          key={`link-${key++}`}
          href={match[3]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-rose-400 hover:text-rose-300 hover:underline font-medium transition-colors"
        >
          {match[2]}
        </a>,
      );
    } else if (match[4]) {
      nodes.push(
        <code
          key={`code-${key++}`}
          className="bg-zinc-950 text-zinc-200 font-mono text-xs px-1.5 py-0.5 rounded border border-white/[0.1]"
        >
          {match[4]}
        </code>,
      );
    } else if (match[5]) {
      nodes.push(
        <strong key={`bold-${key++}`} className="text-white font-semibold">
          {renderMarkdownInline(match[5])}
        </strong>,
      );
    } else if (match[6]) {
      const rawUrl = match[6];
      const trailMatch = rawUrl.match(/^(.*?)([.,;:!)]*)$/);
      const cleanHref = trailMatch ? trailMatch[1] : rawUrl;
      const trailing = trailMatch ? trailMatch[2] : "";

      nodes.push(
        <a
          key={`url-${key++}`}
          href={cleanHref}
          target="_blank"
          rel="noopener noreferrer"
          className="text-rose-400 hover:text-rose-300 hover:underline font-medium break-all transition-colors"
        >
          {cleanHref}
        </a>,
      );
      if (trailing) {
        nodes.push(trailing);
      }
    } else if (match[7]) {
      const username = match[7];
      nodes.push(
        <a
          key={`mention-${key++}`}
          href={`https://github.com/${username.replace(/^@/, "")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-zinc-200 hover:text-white underline decoration-white/30 font-medium transition-colors"
        >
          {username}
        </a>,
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

export default function ChangelogPage() {
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("https://api.github.com/repos/anasx07/AutaKimi/releases")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setReleases(data);
        } else {
          throw new Error("Invalid release list format");
        }
        setLoading(false);
      })
      .catch((err) => {
        console.warn(
          "Failed to fetch releases from GitHub API:",
          err.message || err,
        );
        setError(err.message || "Failed to load");
        setLoading(false);
      });
  }, []);

  return (
    <div className="w-full max-w-4xl px-5 pt-12 pb-24 flex flex-col relative z-10">
      <div className="mb-12 space-y-3 border-b border-white/[0.06] pb-10">
        <span className="section-kicker">Release History</span>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white font-[family-name:var(--font-outfit)]">
          Changelog
        </h1>
        <p className="text-zinc-400 text-base max-w-xl leading-relaxed">
          Every desktop and Android release shipped on GitHub—features, fixes,
          and engine updates.
        </p>
      </div>

      <div className="w-full space-y-6">
        {loading ? (
          <div className="studio-surface rounded-2xl p-10 text-center text-sm font-mono text-zinc-500">
            Synchronizing releases from GitHub...
          </div>
        ) : error || releases.length === 0 ? (
          <div className="studio-surface rounded-2xl p-10 text-center space-y-4">
            <p className="text-zinc-400 text-sm">
              Unable to retrieve release notes from GitHub right now.
            </p>
            <a
              href="https://github.com/anasx07/AutaKimi/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 text-xs font-semibold transition-colors"
            >
              <span>View Releases on GitHub</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </a>
          </div>
        ) : (
          releases.map((release, i) => (
            <article
              key={release.id || i}
              className="studio-surface rounded-2xl p-6 sm:p-8 hover:border-white/[0.14] transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-6 border-b border-white/[0.06]">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-zinc-200 shrink-0">
                    <History className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h2 className="text-xl font-semibold text-white">
                        {release.name || release.tag_name}
                      </h2>
                      {i === 0 && (
                        <span className="px-2 py-0.5 rounded-md bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[10px] font-mono uppercase tracking-wider font-semibold">
                          Latest
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-zinc-500 mt-1 font-mono">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>
                        {new Date(release.published_at).toLocaleDateString(
                          undefined,
                          {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          },
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                <a
                  href={release.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 font-semibold text-xs transition-colors shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>View Assets</span>
                </a>
              </div>

              <div className="text-zinc-300 space-y-2 text-sm leading-relaxed">
                {release.body ? (
                  release.body.split("\n").map((line, j) => {
                    const trimmed = line.trim();
                    if (!trimmed) {
                      return <div key={j} className="h-1" />;
                    }

                    if (trimmed.startsWith("#")) {
                      const level = trimmed.match(/^#+/)?.[0].length || 1;
                      const headerText = trimmed.replace(/^#+\s*/, "");
                      if (level === 1) {
                        return (
                          <h3
                            key={j}
                            className="text-white font-semibold text-base pt-3 pb-1"
                          >
                            {renderMarkdownInline(headerText)}
                          </h3>
                        );
                      }
                      if (level === 2) {
                        return (
                          <h4
                            key={j}
                            className="text-zinc-100 font-semibold text-sm pt-2.5 pb-0.5"
                          >
                            {renderMarkdownInline(headerText)}
                          </h4>
                        );
                      }
                      return (
                        <h5
                          key={j}
                          className="text-zinc-200 font-medium text-sm pt-2"
                        >
                          {renderMarkdownInline(headerText)}
                        </h5>
                      );
                    }

                    if (trimmed.startsWith(">")) {
                      const quoteText = trimmed.replace(/^>\s*/, "");
                      return (
                        <div
                          key={j}
                          className="border-l-2 border-rose-500/40 pl-3.5 py-1 text-zinc-400 italic bg-white/[0.02] rounded-r my-1.5"
                        >
                          {renderMarkdownInline(quoteText)}
                        </div>
                      );
                    }

                    if (/^[-*+]\s+/.test(trimmed)) {
                      const itemContent = trimmed.replace(/^[-*+]\s+/, "");
                      return (
                        <div key={j} className="flex items-start gap-2.5 pl-1">
                          <span className="text-rose-400 mt-0.5 select-none">
                            •
                          </span>
                          <div className="flex-1 text-zinc-300">
                            {renderMarkdownInline(itemContent)}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <p key={j} className="text-zinc-300">
                        {renderMarkdownInline(line)}
                      </p>
                    );
                  })
                ) : (
                  <p className="italic text-zinc-500">
                    No release notes provided.
                  </p>
                )}
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
