import { useLibraryStore } from '@renderer/shared/model'
import { MediaSeason } from '@renderer/shared/api/sources/types'
import { useMediaData } from './hooks/useMediaData'
import { MediaDetailsView } from './views/MediaDetailsView'

interface MediaDetailsProps {
  mediaType: 'manga' | 'anime'
}

export default function MediaDetails({ mediaType }: MediaDetailsProps) {
  const { selectedManga, setSelectedManga, setActiveChapter } = useLibraryStore()
  const mediaData = useMediaData(mediaType, selectedManga)

  if (!selectedManga) return null

  const handleSelectSeason = (season: MediaSeason): void => {
    if (!season?.url || season.url === selectedManga.url) return
    const currentSeasons = mediaData.mergedMedia?.seasons || selectedManga.seasons
    setActiveChapter(null)
    setSelectedManga({
      ...selectedManga,
      id: season.url,
      url: season.url,
      title: season.title || selectedManga.title,
      coverUrl: season.coverUrl || selectedManga.coverUrl || null,
      description: '',
      status: '',
      genres: [],
      seasons: currentSeasons?.map((s) => ({
        ...s,
        isCurrent: s.url === season.url
      }))
    })
  }

  return (
    <MediaDetailsView
      {...mediaData}
      mediaType={mediaType}
      activeSeasonUrl={selectedManga.url}
      onSelectSeason={handleSelectSeason}
    />
  )
}
