'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, BookOpen, History, Search, Puzzle, Settings, 
  X, ChevronRight, Download, Check, Globe, Maximize2, 
  Plus, Monitor, Info, ExternalLink, HelpCircle
} from 'lucide-react';

interface MockItem {
  id: string;
  title: string;
  type: 'manga' | 'anime';
  gradient: string;
  status: string;
  chapter: string;
  source: string;
  synopsis: string;
}

const MOCK_ITEMS: MockItem[] = [
  {
    id: 'solo-leveling',
    title: 'Solo Leveling',
    type: 'manga',
    gradient: 'from-blue-600 via-indigo-700 to-purple-800',
    status: 'Reading',
    chapter: 'Ch. 179 / 179',
    source: 'MangaDex',
    synopsis: 'In a world where hunters must battle deadly monsters to protect mankind, Sung Jinwoo, the weakest hunter, finds himself in a struggle for survival in a double dungeon.'
  },
  {
    id: 'one-piece',
    title: 'One Piece',
    type: 'manga',
    gradient: 'from-amber-500 via-orange-600 to-red-700',
    status: 'Reading',
    chapter: 'Ch. 1110 / 1115',
    source: 'MangaDex',
    synopsis: 'Monkey D. Luffy refuses to let anyone or anything stand in the way of his quest to become king of all pirates. With a course charted for the treacherous waters of the Grand Line, this is one captain who will never give up.'
  },
  {
    id: 'frieren',
    title: 'Frieren: Beyond Journey\'s End',
    type: 'manga',
    gradient: 'from-emerald-500 via-teal-600 to-cyan-700',
    status: 'Reading',
    chapter: 'Ch. 127 / 130',
    source: 'MangaDex',
    synopsis: 'Elf mage Frieren and her courageous fellow adventurers have defeated the Demon King and brought peace to the land. But Frieren will long outlive the rest of her former party. How will she understand what life means to the humans around her?'
  },
  {
    id: 'demon-slayer',
    title: 'Demon Slayer',
    type: 'anime',
    gradient: 'from-red-600 via-rose-700 to-purple-900',
    status: 'Watching',
    chapter: 'Ep. 11 / 11',
    source: 'Gogoanime',
    synopsis: 'Tanjirou Kamado lives a peaceful life with his family, until demons slaughter his family and turn his sister Nezuko into a demon. Tanjirou sets out to become a demon slayer to avenge his family and cure his sister.'
  },
  {
    id: 'cyberpunk',
    title: 'Cyberpunk: Edgerunners',
    type: 'anime',
    gradient: 'from-yellow-400 via-amber-500 to-red-600',
    status: 'Completed',
    chapter: 'Ep. 10 / 10',
    source: 'Gogoanime',
    synopsis: 'A street kid trying to survive in a technology and body modification-obsessed city of the future. Having everything to lose, he chooses to stay alive by becoming an edgerunner.'
  },
  {
    id: 'chainsaw-man',
    title: 'Chainsaw Man',
    type: 'manga',
    gradient: 'from-orange-500 via-red-500 to-yellow-600',
    status: 'Plan to Read',
    chapter: 'Ch. 1 / 150',
    source: 'MangaDex',
    synopsis: 'Denji is a teenage boy living with a Chainsaw Devil named Pochita. Due to the debt his father left behind, he has been living a rock-bottom life while repaying his debt by harvesting devil corpses.'
  }
];

const MOCK_EXTENSIONS = [
  { pkg: 'en.mangadex', name: 'MangaDex', type: 'manga', lang: 'EN', installed: true, version: '1.4.2' },
  { pkg: 'en.gogoanime', name: 'Gogoanime', type: 'anime', lang: 'EN', installed: true, version: '2.0.5' },
  { pkg: 'ar.anime4up', name: 'Anime4Up', type: 'anime', lang: 'AR', installed: false, version: '1.2.0' },
  { pkg: 'en.allanime', name: 'AllAnime', type: 'anime', lang: 'EN', installed: false, version: '1.1.8' },
  { pkg: 'en.mangastream', name: 'MangaStream', type: 'manga', lang: 'EN', installed: false, version: '1.0.1' },
];

