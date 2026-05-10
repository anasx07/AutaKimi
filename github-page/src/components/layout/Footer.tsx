export function Footer() {
  return (
    <footer className="py-12 flex flex-col items-center gap-4 mt-auto border-t border-white/5 bg-black/20 backdrop-blur-md">
      <div className="flex items-center gap-6">
        <a 
          href="https://discord.gg/qRbpCusgan" 
          target="_blank" 
          className="text-zinc-500 hover:text-[#5865F2] transition-colors text-sm font-bold uppercase tracking-widest"
        >
          Discord Community
        </a>
        <a 
          href="https://github.com/anasx07/AutaKimi" 
          target="_blank" 
          className="text-zinc-500 hover:text-white transition-colors text-sm font-bold uppercase tracking-widest"
        >
          GitHub Repo
        </a>
      </div>
      <p className="text-zinc-600 text-xs font-medium">
        © {new Date().getFullYear()} AutaKimi. Built with passion for Anime & Manga Community.
      </p>
    </footer>
  );
}
