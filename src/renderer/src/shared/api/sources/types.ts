import { Manga, Chapter, FetchOptions } from '@common/types'
export type { Manga, Chapter, FetchOptions }

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
  
  fetchPopular(page: number, extraArgs?: FetchOptions): Promise<MangaPage>;
  fetchLatest?(page: number, extraArgs?: FetchOptions): Promise<MangaPage>;
  searchManga(query: string, page: number, extraArgs?: FetchOptions): Promise<MangaPage>;
  fetchMangaDetails(manga: Manga): Promise<Manga>;
  fetchChapters(mangaUrl: string): Promise<Chapter[]>;
  fetchPages(chapterUrl: string): Promise<string[] | any>;
}
