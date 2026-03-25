import dabiImg from '../../app/assets/ThemeCharacter/dabi-from-my-hero-academia_1280x720_xtrafondos.com.jpg'
import itachiImg from '../../app/assets/ThemeCharacter/itachi-uchiha-naruto_1280x720_xtrafondos.com.jpg'
import gokuImg from '../../app/assets/ThemeCharacter/goku-super-saiyan-ultra-instinct-dragon-ball-super_1280x720_xtrafondos.com.jpg'
import allMightImg from '../../app/assets/ThemeCharacter/all-might-from-my-hero-academia_1280x720_xtrafondos.com.jpg'
import gojoImg from '../../app/assets/ThemeCharacter/satoru-gojo-from-jujutsu-kaisen_1280x720_xtrafondos.com.jpg'
import jinwooImg from '../../app/assets/ThemeCharacter/sung-jinwoo-solo-leveling-hd-160@5@d_1280x720.jpg'
import nanamiImg from '../../app/assets/ThemeCharacter/kento-nanami-jjk-hd-349@5@m_1280x720.jpg'
import slayerImg from '../../app/assets/ThemeCharacter/tanjiro-nezuko-1920x1080-20184_1280x720.jpg'
import zoroImg from '../../app/assets/ThemeCharacter/roronoa-zoro-green-1920x1080-18358_1280x720.jpg'
import narutoImg from '../../app/assets/ThemeCharacter/golden-naruto-1920x1080-18706_1280x720.jpg'

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
  },
  { 
    id: 'dark-sung-jinwoo', 
    name: 'Solo Leveling', 
    desc: 'Sung Jinwoo: Shadow Monarch', 
    theme: 'dark', 
    colorTheme: 'sung-jinwoo', 
    bgImage: jinwooImg, 
    tag: 'Arisen', 
    bgClass: 'text-white border-indigo-900/50 shadow-md', 
    boxClass: 'bg-slate-950/40 border-indigo-500/30', 
    dotClass: 'bg-violet-500', 
    descClass: 'text-indigo-200 font-medium' 
  },
  { 
    id: 'dark-nanami', 
    name: 'Kento Nanami', 
    desc: '7:3 Ratio Point', 
    theme: 'dark', 
    colorTheme: 'nanami', 
    bgImage: nanamiImg, 
    tag: 'Overtime', 
    bgClass: 'text-white border-amber-900/50 shadow-md', 
    boxClass: 'bg-amber-950/40 border-amber-500/30', 
    dotClass: 'bg-amber-400', 
    descClass: 'text-amber-100 font-medium' 
  },
  { 
    id: 'dark-slayer', 
    name: 'Demon Slayer', 
    desc: 'Tanjiro & Nezuko: Bond', 
    theme: 'dark', 
    colorTheme: 'slayer', 
    bgImage: slayerImg, 
    tag: 'Flowing', 
    bgClass: 'text-white border-blue-900/50 shadow-md', 
    boxClass: 'bg-blue-950/40 border-blue-500/30', 
    dotClass: 'bg-cyan-400', 
    descClass: 'text-cyan-100 font-medium' 
  },
  { 
    id: 'dark-zoro', 
    name: 'Roronoa Zoro', 
    desc: 'Three-Sword Style', 
    theme: 'dark', 
    colorTheme: 'zoro', 
    bgImage: zoroImg, 
    tag: 'Santoryu', 
    bgClass: 'text-white border-emerald-900/50 shadow-md', 
    boxClass: 'bg-emerald-950/40 border-emerald-500/30', 
    dotClass: 'bg-emerald-400', 
    descClass: 'text-emerald-100 font-medium' 
  },
  { 
    id: 'light-naruto', 
    name: 'Golden Naruto', 
    desc: 'Six Paths Sage Mode', 
    theme: 'light', 
    colorTheme: 'naruto', 
    bgImage: narutoImg, 
    tag: 'Tailed', 
    bgClass: 'text-zinc-900 border-amber-200/50 shadow-md', 
    boxClass: 'bg-white/80 border-amber-200/50', 
    dotClass: 'bg-amber-500', 
    descClass: 'text-zinc-700 font-medium' 
  }
]