export default function AppSimulator() {
  const [activeTab, setActiveTab] = useState<'library' | 'browse' | 'extensions' | 'history'>('library');
  const [selectedItem, setSelectedItem] = useState<MockItem | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [extensions, setExtensions] = useState(MOCK_EXTENSIONS);
  const [installingPkg, setInstallingPkg] = useState<string | null>(null);

  const handleInstallExt = (pkg: string) => {
    setInstallingPkg(pkg);
    setTimeout(() => {
      setExtensions(prev => 
        prev.map(ext => ext.pkg === pkg ? { ...ext, installed: true } : ext)
      );
      setInstallingPkg(null);
    }, 1500);
  };

  const filteredItems = MOCK_ITEMS.filter(item => 
    item.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full max-w-5xl mx-auto px-4 md:px-0">
      {/* Container simulating a desktop application window */}
      <div className="relative rounded-3xl overflow-hidden mock-app-glass border border-white/10 shadow-[0_32px_64px_rgba(0,0,0,0.7)] flex flex-col md:flex-row h-[620px] w-full text-zinc-300 font-sans">
        
        {/* Decorative Internal Glow Accent */}
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-orange-500/50 to-amber-500/50 pointer-events-none z-30" />
        
        {/* SIDEBAR */}
        <div className="w-full md:w-60 bg-[#07070f]/90 border-b md:border-b-0 md:border-r border-white/5 p-4 flex flex-col justify-between flex-shrink-0">
          <div>
            {/* Top Windows Action mock */}
            <div className="flex items-center gap-2 mb-6 ml-1">
              <div className="w-3 h-3 rounded-full bg-red-500/80" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
              <div className="w-3 h-3 rounded-full bg-green-500/80" />
              <span className="text-[10px] text-zinc-500 font-mono tracking-wider uppercase ml-2">AutaKimi Live Simulator</span>
            </div>

            {/* Navigation Tabs */}
            <div className="space-y-1.5">
              <button 
                onClick={() => { setActiveTab('library'); setSelectedItem(null); setIsReading(false); setIsPlaying(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${activeTab === 'library' ? 'bg-primary/20 text-white border border-primary/20 shadow-md shadow-primary/5' : 'hover:bg-white/5 text-zinc-400 hover:text-zinc-200'}`}
              >
                <BookOpen className={`w-4 h-4 ${activeTab === 'library' ? 'text-primary-light' : ''}`} />
                <span>My Library</span>
                <span className="ml-auto text-[10px] bg-white/5 px-2 py-0.5 rounded-full text-zinc-400">6</span>
              </button>

              <button 
                onClick={() => { setActiveTab('browse'); setSelectedItem(null); setIsReading(false); setIsPlaying(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${activeTab === 'browse' ? 'bg-primary/20 text-white border border-primary/20 shadow-md shadow-primary/5' : 'hover:bg-white/5 text-zinc-400 hover:text-zinc-200'}`}
              >
                <Search className={`w-4 h-4 ${activeTab === 'browse' ? 'text-primary-light' : ''}`} />
                <span>Discover</span>
              </button>

              <button 
                onClick={() => { setActiveTab('extensions'); setSelectedItem(null); setIsReading(false); setIsPlaying(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${activeTab === 'extensions' ? 'bg-primary/20 text-white border border-primary/20 shadow-md shadow-primary/5' : 'hover:bg-white/5 text-zinc-400 hover:text-zinc-200'}`}
              >
                <Puzzle className={`w-4 h-4 ${activeTab === 'extensions' ? 'text-primary-light' : ''}`} />
                <span>Extensions</span>
                <span className="ml-auto text-[10px] bg-white/5 px-2 py-0.5 rounded-full text-zinc-400">
                  {extensions.filter(e => e.installed).length}
                </span>
              </button>

              <button 
                onClick={() => { setActiveTab('history'); setSelectedItem(null); setIsReading(false); setIsPlaying(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${activeTab === 'history' ? 'bg-primary/20 text-white border border-primary/20 shadow-md shadow-primary/5' : 'hover:bg-white/5 text-zinc-400 hover:text-zinc-200'}`}
              >
                <History className={`w-4 h-4 ${activeTab === 'history' ? 'text-primary-light' : ''}`} />
                <span>History</span>
              </button>
            </div>
          </div>

          {/* User info Mock */}
          <div className="mt-auto hidden md:flex items-center gap-3 bg-white/[0.02] border border-white/5 rounded-2xl p-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-orange-500 to-amber-600 flex items-center justify-center font-bold text-xs text-white">AK</div>
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-bold text-white truncate">Guest User</p>
              <p className="text-[9px] text-zinc-500 truncate">AutaKimi Web Preview</p>
            </div>
          </div>
        </div>

        {/* MAIN PANEL CONTENT */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#0d0d18]/50 relative">
          
          {/* Top Navbar */}
          <div className="h-14 border-b border-white/5 px-6 flex items-center justify-between">
            <h2 className="font-bold text-sm text-white capitalize">{activeTab}</h2>
            {activeTab === 'library' && (
              <div className="flex items-center gap-2 bg-white/5 border border-white/5 px-3 py-1.5 rounded-xl w-60">
                <Search className="w-3.5 h-3.5 text-zinc-500" />
                <input 
                  type="text" 
                  placeholder="Search your library..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent border-none outline-none text-xs text-white placeholder-zinc-500 w-full"
                />
              </div>
            )}
          </div>

          {/* TAB CONTENTS */}
          <div className="flex-1 overflow-y-auto p-6 relative">
            <AnimatePresence mode="wait">
              {activeTab === 'library' && (
                <motion.div 
                  key="library"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="grid grid-cols-2 sm:grid-cols-3 gap-4"
                >
                  {filteredItems.map(item => (
                    <motion.div 
                      key={item.id}
                      onClick={() => setSelectedItem(item)}
                      className="group bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 rounded-2xl p-3 cursor-pointer transition-all duration-300 hover:border-white/10"
                      whileHover={{ scale: 1.02 }}
                    >
                      <div className={`aspect-[4/5] rounded-xl bg-gradient-to-br ${item.gradient} flex flex-col justify-between p-3 relative overflow-hidden shadow-lg mb-3`}>
                        {/* Shimmer/Reflection mock */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent pointer-events-none" />
                        
                        {/* Type pill */}
                        <span className="self-end text-[9px] uppercase tracking-widest font-black bg-black/40 px-2 py-0.5 rounded-full border border-white/10 text-white backdrop-blur-md">
                          {item.type}
                        </span>

                        {/* Title inside card */}
                        <span className="text-sm font-bold text-white leading-tight drop-shadow-md">{item.title}</span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-xs font-bold text-white truncate max-w-[120px]">{item.title}</h4>
                          <p className="text-[10px] text-zinc-500 mt-0.5">{item.chapter}</p>
                        </div>
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-semibold border border-zinc-700/50">
                          {item.source}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}

              {activeTab === 'browse' && (
                <motion.div 
                  key="browse"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  <div className="glass-card bg-orange-950/10 border-orange-500/20 rounded-2xl p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary-light">
                      <Globe className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-white">Global Integration</h3>
                      <p className="text-xs text-zinc-400 mt-0.5">Scrape content from multiple communities natively. Install scrapers in the Extensions tab.</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 px-1 mb-2">Available Active Extensions</h3>
                    {extensions.map(ext => (
                      <div key={ext.pkg} className="flex items-center justify-between bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white font-bold text-xs uppercase">
                            {ext.lang}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-white">{ext.name}</span>
                              <span className="text-[9px] bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-500 font-mono">v{ext.version}</span>
                            </div>
                            <span className="text-[10px] text-zinc-500 capitalize">{ext.type} Provider</span>
                          </div>
                        </div>
                        
                        {ext.installed ? (
                          <button 
                            onClick={() => {
                              setActiveTab('library');
                              setSearchQuery('');
                            }}
                            className="bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-all flex items-center gap-1.5"
                          >
                            <Check className="w-3.5 h-3.5 text-green-400" />
                            <span>Browse Source</span>
                          </button>
                        ) : (
                          <button 
                            disabled
                            className="bg-zinc-800 text-zinc-500 px-3 py-1.5 rounded-xl text-xs font-bold border border-zinc-700/30"
                          >
                            Install Extension First
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {activeTab === 'extensions' && (
                <motion.div 
                  key="extensions"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-3"
                >
                  <div className="flex items-center justify-between mb-4">
                    <Typography variant="small" className="text-zinc-500 font-bold uppercase tracking-wider">
                      Extension Manager
                    </Typography>
                    <span className="text-xs text-primary-light font-bold">Community Repos Active</span>
                  </div>

                  {extensions.map(ext => (
                    <div key={ext.pkg} className="flex items-center justify-between bg-white/[0.02] border border-white/5 rounded-2xl p-4 hover:border-white/10 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center font-bold text-white text-xs">
                          {ext.name[0]}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-white">{ext.name}</span>
                            <span className="text-[9px] uppercase tracking-wider bg-orange-500/20 text-orange-300 px-1.5 py-0.5 rounded font-black">{ext.type}</span>
                          </div>
                          <p className="text-[10px] text-zinc-500 mt-0.5">Package ID: {ext.pkg} · Lang: {ext.lang}</p>
                        </div>
                      </div>

                      {ext.installed ? (
                        <span className="bg-green-500/10 border border-green-500/20 text-green-400 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5" />
                          Installed
                        </span>
                      ) : (
                        <button
                          onClick={() => handleInstallExt(ext.pkg)}
                          disabled={installingPkg !== null}
                          className="bg-primary hover:bg-primary-light text-white px-4 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-primary/20 flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {installingPkg === ext.pkg ? (
                            <>
                              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              Installing...
                            </>
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5" />
                              Install
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  ))}
                </motion.div>
              )}

              {activeTab === 'history' && (
                <motion.div 
                  key="history"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-3"
                >
                  <div className="flex items-center justify-between text-zinc-500 uppercase font-bold tracking-wider text-[11px] mb-2 px-1">
                    <span>Recently Read/Watched</span>
                    <span>Action</span>
                  </div>

                  {MOCK_ITEMS.slice(0, 3).map(item => (
                    <div key={item.id} className="flex items-center justify-between bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg bg-gradient-to-tr ${item.gradient} flex-shrink-0`} />
                        <div>
                          <span className="font-bold text-sm text-white">{item.title}</span>
                          <p className="text-[10px] text-zinc-500 mt-0.5">Progressed to {item.chapter} · Source: {item.source}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setSelectedItem(item)}
                        className="bg-white/5 hover:bg-white/10 text-white border border-white/10 px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                      >
                        <span>Resume</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* DETAILS OVERLAY MODAL */}
        <AnimatePresence>
          {selectedItem && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#05050a]/95 z-40 p-6 flex flex-col md:flex-row gap-6"
            >
              {/* Left Column - Big Cover Card */}
              <div className="w-full md:w-56 flex flex-col">
                <div className={`w-full aspect-[3/4] rounded-2xl bg-gradient-to-br ${selectedItem.gradient} flex flex-col justify-end p-4 relative overflow-hidden shadow-2xl`}>
                  <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent pointer-events-none" />
                  <span className="text-xl font-black text-white leading-tight drop-shadow-lg">{selectedItem.title}</span>
                </div>
                
                {/* Play/Read Mock Trigger Button */}
                <button 
                  onClick={() => {
                    if (selectedItem.type === 'anime') {
                      setIsPlaying(true);
                    } else {
                      setIsReading(true);
                    }
                  }}
                  className="w-full bg-primary hover:bg-primary-light text-white font-bold text-sm py-3 rounded-2xl mt-4 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                >
                  {selectedItem.type === 'anime' ? (
                    <>
                      <Play className="w-4 h-4 fill-white" />
                      <span>Watch Episode 11</span>
                    </>
                  ) : (
                    <>
                      <BookOpen className="w-4 h-4" />
                      <span>Read Chapter 179</span>
                    </>
                  )}
                </button>
              </div>

              {/* Right Column - Info */}
              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] uppercase font-black tracking-widest bg-white/5 border border-white/10 px-2 py-0.5 rounded-full text-zinc-400">
                          {selectedItem.type}
                        </span>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full">
                          {selectedItem.source}
                        </span>
                      </div>
                      <h3 className="text-2xl font-black text-white">{selectedItem.title}</h3>
                    </div>
                    <button 
                      onClick={() => { setSelectedItem(null); setIsPlaying(false); setIsReading(false); }}
                      className="p-2 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white rounded-xl transition-all"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="mt-4 space-y-4">
                    <div>
                      <h4 className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-1">Synopsis</h4>
                      <p className="text-xs text-zinc-400 leading-relaxed max-w-lg">{selectedItem.synopsis}</p>
                    </div>

                    <div>
                      <h4 className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-2">Contents list</h4>
                      <div className="grid grid-cols-2 gap-2 max-w-lg">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <div key={i} className="flex items-center justify-between bg-white/[0.02] border border-white/5 rounded-xl px-3 py-2 text-xs">
                            <span className="font-semibold text-zinc-300">
                              {selectedItem.type === 'anime' ? `Episode ${11 - i}` : `Chapter ${179 - i}`}
                            </span>
                            <span className="text-[9px] text-zinc-500">12 days ago</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-6 border-t border-white/5">
                  <div className="text-xs text-zinc-500">
                    Currently previewing media. Install installer to run offline cache.
                  </div>
                </div>
              </div>

              {/* SUB-MODAL: MOCK PLAYER/READER IN ACTION */}
              <AnimatePresence>
                {isPlaying && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="absolute inset-0 bg-black z-50 flex flex-col justify-between p-6"
                  >
                    <div className="flex justify-between items-center z-10">
                      <div>
                        <h4 className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest">{selectedItem.title}</h4>
                        <h3 className="text-lg font-black text-white">Episode 11 - Premium Video Feed</h3>
                      </div>
                      <button 
                        onClick={() => setIsPlaying(false)}
                        className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Simulating Video Canvas */}
                    <div className="flex-1 flex flex-col items-center justify-center relative rounded-2xl bg-zinc-950 overflow-hidden my-4 border border-white/5 shadow-inner">
                      {/* Abstract anime grid simulator */}
                      <div className="absolute inset-0 tech-grid opacity-10" />
                      <div className="absolute inset-0 bg-radial-gradient(ellipse at center, rgba(249,115,22,0.1) 0%, transparent 80%)" />
                      
                      <div className="text-center z-10 space-y-4">
                        <div className="w-20 h-20 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-primary-light animate-pulse mx-auto">
                          <Play className="w-8 h-8 fill-primary-light" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-white text-sm font-bold">Simulating video buffer stream...</p>
                          <p className="text-zinc-500 text-xs">Connecting scraper endpoints natively via Node runtime.</p>
                        </div>
                      </div>

                      {/* Controls mockup */}
                      <div className="absolute bottom-4 left-4 right-4 bg-black/60 backdrop-blur-md rounded-xl p-3 flex items-center gap-4 border border-white/5">
                        <Play className="w-4 h-4 fill-white text-white" />
                        <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
                          <div className="w-1/3 h-full bg-primary" />
                        </div>
                        <span className="text-[10px] text-zinc-400 font-mono">02:14 / 24:00</span>
                      </div>
                    </div>

                    <div className="text-[10px] text-zinc-500 text-center">
                      AutaKimi desktop embeds high-performance media feeds from local packages with bypass options.
                    </div>
                  </motion.div>
                )}

                {isReading && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="absolute inset-0 bg-[#09090e] z-50 flex flex-col justify-between p-6 overflow-y-auto"
                  >
                    <div className="flex justify-between items-center mb-6">
                      <div>
                        <h4 className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest">{selectedItem.title}</h4>
                        <h3 className="text-lg font-black text-white">Chapter 179 - Reader Simulator</h3>
                      </div>
                      <button 
                        onClick={() => setIsReading(false)}
                        className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Simulating Page blocks */}
                    <div className="flex-1 max-w-xl mx-auto space-y-4 w-full">
                      {Array.from({ length: 3 }).map((_, idx) => (
                        <div key={idx} className="aspect-[3/4] bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-2xl border border-white/5 p-6 flex flex-col justify-between shadow-lg relative overflow-hidden">
                          <span className="text-[10px] text-zinc-600 font-mono">PAGE {idx + 1}</span>
                          <div className="text-center space-y-2">
                            <BookOpen className="w-8 h-8 text-zinc-700 mx-auto" />
                            <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Illustration Panel Simulator</p>
                            <p className="text-[10px] text-zinc-600 max-w-xs mx-auto">Natively decoded pages renders instantly under the AutaKimi core reader engine.</p>
                          </div>
                          <span className="text-[10px] text-zinc-600 font-mono text-right">AUTAKIMI FRAMEWORK</span>
                        </div>
                      ))}
                    </div>

                    <div className="text-[10px] text-zinc-500 text-center mt-6">
                      AutaKimi features an advanced multi-mode vertical webtoon reader optimized for performance.
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Typography({ children, variant, className }: any) {
  if (variant === 'small') {
    return <span className={`text-xs ${className}`}>{children}</span>;
  }
  return <p className={className}>{children}</p>;
}
