'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, Sparkles, BookOpen, History, Github, Puzzle } from 'lucide-react';
import GitHubButton from '@/components/ui/github-button';

export function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Close mobile menu on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMobileMenuOpen(false);
    };
    if (isMobileMenuOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileMenuOpen]);

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[95] md:hidden transition-opacity duration-300"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="fixed top-6 left-0 right-0 z-[100] flex flex-col items-center px-4 md:px-0 opacity-0 animate-[fadeIn_0.5s_ease_forwards]">
        <nav className="w-full max-w-5xl flex items-center justify-between px-3 py-3 bg-[#0a0a14]/60 backdrop-blur-3xl border border-white/10 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] relative group/nav transition-colors duration-500 hover:bg-[#0f0f1d]/70 hover:border-white/20">
          {/* Subtle animated internal glow */}
          <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-orange-500/10 opacity-30 group-hover/nav:opacity-60 transition-opacity duration-500"></div>
          </div>

          {/* Logo Section */}
          <Link href="/" className="relative flex items-center gap-3 cursor-pointer group ml-2 z-10 w-fit">
            <div className="relative">
              <div className="absolute inset-0 bg-white/20 rounded-lg blur-md group-hover:bg-white/40 transition-colors"></div>
              <Image src="/AutaKimi/assets/branding/icon.png" alt="AutaKimi Logo" width={32} height={32} className="relative w-8 h-8 rounded-lg shadow-xl group-hover:scale-105 transition-transform" />
            </div>
            <span className="font-bold text-xl tracking-tight text-white transition-all group-hover:tracking-wider drop-shadow-md">AutaKimi</span>
          </Link>

          {/* Centered Links (Desktop only) */}
          <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center gap-8 bg-black/30 px-8 py-2.5 rounded-2xl border border-white/5 shadow-inner z-10">
            <Link href="/#features" className="text-[13px] font-bold tracking-wide text-zinc-400 hover:text-white transition-all hover:-translate-y-0.5 uppercase relative after:absolute after:-bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-0 hover:after:w-4 after:h-[2px] after:bg-white after:rounded-full after:transition-all">Features</Link>
            <Link href="/docs" className="text-[13px] font-bold tracking-wide text-zinc-400 hover:text-white transition-all hover:-translate-y-0.5 uppercase relative after:absolute after:-bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-0 hover:after:w-4 after:h-[2px] after:bg-white after:rounded-full after:transition-all">Docs</Link>
            <Link href="/changelog" className="text-[13px] font-bold tracking-wide text-zinc-400 hover:text-white transition-all hover:-translate-y-0.5 uppercase relative after:absolute after:-bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-0 hover:after:w-4 after:h-[2px] after:bg-white after:rounded-full after:transition-all">Changelog</Link>
            <a href="https://github.com/Autakimi-Ecosystem/autakimi-extensions" target="_blank" rel="noopener noreferrer" className="text-[13px] font-bold tracking-wide text-zinc-400 hover:text-orange-400 transition-all hover:-translate-y-0.5 uppercase relative after:absolute after:-bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-0 hover:after:w-4 after:h-[2px] after:bg-orange-400 after:rounded-full after:transition-all flex items-center gap-1.5">
              <span>Extensions</span>
              <span className="text-[10px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-full font-mono lowercase">repo</span>
            </a>
          </div>

          {/* Right Action */}
          <div className="relative flex items-center gap-2 sm:gap-3 z-10">
            <Link 
              href="https://discord.gg/qRbpCusgan" 
              target="_blank"
              rel="noopener noreferrer"
              aria-label="AutaKimi Discord"
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#5865F2]/20 border border-[#5865F2]/30 text-[#5865F2] hover:bg-[#5865F2] hover:text-white transition-all duration-300"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.077 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.076.076 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
            </Link>
            <div className="hidden sm:block">
              <GitHubButton />
            </div>

            {/* Mobile Hamburger / Close Button */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={isMobileMenuOpen}
              className="flex md:hidden items-center justify-center w-10 h-10 rounded-xl bg-white/5 border border-white/10 text-zinc-300 hover:text-white hover:bg-white/10 active:scale-95 transition-all duration-200"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5 text-white" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </nav>

        {/* Mobile Dropdown Panel */}
        {isMobileMenuOpen && (
          <div className="w-full max-w-5xl mt-2 p-3 bg-[#0a0a14]/90 backdrop-blur-3xl border border-white/10 rounded-3xl shadow-[0_16px_40px_rgba(0,0,0,0.8)] flex flex-col gap-1.5 md:hidden animate-[fadeIn_0.2s_ease_forwards] z-20">
            <Link
              href="/#features"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] active:bg-white/10 border border-white/5 text-zinc-300 hover:text-white font-medium transition-all"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-white">Features</span>
                <span className="text-xs text-zinc-400">Core capabilities and tools</span>
              </div>
            </Link>

            <Link
              href="/docs"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] active:bg-white/10 border border-white/5 text-zinc-300 hover:text-white font-medium transition-all"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                <BookOpen className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-white">Documentation</span>
                <span className="text-xs text-zinc-400">Guides, shortcuts, and setup</span>
              </div>
            </Link>

            <Link
              href="/changelog"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] active:bg-white/10 border border-white/5 text-zinc-300 hover:text-white font-medium transition-all"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <History className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-white">Changelog</span>
                <span className="text-xs text-zinc-400">Latest updates and release notes</span>
              </div>
            </Link>

            <a
              href="https://github.com/Autakimi-Ecosystem/autakimi-extensions"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] active:bg-white/10 border border-white/5 text-zinc-300 hover:text-white font-medium transition-all"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400">
                <Puzzle className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">Community Extensions</span>
                  <span className="text-[10px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-full font-mono lowercase">repo</span>
                </div>
                <span className="text-xs text-zinc-400">Community scrapers, templates & sources</span>
              </div>
            </a>

            {/* Mobile GitHub link for screens where the desktop button was hidden */}
            <div className="pt-2 mt-1 border-t border-white/10 flex items-center justify-between sm:hidden px-2 py-1">
              <span className="text-xs text-zinc-400 font-medium">Open Source</span>
              <a
                href="https://github.com/anasx07/AutaKimi"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-xs font-semibold text-white transition-all"
              >
                <Github className="w-3.5 h-3.5" />
                <span>GitHub Repository</span>
              </a>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
