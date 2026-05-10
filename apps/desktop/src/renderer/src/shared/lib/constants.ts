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
