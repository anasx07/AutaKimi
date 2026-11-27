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
  'ma.autakimi.extension.ar.okanime',
  'ar.shahiidanime',
  'ar.shahidanime',
  'ar.ristoanime',
  'ar.okanime'
]

/**
 * Determine whether an extension entry represents an anime source rather than manga.
 */
export function isAnimeExtension(ext?: { pkg?: string; name?: string; type?: string }): boolean {
  if (!ext) return false
  if (ext.type === 'anime') return true
  if (ext.type === 'manga') return false
  const pkg = (ext.pkg || '').toLowerCase()
  const name = (ext.name || '').toLowerCase()
  return (
    ANIME_SOURCE_PKGS.includes(pkg) ||
    pkg.includes('anime') ||
    name.includes('anime') ||
    pkg.includes('okanime') ||
    name.includes('okanime') ||
    pkg.includes('witanime') ||
    pkg.includes('anime4up') ||
    pkg.includes('gogoanime') ||
    pkg.includes('allanime')
  )
}
