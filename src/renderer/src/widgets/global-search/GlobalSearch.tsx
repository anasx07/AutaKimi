import { useState, useRef } from 'react'
import { Search, Loader2, Package, AlertCircle, CheckCircle, ExternalLink } from 'lucide-react'
import { Input, Button, Card, Switch } from '@renderer/shared/ui'
import { useExtensionStore, useLibraryStore, useUIStore } from '@renderer/shared/model'
import { ExtensionMetadata } from '@renderer/shared/model/extension.store'
import { ExtensionResolver } from '@renderer/shared/api/sources/resolver'
import { cn } from '@renderer/shared/lib/utils'
import { MediaCardSkeleton } from '@renderer/shared/ui'
import { RotateCcw } from 'lucide-react'
import { DataService } from '@renderer/shared/api'

interface SearchResult {
  manga: any
  extension: ExtensionMetadata
}

export default function GlobalSearch() {
  const { installedExtensions, pinnedExtensions, setActiveExtension } = useExtensionStore()
  const { setSelectedManga } = useLibraryStore()
  const { setActiveTab } = useUIStore()

  const [query, setQuery] = useState('')
  const [onlyPinned, setOnlyPinned] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [statuses, setStatuses] = useState<
    Record<string, 'pending' | 'searching' | 'done' | 'error'>
  >({})

  const searchIdRef = useRef(0)

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!query.trim() || searching) return

    const searchId = ++searchIdRef.current
    setSearching(true)
    setResults([])

    const targets = onlyPinned
      ? installedExtensions.filter((e) => pinnedExtensions.includes(e.pkg))
      : installedExtensions

    const initialStatuses = targets.reduce(
      (acc, ext) => {
        acc[ext.pkg] = 'pending'
        return acc
      },
      {} as Record<string, 'pending' | 'searching' | 'done' | 'error'>
    )
    setStatuses(initialStatuses)

    // Concurrency pooling (limit 3 simultaneous searches)
    let index = 0
    const worker = async () => {
      while (index < targets.length) {
        if (searchId !== searchIdRef.current) return
        const ext = targets[index++]

        setStatuses((prev) => ({ ...prev, [ext.pkg]: 'searching' }))

        try {
          const runner = await ExtensionResolver.resolve(ext.pkg)
          if (!runner) throw new Error(`Extension ${ext.name} not found`)

          const mangaPage = await runner.searchManga(query, 1)

          if (searchId === searchIdRef.current) {
            if (mangaPage && mangaPage.manga && mangaPage.manga.length > 0) {
              const wrappedResults = mangaPage.manga.map((m) => ({ manga: m, extension: ext }))
              setResults((prev) => [...prev, ...wrappedResults])
            }
            setStatuses((prev) => ({ ...prev, [ext.pkg]: 'done' }))
          }
        } catch (err: any) {
          console.error(`[GlobalSearch] Error searching ${ext.name}:`, err)
          if (searchId === searchIdRef.current) {
            setStatuses((prev) => ({ ...prev, [ext.pkg]: 'error' }))
          }
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(3, targets.length) }, worker))
    if (searchId === searchIdRef.current) {
      setSearching(false)
    }
  }

  const retrySource = async (ext: ExtensionMetadata) => {
    if (!query.trim()) return
    const searchId = searchIdRef.current

    setStatuses((prev) => ({ ...prev, [ext.pkg]: 'searching' }))
    setResults((prev) => prev.filter((r) => r.extension.pkg !== ext.pkg))

    try {
      const runner = await ExtensionResolver.resolve(ext.pkg)
      if (!runner) throw new Error(`Extension ${ext.name} not found`)

      const mangaPage = await runner.searchManga(query, 1)

      if (searchId === searchIdRef.current) {
        if (mangaPage && mangaPage.manga && mangaPage.manga.length > 0) {
          const wrappedResults = mangaPage.manga.map((m) => ({ manga: m, extension: ext }))
          setResults((prev) => [...prev, ...wrappedResults])
        }
        setStatuses((prev) => ({ ...prev, [ext.pkg]: 'done' }))
      }
    } catch (err: any) {
      console.error(`[GlobalSearch] Error retrying ${ext.name}:`, err)
      if (searchId === searchIdRef.current) {
        setStatuses((prev) => ({ ...prev, [ext.pkg]: 'error' }))
      }
    }
  }

  const doneCount = Object.values(statuses).filter((s) => s === 'done' || s === 'error').length
  const totalCount = Object.keys(statuses).length

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 pt-2 duration-500">
      <form onSubmit={handleSearch} className="flex gap-3 max-w-2xl mx-auto">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 h-11 shadow-sm transition-all focus:shadow-md border-border/60 bg-card/30"
            placeholder="Search manga across all installed extensions..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>
        <Button
          type="submit"
          disabled={searching || !query.trim()}
          className="h-11 px-8 font-bold shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          {searching ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Search className="h-4 w-4 mr-2" />
          )}
          {searching ? 'Searching...' : 'Search'}
        </Button>
      </form>

      <div className="flex items-center justify-center gap-3 animate-in fade-in duration-1000">
        <Switch
          id="only-pinned"
          className="scale-[0.8]"
          checked={onlyPinned}
          onCheckedChange={setOnlyPinned}
        />
        <label
          htmlFor="only-pinned"
          className="text-xs font-semibold text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors"
        >
          Only include pinned sources
        </label>
      </div>

      {(searching || doneCount > 0) && (
        <div className="max-w-2xl mx-auto space-y-3">
          {searching && (
            <>
              <div className="h-1.5 w-full bg-secondary/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500 ease-out"
                  style={{ width: `${(doneCount / totalCount) * 100}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[10px] uppercase tracking-widest font-bold text-muted-foreground px-1">
                <span>Progress: {Math.round((doneCount / totalCount) * 100)}%</span>
                <span>
                  {doneCount} / {totalCount} Sources
                </span>
              </div>
            </>
          )}

          <div className="flex flex-wrap gap-2 justify-center pt-2">
            {installedExtensions.map((ext) => (
              <div
                key={ext.pkg}
                className={cn(
                  'flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[9px] transition-all',
                  statuses[ext.pkg] === 'done'
                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                    : statuses[ext.pkg] === 'error'
                      ? 'bg-destructive/10 text-destructive border-destructive/20'
                      : statuses[ext.pkg] === 'searching'
                        ? 'bg-primary/10 text-primary border-primary/20'
                        : 'bg-secondary/30 text-muted-foreground border-border/40 opacity-50'
                )}
              >
                {statuses[ext.pkg] === 'done' ? (
                  <CheckCircle className="h-2.5 w-2.5" />
                ) : statuses[ext.pkg] === 'error' ? (
                  <AlertCircle className="h-2.5 w-2.5" />
                ) : statuses[ext.pkg] === 'searching' ? (
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                ) : null}
                {ext.name}
              </div>
            ))}
          </div>
        </div>
      )}

      {doneCount > 0 && (
        <div className="space-y-10">
          {installedExtensions.map((ext) => {
            const extResults = results.filter((r) => r.extension.pkg === ext.pkg)
            const status = statuses[ext.pkg]

            if (status === 'pending') return null

            return (
              <div
                key={ext.pkg}
                className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-500"
              >
                <div className="flex items-center justify-between border-b border-border/40 pb-2 group/header">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-secondary/50 flex items-center justify-center overflow-hidden ring-1 ring-border/50">
                      <img
                        src={DataService.getExtensionIcon(ext.pkg, ext.icon)}
                        alt=""
                        className="w-full h-full object-contain"
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                      />
                      <Package className="h-4 w-4 text-muted-foreground/50" />
                    </div>
                    <h2 className="text-sm font-bold text-foreground group-hover/header:text-primary transition-colors flex items-center gap-2">
                      {ext.name}
                      <span className="text-[10px] text-muted-foreground font-normal uppercase tracking-wider">
                        ({ext.lang})
                      </span>
                    </h2>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setActiveExtension(ext.pkg)
                      setActiveTab('browse')
                    }}
                    className="h-8 gap-1.5 text-[10px] font-bold text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all"
                  >
                    View All
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>

                {extResults.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                    {extResults.map((res, idx) => (
                      <Card
                        key={`${res.manga.id}-${idx}`}
                        onClick={() => {
                          setActiveExtension(res.extension.pkg)
                          setSelectedManga({ ...res.manga, pkg: res.extension.pkg })
                        }}
                        className="group cursor-pointer bg-card/40 backdrop-blur-sm hover:bg-secondary/30 border-border/40 hover:border-primary/50 transition-all duration-500 hover:shadow-2xl overflow-hidden rounded-xl"
                      >
                        <div className="aspect-[3/4.5] relative overflow-hidden bg-secondary/20">
                          <img
                            src={res.manga.coverUrl}
                            alt={res.manga.title}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-60 group-hover:opacity-100 transition-opacity duration-500" />
                        </div>
                        <div className="p-3">
                          <h3 className="text-[11px] font-bold text-foreground line-clamp-2 leading-tight group-hover:text-primary transition-colors duration-300">
                            {res.manga.title}
                          </h3>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : status === 'done' ? (
                  <div className="py-8 text-center bg-secondary/5 rounded-xl border border-dashed border-border/40">
                    <p className="text-xs text-muted-foreground italic">
                      No results found in this source
                    </p>
                  </div>
                ) : status === 'error' ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-6 bg-destructive/5 rounded-2xl border border-dashed border-destructive/20 animate-in zoom-in duration-300">
                    <div className="space-y-2 text-center">
                      <p className="text-sm font-bold text-destructive flex items-center justify-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        Search Failed
                      </p>
                      <p className="text-[10px] text-destructive/60 font-medium max-w-[200px] mx-auto px-4 leading-relaxed">
                        Something went wrong while connecting to this source.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => retrySource(ext)}
                      className="h-8 gap-2 border-destructive/20 hover:bg-destructive hover:text-white transition-all active:scale-95"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Retry Search
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <MediaCardSkeleton key={i} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {!searching && results.length === 0 && query && doneCount === totalCount && (
        <div className="flex flex-col items-center justify-center py-32 text-muted-foreground space-y-4 animate-in zoom-in duration-500">
          <div className="p-4 rounded-full bg-secondary/10 border border-border/50">
            <Package className="h-12 w-12 opacity-20" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-lg font-medium text-foreground">No matches found</p>
            <p className="text-sm">
              We couldn't find any manga named "{query}" in any of your sources.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
