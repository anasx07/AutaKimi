import Link from "next/link";

export function Footer() {
  return (
    <footer className="w-full border-t border-white/[0.06] bg-[#09090b]">
      <div className="max-w-6xl mx-auto px-5 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">AutaKimi</span>
            <span className="text-[11px] font-mono text-zinc-500 border border-white/[0.08] rounded px-1.5 py-0.5">
              GPL-3.0
            </span>
          </div>
          <p className="text-xs text-zinc-500">
            © {new Date().getFullYear()} AutaKimi. Neutral cross-platform media
            reader — no hosted content, zero telemetry.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-5 text-xs font-medium text-zinc-400">
          <Link href="/docs" className="hover:text-white transition-colors">
            Documentation
          </Link>
          <Link
            href="/changelog"
            className="hover:text-white transition-colors"
          >
            Changelog
          </Link>
          <a
            href="https://github.com/Autakimi-Ecosystem/autakimi-extensions"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors"
          >
            Extensions
          </a>
          <a
            href="https://github.com/anasx07/AutaKimi"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors"
          >
            GitHub
          </a>
          <a
            href="https://discord.gg/qRbpCusgan"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors"
          >
            Discord
          </a>
        </div>
      </div>
    </footer>
  );
}
