import { useLibraryStore } from '@renderer/shared/model'
import { useMediaData } from './hooks/useMediaData'
import { MediaDetailsView } from './views/MediaDetailsView'

interface MediaDetailsProps {
  mediaType: 'manga' | 'anime'
}

export default function MediaDetails({ mediaType }: MediaDetailsProps) {
  const { selectedManga } = useLibraryStore()
  const mediaData = useMediaData(mediaType, selectedManga)

  if (!selectedManga) return null

  return <MediaDetailsView {...mediaData} mediaType={mediaType} />
}
