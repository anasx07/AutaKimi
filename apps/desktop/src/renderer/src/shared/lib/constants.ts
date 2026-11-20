export const LANGUAGE_NAMES: Record<string, string> = {
  all: 'Global',
  ar: 'العربية',
  bg: 'Български',
  ca: 'Català',
  cs: 'Čeština',
  de: 'Deutsch',
  en: 'English',
  es: 'Español',
  fr: 'Français',
  id: 'Bahasa Indonesia',
  it: 'Italiano',
  ja: '日本語',
  ko: '한국어',
  pl: 'Polski',
  'pt-br': 'Português (Brasil)',
  ru: 'Русский',
  th: 'ไทย',
  tr: 'Türkçe',
  uk: 'Українська',
  vi: 'Tiếng Việt',
  zh: '中文',
  'zh-hans': '简体中文',
  'zh-hant': '繁體中文'
}

export const getFlagEmoji = (lang: string): string => {
  const flags: Record<string, string> = {
    all: '🌐',
    en: '🇺🇸',
    ar: '🇸🇦',
    es: '🇪🇸',
    fr: '🇫🇷',
    de: '🇩🇪',
    ja: '🇯🇵',
    ko: '🇰🇷',
    zh: '🇨🇳',
    'zh-hans': '🇨🇳',
    'zh-hant': '🇹🇼',
    pt: '🇵🇹',
    'pt-br': '🇧🇷',
    it: '🇮🇹',
    ru: '🇷🇺',
    vi: '🇻🇳',
    th: '🇹🇭',
    tr: '🇹🇷',
    id: '🇮🇩',
    uk: '🇺🇦',
    pl: '🇵🇱',
    ca: '🇪🇸',
    cs: '🇨🇿',
    bg: '🇧🇬'
  }
  return flags[lang.toLowerCase()] || '🏳️'
}

export const getLanguageLabel = (lang: string): string => {
  const name = LANGUAGE_NAMES[lang.toLowerCase()] || lang.toUpperCase()
  const flag = getFlagEmoji(lang)
  return `${flag} ${name}`
}

export const ANIME_SOURCE_PKGS = [
  'en.allanime',
  'en.gogoanime',
  'ar.anime4up',
  'ar.witanime',
  'ma.autakimi.extension.ar.anime4up',
  'ma.autakimi.extension.ar.witanime',
  'ma.autakimi.extension.ar.shahiidanime',
  'ma.autakimi.extension.ar.shahidanime',
  'ma.autakimi.extension.ar.ristoanime',
  'ar.shahiidanime',
  'ar.shahidanime',
  'ar.ristoanime'
]

export const isAnimeExtension = (ext?: { pkg?: string; name?: string; type?: string }): boolean => {
  if (!ext) return false
  if (ext.type === 'anime') return true
  if (ext.type === 'manga') return false
  const pkg = (ext.pkg || '').toLowerCase()
  const name = (ext.name || '').toLowerCase()
  return (
    ANIME_SOURCE_PKGS.includes(pkg) ||
    pkg.includes('anime') ||
    name.includes('anime') ||
    pkg.includes('witanime') ||
    pkg.includes('anime4up') ||
    pkg.includes('gogoanime') ||
    pkg.includes('allanime')
  )
}
