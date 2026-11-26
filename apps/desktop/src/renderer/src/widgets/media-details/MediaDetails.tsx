import { useState, useEffect } from 'react'
import { useLibraryStore } from '@renderer/shared/model'
import { useMediaData } from './hooks/useMediaData'
import { MediaDetailsView } from './views/MediaDetailsView'

interface MediaDetailsProps {
  mediaType: 'manga' | 'anime'
}

export default function MediaDetails({ mediaType }: MediaDetailsProps) {
  const { selectedManga } = useLibraryStore()
  const [activeSeasonUrl, setActiveSeasonUrl] = useState<string | null>(null)

  useEffect(() => {
    setActiveSeasonUrl(null)
  }, [selectedManga?.id])

  const mediaData = useMediaData(mediaType, selectedManga, activeSeasonUrl)

  if (!selectedManga) return null

  return (
    <MediaDetailsView
      {...mediaData}
      mediaType={mediaType}
      activeSeasonUrl={activeSeasonUrl}
      onSelectSeason={setActiveSeasonUrl}
    />
  )
}
