import { MadaraSource } from './base/MadaraSource';
import { IkenSource } from './base/IkenSource';
import { ISourceAdapter } from './types';

export const generatedSources: Record<string, ISourceAdapter> = {
  'ma.lmanwa.extension.ar.arabtoons': new MadaraSource(
    'ma.lmanwa.extension.ar.arabtoons',
    'عرب تونز',
    '0.0.1',
    'https://arabtoons.net',
    'ar',
    'ma.lmanwa.extension.ar.arabtoons',
    false
  ),
  'ma.lmanwa.extension.ar.arbxcomix': new MadaraSource(
    'ma.lmanwa.extension.ar.arbxcomix',
    'ArbxComix',
    '0.0.1',
    'https://arbxcomix.com',
    'ar',
    'ma.lmanwa.extension.ar.arbxcomix',
    false
  ),
  'ma.lmanwa.extension.ar.azora': new IkenSource(
    'ma.lmanwa.extension.ar.azora',
    'Azora',
    '0.0.1',
    'https://azoramoon.com',
    'https://api.azoramoon.com',
    'ar',
    'ma.lmanwa.extension.ar.azora',
    false
  ),
  'ma.lmanwa.extension.ar.crowscans': new MadaraSource(
    'ma.lmanwa.extension.ar.crowscans',
    'Hadess',
    '0.0.1',
    'https://www.hadess.xyz',
    'ar',
    'ma.lmanwa.extension.ar.crowscans',
    false
  ),
  'ma.lmanwa.extension.ar.detectiveconanar': new MadaraSource(
    'ma.lmanwa.extension.ar.detectiveconanar',
    'شبكة كونان العربية',
    '0.0.1',
    'https://manga.detectiveconanar.com',
    'ar',
    'ma.lmanwa.extension.ar.detectiveconanar',
    false
  ),
  'ma.lmanwa.extension.ar.empirewebtoon': new MadaraSource(
    'ma.lmanwa.extension.ar.empirewebtoon',
    'Empire Webtoon',
    '0.0.1',
    'https://webtoonempire-bl.com',
    'ar',
    'ma.lmanwa.extension.ar.empirewebtoon',
    false
  ),
  'ma.lmanwa.extension.ar.goldenmanga': new MadaraSource(
    'ma.lmanwa.extension.ar.goldenmanga',
    'Golden Manga',
    '0.0.1',
    'https://goldenmanga.net',
    'ar',
    'ma.lmanwa.extension.ar.goldenmanga',
    false
  ),
  'ma.lmanwa.extension.ar.manga3asq': new MadaraSource(
    'ma.lmanwa.extension.ar.manga3asq',
    'مانجا العاشق',
    '0.0.1',
    'https://3asq.org',
    'ar',
    'ma.lmanwa.extension.ar.manga3asq',
    false
  ),
  'ma.lmanwa.extension.ar.mangalink': new MadaraSource(
    'ma.lmanwa.extension.ar.mangalink',
    'مانجا لينك',
    '0.0.1',
    'https://link-manga.net',
    'ar',
    'ma.lmanwa.extension.ar.mangalink',
    false
  ),
  'ma.lmanwa.extension.ar.mangalionz': new MadaraSource(
    'ma.lmanwa.extension.ar.mangalionz',
    'MangaLionz',
    '0.0.1',
    'https://manga-lionz.org',
    'ar',
    'ma.lmanwa.extension.ar.mangalionz',
    false
  ),
  'ma.lmanwa.extension.ar.mangaspark': new MadaraSource(
    'ma.lmanwa.extension.ar.mangaspark',
    'MangaSpark',
    '0.0.1',
    'https://manga-spark.net',
    'ar',
    'ma.lmanwa.extension.ar.mangaspark',
    false
  ),
  'ma.lmanwa.extension.ar.mangastarz': new MadaraSource(
    'ma.lmanwa.extension.ar.mangastarz',
    'Manga Starz',
    '0.0.1',
    'https://manga-starz.net',
    'ar',
    'ma.lmanwa.extension.ar.mangastarz',
    false
  ),
  'ma.lmanwa.extension.ar.mangatuk': new MadaraSource(
    'ma.lmanwa.extension.ar.mangatuk',
    'MangaTuk',
    '0.0.1',
    'https://mangatuk.com',
    'ar',
    'ma.lmanwa.extension.ar.mangatuk',
    false
  ),
  'ma.lmanwa.extension.ar.mangaxcore': new MadaraSource(
    'ma.lmanwa.extension.ar.mangaxcore',
    'Mangax Core',
    '0.0.1',
    'https://mangaxcore.xyz',
    'ar',
    'ma.lmanwa.extension.ar.mangaxcore',
    false
  ),
  'ma.lmanwa.extension.ar.manhatic': new MadaraSource(
    'ma.lmanwa.extension.ar.manhatic',
    'Manhatic',
    '0.0.1',
    'https://manhatic.com',
    'ar',
    'ma.lmanwa.extension.ar.manhatic',
    false
  ),
  'ma.lmanwa.extension.ar.paradisebl': new MadaraSource(
    'ma.lmanwa.extension.ar.paradisebl',
    'Paradise BL',
    '0.0.1',
    'https://paradise-bl.com',
    'ar',
    'ma.lmanwa.extension.ar.paradisebl',
    false
  ),
  'ma.lmanwa.extension.ar.rocksmanga': new MadaraSource(
    'ma.lmanwa.extension.ar.rocksmanga',
    'Rocks Manga',
    '0.0.1',
    'https://rocksmanga.com',
    'ar',
    'ma.lmanwa.extension.ar.rocksmanga',
    false
  ),
  'ma.lmanwa.extension.ar.yonabar': new MadaraSource(
    'ma.lmanwa.extension.ar.yonabar',
    'Yona Bar',
    '0.0.1',
    'https://yonaber.com',
    'ar',
    'ma.lmanwa.extension.ar.yonabar',
    false
  ),
};
