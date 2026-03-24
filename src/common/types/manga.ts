export interface Manga {
  id: string;
  title: string;
  coverUrl?: string | null;
  description?: string;
  status?: string;
  author?: string;
  artist?: string;
  genres?: string[];
  url?: string;
  pkg?: string;
  _raw?: any;
}
