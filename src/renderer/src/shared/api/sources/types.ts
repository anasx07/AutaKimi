import { Manga, Chapter } from '../../../../../common/types'
export type { Manga, Chapter }

export interface MangaPage {
  manga: Manga[];
  hasNextPage: boolean;
}

export interface ISourceAdapter {
  id: string; // Internal ID for the source
  name: string;
  version: string; // Added versioning support
  theme: string;   // Added theme identification
  baseUrl: string;
  lang: string;
  nsfw: boolean;
  icon: string; // Added icon identification
  
  fetchPopular(page: number, extraArgs?: any): Promise<MangaPage>;
  fetchLatest?(page: number, extraArgs?: any): Promise<MangaPage>;
  searchManga(query: string, page: number, extraArgs?: any): Promise<MangaPage>;
  fetchMangaDetails(manga: Manga): Promise<Manga>;
  fetchChapters(mangaUrl: string): Promise<Chapter[]>;
  fetchPages(chapterUrl: string): Promise<string[]>;
}
