import { useLibraryStore } from '@renderer/shared/model'
import { useMediaData } from './hooks/useMediaData'
import { MangaDetailsView } from './views/MangaDetailsView'
import { AnimeDetailsView } from './views/AnimeDetailsView'

interface MediaDetailsProps {
  mediaType: 'manga' | 'anime'
}

export default function MediaDetails({ mediaType }: MediaDetailsProps) {
  const { selectedManga } = useLibraryStore()
  const mediaData = useMediaData(mediaType, selectedManga)

  if (!selectedManga) return null

  if (mediaType === 'anime') {
    return <AnimeDetailsView {...mediaData} />
  }

  return <MangaDetailsView {...mediaData} />
}
