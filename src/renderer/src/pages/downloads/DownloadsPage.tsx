import { useState, useEffect } from 'react'
import { useLibraryStore } from '@renderer/shared/model'
import { Download, Loader2 } from 'lucide-react'
import { DataService } from '@renderer/shared/api'
import { Card, CardContent } from '@renderer/shared/ui'

export default function DownloadsPage() {
  const { setSelectedManga } = useLibraryStore()
  const [downloads, setDownloads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDownloads = async () => {
      try {
        setLoading(true)
        const mangaList = await DataService.download.getAllMangaDownloads()
        setDownloads(mangaList || [])
      } catch (e) {
        console.error('Failed to fetch downloaded manga', e)
      } finally {
        setLoading(false)
      }
    }

    fetchDownloads()
  }, [])

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 flex-1 flex flex-col h-full animate-in fade-in duration-500">
      <div className="flex flex-col space-y-1.5">
        <h1 className="text-3xl font-bold tracking-tight">Downloads</h1>
        <p className="text-muted-foreground">Manga available for offline reading.</p>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground py-20 space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p>Loading downloaded manga...</p>
        </div>
      ) : downloads.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground py-20 space-y-2 opacity-60">
          <Download className="h-12 w-12 stroke-[1.5]" />
          <p>You haven't downloaded any manga yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 items-start content-start overflow-y-auto pr-2 pb-6 flex-1">
          {downloads.map((manga) => {
            return (
              <Card
                key={manga.id}
                onClick={() => setSelectedManga(manga)}
                className="group relative cursor-pointer overflow-hidden border-border/40 hover:border-primary/50 hover:shadow-lg transition-all duration-300"
              >
                <div className="aspect-[3/4] relative overflow-hidden bg-secondary/20">
                  {manga.coverUrl ? (
                    <img src={manga.coverUrl} alt={manga.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><Download className="h-10 w-10 text-muted-foreground/30" /></div>
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
