import { useState, useEffect } from 'react'
import { useLibraryStore } from '@renderer/shared/model'
import { Download, Loader2, Play } from 'lucide-react'
import { DataService } from '@renderer/shared/api'
import { MediaTabSwitcher, MediaGrid, MediaGridItem } from '@renderer/shared/ui'

export default function DownloadsPage() {
  const [activeTab, setActiveTab] = useState<'manga' | 'anime'>('manga')
  const { setSelectedManga } = useLibraryStore()
  const [downloads, setDownloads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDownloads = async () => {
      try {
        setLoading(true)
        const mangaList = await DataService.download.getAllMangaDownloads(activeTab)
        setDownloads(mangaList || [])
      } catch (e) {
        console.error('Failed to fetch downloaded manga', e)
        setDownloads([])
      } finally {
        setLoading(false)
      }
    }

    fetchDownloads()
  }, [activeTab])

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 flex-1 flex flex-col h-full animate-in fade-in duration-500">
      <div className="flex flex-col space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex flex-col space-y-1.5">
            <h1 className="text-3xl font-bold tracking-tight">Downloads</h1>
            <p className="text-muted-foreground whitespace-nowrap">
              {activeTab === 'anime' ? 'Anime' : 'Manga'} available for offline {activeTab === 'anime' ? 'viewing' : 'reading'}.
            </p>
          </div>
          <MediaTabSwitcher activeTab={activeTab} onTabChange={setActiveTab} />
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground py-20 space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p>Loading downloaded {activeTab}...</p>
        </div>
      ) : downloads.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground py-20 space-y-2 opacity-60">
          {activeTab === 'anime' ? (
            <Play className="h-12 w-12 stroke-[1.5]" />
          ) : (
            <Download className="h-12 w-12 stroke-[1.5]" />
          )}
          <p>You haven't downloaded any {activeTab} yet.</p>
        </div>
      ) : (
        <MediaGrid>
          {downloads.map((manga, idx) => {
            return (
              <MediaGridItem
                key={manga.id}
                title={manga.title}
                coverUrl={manga.coverUrl}
                mediaType={activeTab}
                index={idx}
                onClick={() => setSelectedManga({
                   ...manga,
                   mediaType: manga.mediaType || activeTab
                })}
              />
            )
          })}
        </MediaGrid>      )}
    </div>
  )
}
