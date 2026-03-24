import dabiImg from '../../app/assets/ThemeCharacter/dabi-from-my-hero-academia_1280x720_xtrafondos.com.jpg'
import itachiImg from '../../app/assets/ThemeCharacter/itachi-uchiha-naruto_1280x720_xtrafondos.com.jpg'
import gokuImg from '../../app/assets/ThemeCharacter/goku-super-saiyan-ultra-instinct-dragon-ball-super_1280x720_xtrafondos.com.jpg'
import allMightImg from '../../app/assets/ThemeCharacter/all-might-from-my-hero-academia_1280x720_xtrafondos.com.jpg'
import gojoImg from '../../app/assets/ThemeCharacter/satoru-gojo-from-jujutsu-kaisen_1280x720_xtrafondos.com.jpg'

export interface ThemeOption {
  id: string
  name: string
  desc: string
  theme: 'light' | 'dark' | 'system'
  colorTheme: string
  bgImage?: string
  tag?: string
  bgClass?: string
  borderClass?: string
  boxClass?: string
  dotClass: string
  descClass: string
}

export const DEFAULT_THEMES: ThemeOption[] = [
  { 
    id: 'dark-default', 
    name: 'Dark Default', 
    desc: 'Obsidian Purple', 
    theme: 'dark', 
    colorTheme: 'default', 
    bgClass: 'bg-zinc-950 text-zinc-100', 
    borderClass: 'border-zinc-800', 
    boxClass: 'bg-zinc-900 border-zinc-800', 
    dotClass: 'bg-purple-500', 
    descClass: 'text-zinc-400' 
  },
  { 
    id: 'light-default', 
    name: 'Light Default', 
    desc: 'Clean Purple', 
    theme: 'light', 
    colorTheme: 'default', 
    bgClass: 'bg-white text-zinc-900', 
    borderClass: 'border-zinc-200', 
    boxClass: 'bg-zinc-100 border-zinc-200', 
    dotClass: 'bg-purple-500', 
    descClass: 'text-zinc-500' 
  }
]

export const PREMIUM_THEMES: ThemeOption[] = [
  { 
    id: 'light-allmight', 
    name: 'All Might', 
    desc: 'Symbol of Peace', 
    theme: 'light', 
    colorTheme: 'all-might', 
    bgImage: allMightImg, 
    tag: 'Sunset', 
    bgClass: 'text-zinc-900 border-amber-200/50 shadow-md', 
    boxClass: 'bg-white/80 border-amber-200/50', 
    dotClass: 'bg-amber-500', 
    descClass: 'text-zinc-700 font-medium' 
  },
  { 
    id: 'light-goku', 
    name: 'Goku UI', 
    desc: 'Ultra Instinct', 
    theme: 'light', 
    colorTheme: 'goku', 
    bgImage: gokuImg, 
    tag: 'Light', 
    bgClass: 'text-zinc-900 border-blue-200/50 shadow-md', 
    boxClass: 'bg-white/80 border-blue-200/50', 
    dotClass: 'bg-blue-500', 
    descClass: 'text-zinc-700 font-medium' 
  },
  { 
    id: 'dark-itachi', 
    name: 'Itachi Theme', 
    desc: 'Tsukuyomi', 
    theme: 'dark', 
    colorTheme: 'itachi', 
    bgImage: itachiImg, 
    tag: 'Dark', 
    bgClass: 'text-white border-purple-900/50 shadow-md', 
    boxClass: 'bg-purple-950/40 border-purple-500/30', 
    dotClass: 'bg-red-500', 
    descClass: 'text-neutral-300 font-medium' 
  },
  { 
    id: 'dark-dabi', 
    name: 'Dabi Theme', 
    desc: 'Crimson Flames', 
    theme: 'dark', 
    colorTheme: 'dabi', 
    bgImage: dabiImg, 
    tag: 'Dark', 
    bgClass: 'text-white border-red-900/50 shadow-md', 
    boxClass: 'bg-red-950/40 border-red-500/30', 
    dotClass: 'bg-red-500', 
    descClass: 'text-neutral-300 font-medium' 
  },
  { 
    id: 'dark-gojo', 
    name: 'Gojo Satoru', 
    desc: 'Six Eyes & Limitless', 
    theme: 'dark', 
    colorTheme: 'gojo', 
    bgImage: gojoImg, 
    tag: 'Void', 
    bgClass: 'text-white border-blue-900/50 shadow-md', 
    boxClass: 'bg-indigo-950/40 border-indigo-500/30', 
    dotClass: 'bg-blue-400', 
    descClass: 'text-neutral-300 font-medium' 
  }
]
