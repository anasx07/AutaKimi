import { useState, useEffect } from 'react'
import { useLibraryStore } from '@renderer/shared/model'
import { Download, Loader2, Play } from 'lucide-react'
import { DataService } from '@renderer/shared/api'
import { Card, CardContent, Button } from '@renderer/shared/ui'
import { cn } from '@renderer/shared/lib/utils'

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
          <div className="flex items-center gap-1 bg-secondary/30 p-1 rounded-lg border border-border/40 w-fit">
            <Button
              variant={activeTab === 'manga' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('manga')}
              className={cn(
                "h-8 px-4 rounded-md text-xs font-bold transition-all",
                activeTab === 'manga' ? "shadow-md" : "text-muted-foreground"
              )}
            >
              Manga
            </Button>
            <Button
              variant={activeTab === 'anime' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('anime')}
              className={cn(
                "h-8 px-4 rounded-md text-xs font-bold transition-all",
                activeTab === 'anime' ? "shadow-md" : "text-muted-foreground"
              )}
            >
              Anime
            </Button>
          </div>
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 items-start content-start overflow-y-auto pr-2 pb-6 flex-1">
          {downloads.map((manga) => {
            return (
              <Card
                key={manga.id}
                onClick={() => setSelectedManga({
                   ...manga,
                   mediaType: manga.mediaType || activeTab
                })}
                className="group relative cursor-pointer overflow-hidden border-border/40 hover:border-primary/50 hover:shadow-lg transition-all duration-300"
              >
                <div className="aspect-[3/4] relative overflow-hidden bg-secondary/20">
                  {manga.coverUrl ? (
                    <img src={manga.coverUrl} alt={manga.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      {activeTab === 'anime' ? (
                        <Play className="h-10 w-10 text-muted-foreground/30" />
                      ) : (
                        <Download className="h-10 w-10 text-muted-foreground/30" />
                      )}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
                <CardContent className="p-3 bg-card">
                  <h3 className="font-semibold text-sm line-clamp-2 group-hover:text-primary transition-colors">{manga.title}</h3>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
