import { BookOpen, Loader2 } from 'lucide-react'
import { normalizeManga } from '@common/utils/mangaNormalizer'
import { Card, CardContent, Badge } from '@renderer/shared/ui'
import { useLibraryStore } from '@renderer/shared/model'

import { useLibraryItems } from '@renderer/entities/manga/api/useMangaQueries'

export default function LibraryPage() {
  const { setSelectedManga } = useLibraryStore()
  const { data: library = [], isLoading: loading } = useLibraryItems()

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 flex-1 flex flex-col h-full animate-in fade-in duration-500">
      <div className="flex flex-col space-y-1.5">
        <h1 className="text-3xl font-bold tracking-tight">Library</h1>
        <p className="text-muted-foreground">Your collection of saved manga and manhwa.</p>
      </div>

      {library.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground py-20 space-y-2 opacity-60">
          <BookOpen className="h-12 w-12 stroke-[1.5]" />
          <p>Your library is empty. Browse sources to add titles.</p>
        </div>
      )}

      {library.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 items-start content-start overflow-y-auto pr-2 pb-6 flex-1">
          {library.map((manga) => {
            const norm = normalizeManga(manga)
            return (
              <Card
                key={norm.id}
                onClick={() => setSelectedManga(manga)}
                className="group relative cursor-pointer overflow-hidden border-border/40 hover:border-primary/50 hover:shadow-lg transition-all duration-300"
              >
                <div className="aspect-[3/4] relative overflow-hidden bg-secondary/20">
                  {norm.coverUrl ? (
                    <img src={norm.coverUrl} alt={norm.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><BookOpen className="h-10 w-10 text-muted-foreground/30" /></div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
                <CardContent className="p-3 bg-card">
                  <h3 className="font-semibold text-sm line-clamp-1 group-hover:text-primary transition-colors">{norm.title}</h3>
                  <div className="flex items-center justify-between mt-1">
                    <Badge variant="secondary" className="px-1.5 py-0 text-[10px] uppercase font-bold tracking-wider opacity-80">
                      {norm.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
