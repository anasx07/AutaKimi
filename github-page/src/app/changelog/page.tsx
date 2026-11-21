"use client";
import { useEffect, useState, type ReactNode } from 'react';
import { GlowCard } from '@/components/ui/spotlight-card';
import { History, Download, Calendar } from 'lucide-react';

interface Release {
  id: number;
  name: string;
  tag_name: string;
  published_at: string;
  html_url: string;
  body: string;
}

function renderMarkdownInline(text: string): ReactNode[] {
  // Regex matches:
  // 1. Markdown link: [text](url) -> group 2 and 3
  // 2. Inline code: `code` -> group 4
  // 3. Bold: **text** -> group 5
  // 4. Bare URL: https://... -> group 6
  // 5. GitHub mention: @user -> group 7
  const tokenRegex = /(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|(https?:\/\/[^\s<]+)|(@[a-zA-Z0-9_-]+))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const nodes: ReactNode[] = [];
  let key = 0;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    if (match[2] && match[3]) {
      // [text](url)
      nodes.push(
        <a
          key={`link-${key++}`}
          href={match[3]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-orange-400 hover:text-orange-300 hover:underline font-semibold transition-colors"
        >
          {match[2]}
        </a>
      );
    } else if (match[4]) {
      // `code`
      nodes.push(
        <code
          key={`code-${key++}`}
          className="bg-black/50 text-orange-300 font-mono text-xs px-1.5 py-0.5 rounded border border-white/10"
        >
          {match[4]}
        </code>
      );
    } else if (match[5]) {
      // **bold**
      nodes.push(
        <strong key={`bold-${key++}`} className="text-white font-bold">
          {renderMarkdownInline(match[5])}
        </strong>
      );
    } else if (match[6]) {
      // Bare URL
      const rawUrl = match[6];
      const trailMatch = rawUrl.match(/^(.*?)([.,;:!)]*)$/);
      const cleanHref = trailMatch ? trailMatch[1] : rawUrl;
      const trailing = trailMatch ? trailMatch[2] : '';

      nodes.push(
        <a
          key={`url-${key++}`}
          href={cleanHref}
          target="_blank"
          rel="noopener noreferrer"
          className="text-orange-400 hover:text-orange-300 hover:underline font-medium break-all transition-colors"
        >
          {cleanHref}
        </a>
      );
      if (trailing) {
        nodes.push(trailing);
      }
    } else if (match[7]) {
      // @mention
      const username = match[7];
      nodes.push(
        <a
          key={`mention-${key++}`}
          href={`https://github.com/${username.replace(/^@/, '')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-amber-400 hover:text-amber-300 hover:underline font-medium transition-colors"
        >
          {username}
        </a>
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
    fetch('https://api.github.com/repos/anasx07/AutaKimi/releases')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) {
          setReleases(data);
        } else {
          throw new Error('Invalid release list format');
        }
        setLoading(false);
      })
      .catch(err => {
        console.warn('Failed to fetch releases from GitHub API:', err.message || err);
        setError(err.message || 'Failed to load');
        setLoading(false);
      });
  }, []);

  return (
    <div className="w-full max-w-4xl px-6 py-12 flex flex-col items-center animate-fade-in relative z-10">
      <div className="text-center mb-16 space-y-4">
        <span className="premium-pill">Release History</span>
        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-gradient">Changelog</h1>
        <p className="text-zinc-400 text-lg max-w-lg mx-auto">Track the evolution of AutaKimi. Every feature, fix, and performance upgrade.</p>
      </div>

      <div className="w-full space-y-8">
        {loading ? (
          <div className="flex justify-center text-zinc-500 py-12 animate-pulse font-medium">Synchronizing with GitHub...</div>
        ) : error || releases.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center p-12 bg-white/[0.02] border border-white/5 rounded-[24px]">
            <p className="text-zinc-400 font-medium mb-6">Unable to retrieve release history from the GitHub API.</p>
            <a 
              href="https://github.com/anasx07/AutaKimi/releases" 
              target="_blank" 
              rel="noopener noreferrer"
              className="px-6 py-3 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 rounded-xl text-sm font-bold transition-all"
            >
              View Releases on GitHub
            </a>
          </div>
        ) : releases.map((release, i) => (
          <GlowCard key={release.id || i} customSize className="w-full p-8 md:p-10 group" glowColor="orange">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 border-b border-white/5 pb-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center text-white relative z-10">
                  <History className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-3 relative z-10 text-white">
                    {release.name || release.tag_name}
                    {i === 0 && <span className="bg-orange-500/10 text-orange-400 text-xs px-2.5 py-1 rounded-md border border-orange-500/20 uppercase tracking-widest font-black">Latest</span>}
                  </h2>
                  <div className="flex items-center gap-2 text-sm text-zinc-500 mt-1 relative z-10 font-bold">
                    <Calendar className="w-4 h-4" />
                    <span>{new Date(release.published_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                  </div>
                </div>
              </div>
              <a
                href={release.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-white text-black px-6 py-3 rounded-xl font-bold text-sm hover:bg-zinc-200 transition-transform hover:scale-105 active:scale-95 relative z-10 w-full md:w-auto shadow-lg"
              >
                <Download className="w-4 h-4" />
                Download Release
              </a>
            </div>

            {/* Release Notes Parser */}
            <div className="text-zinc-300 relative z-10 space-y-2 text-[15px] leading-relaxed font-medium">
              {release.body ? (
                release.body.split('\n').map((line, j) => {
                  const trimmed = line.trim();

                  // Blank line spacing
                  if (!trimmed) {
                    return <div key={j} className="h-1.5" />;
                  }

                  // Headers: #, ##, ###
                  if (trimmed.startsWith('#')) {
                    const level = trimmed.match(/^#+/)?.[0].length || 1;
                    const headerText = trimmed.replace(/^#+\s*/, '');
                    if (level === 1) {
                      return (
                        <h2 key={j} className="text-white font-black text-xl mt-6 mb-2 flex items-center gap-2">
                          {renderMarkdownInline(headerText)}
                        </h2>
                      );
                    }
                    if (level === 2) {
                      return (
                        <h3 key={j} className="text-white font-extrabold text-lg mt-5 mb-2">
                          {renderMarkdownInline(headerText)}
                        </h3>
                      );
                    }
                    return (
                      <h4 key={j} className="text-zinc-100 font-bold text-base mt-4 mb-1">
                        {renderMarkdownInline(headerText)}
                      </h4>
                    );
                  }

                  // Blockquotes: > ...
                  if (trimmed.startsWith('>')) {
                    const quoteText = trimmed.replace(/^>\s*/, '');
                    return (
                      <div key={j} className="border-l-2 border-orange-500/40 pl-4 py-1 text-zinc-400 italic bg-white/[0.02] rounded-r my-2">
                        {renderMarkdownInline(quoteText)}
                      </div>
                    );
                  }

                  // List items: starts with - or * or +
                  if (/^[-*+]\s+/.test(trimmed)) {
                    const itemContent = trimmed.replace(/^[-*+]\s+/, '');
                    return (
                      <div key={j} className="flex items-start gap-3 mt-1.5 pl-1">
                        <span className="text-orange-400 mt-1 select-none font-bold">•</span>
                        <div className="flex-1 leading-normal">
                          {renderMarkdownInline(itemContent)}
                        </div>
                      </div>
                    );
                  }

                  // Regular paragraph
                  return (
                    <p key={j} className="min-h-[1em] leading-normal">
                      {renderMarkdownInline(line)}
                    </p>
                  );
                })
              ) : (
                <p className="italic text-zinc-500">No release notes provided.</p>
              )}
            </div>
          </GlowCard>
        ))}
      </div>
    </div>
  );
}
