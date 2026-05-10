import Image from 'next/image';
import Link from 'next/link';
import GitHubButton from '@/components/ui/github-button';

export function Navbar() {
  return (
    <div className="fixed top-6 left-0 right-0 z-[100] flex justify-center px-4 md:px-0 opacity-0 animate-[fadeIn_0.5s_ease_forwards]">
      <nav className="w-full max-w-5xl flex items-center justify-between px-3 py-3 bg-[#0a0a14]/60 backdrop-blur-3xl border border-white/10 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] relative group/nav transition-colors duration-500 hover:bg-[#0f0f1d]/70 hover:border-white/20">
        {/* Subtle animated internal glow */}
        <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-purple-500/10 opacity-30 group-hover/nav:opacity-60 transition-opacity duration-500"></div>
        </div>

        {/* Logo Section */}
        <Link href="/" className="relative flex items-center gap-3 cursor-pointer group ml-2 z-10 w-fit">
          <div className="relative">
            <div className="absolute inset-0 bg-white/20 rounded-lg blur-md group-hover:bg-white/40 transition-colors"></div>
            <Image src="/AutaKimi/assets/icon.png" alt="AutaKimi Logo" width={32} height={32} className="relative w-8 h-8 rounded-lg shadow-xl group-hover:scale-105 transition-transform" />
          </div>
          <span className="font-bold text-xl tracking-tight text-white transition-all group-hover:tracking-wider drop-shadow-md">AutaKimi</span>
        </Link>

        {/* Centered Links (Desktop only) */}
        <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center gap-10 bg-black/30 px-8 py-2.5 rounded-2xl border border-white/5 shadow-inner z-10">
          <Link href="/#features" className="text-[13px] font-bold tracking-wide text-zinc-400 hover:text-white transition-all hover:-translate-y-0.5 uppercase relative after:absolute after:-bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-0 hover:after:w-4 after:h-[2px] after:bg-white after:rounded-full after:transition-all">Features</Link>
          <Link href="/docs" className="text-[13px] font-bold tracking-wide text-zinc-400 hover:text-white transition-all hover:-translate-y-0.5 uppercase relative after:absolute after:-bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-0 hover:after:w-4 after:h-[2px] after:bg-white after:rounded-full after:transition-all">Docs</Link>
          <Link href="/changelog" className="text-[13px] font-bold tracking-wide text-zinc-400 hover:text-white transition-all hover:-translate-y-0.5 uppercase relative after:absolute after:-bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-0 hover:after:w-4 after:h-[2px] after:bg-white after:rounded-full after:transition-all">Changelog</Link>
        </div>

        {/* Right Action */}
        <div className="relative flex items-center gap-3 z-10">
          <Link 
            href="https://discord.gg/qRbpCusgan" 
            target="_blank"
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#5865F2]/20 border border-[#5865F2]/30 text-[#5865F2] hover:bg-[#5865F2] hover:text-white transition-all duration-300"
          >
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.077 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.076.076 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
          </Link>
          <GitHubButton />
        </div>
      </nav>
    </div>
  );
}
