import { MadaraSource } from '../base/MadaraSource'

export class MangaLek extends MadaraSource {
  constructor() {
    super(
      'ma.lmanwa.extension.ar.mangalek',
      'Manga Lek',
      '0.0.1',
      'https://lek-manga.net', // Principal mirror
      'ar',
      'ma.lmanwa.extension.ar.mangalek',
      false
    )
  }

  // MangaLek often has a custom home structure, but MadaraSource fallbacks should handle it
}
