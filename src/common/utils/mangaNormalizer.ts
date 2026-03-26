import { Manga } from '../types/manga'
export type { Manga as NormalizedManga }
export type { Manga }

export interface Chapter {
  id: string;
  attributes: {
    chapter: string;
    title: string;
    createdAt: string;
    description?: string;
  };
}

export const normalizeManga = (manga: any, preferredLang?: string): Manga => {
  if (!manga) {
    return { id: '', title: 'Unknown', coverUrl: null, description: 'No description', status: 'Unknown' };
  }

  // 1. Extract Title
  let title = 'Untitled';
  if (manga.title) {
    title = manga.title;
  } else if (manga.attributes?.title) {
    if (typeof manga.attributes.title === 'string') {
      title = manga.attributes.title;
    } else {
      title = (preferredLang && manga.attributes.title[preferredLang]) || 
              manga.attributes.title.en || 
              Object.values(manga.attributes.title)[0] || 
              'Untitled';
    }
  }

  // 2. Extract Cover
  let coverUrl = manga.coverUrl || manga.cover_url || manga.thumbnail_url || manga.cover || null;
  if (!coverUrl && manga.relationships) {
    const coverRel = manga.relationships.find((r: any) => r.type === 'cover_art');
    if (coverRel && coverRel.attributes?.fileName) {
      coverUrl = `https://uploads.mangadex.org/covers/${manga.id}/${coverRel.attributes.fileName}.256.jpg`;
    }
  }

  // 3. Extract Description
  let description = manga.description || manga.attributes?.description || "No description available.";
  if (typeof description === 'object' && description !== null) {
    description = (preferredLang && description[preferredLang]) || 
                  description.en || 
                  Object.values(description)[0] || 
                  "No description available.";
  }

  // 4. Extract Status, Author, Artist, Genres
  const status = manga.status || manga.attributes?.status || 'Unknown';
  const author = manga.author || manga.author_name || manga.attributes?.author || undefined;
  const artist = manga.artist || manga.artist_name || manga.attributes?.artist || undefined;
  const genres = manga.genres || manga.attributes?.genres || undefined;

  return {
    id: manga.id,
    title: String(title),
    coverUrl,
    description: String(description),
    status,
    author,
    artist,
    genres,
    url: manga.url || manga.manga_url || undefined,
    pkg: manga.pkg || undefined,
    mediaType: manga.mediaType || manga.attributes?.mediaType || undefined,
    _raw: manga
  };
}
