import { useState, useMemo } from 'react'
import { Package, ExternalLink, Trash2, Search as SearchIcon, Pin } from 'lucide-react'
import { Button, Badge, Card } from '@renderer/shared/ui'
import { cn } from '@renderer/shared/lib/utils'
import { useExtensionStore, useUIStore } from '@renderer/shared/model'
import GlobalSearch from '@renderer/widgets/global-search/GlobalSearch'

export default function ExtensionsPage() {
  const { 
    installedExtensions, 
    pinnedExtensions, 
    togglePin, 
    uninstallExtension, 
    setActiveExtension 
  } = useExtensionStore()
  const { setActiveTab } = useUIStore()
  const [activeSubTab, setActiveSubTab] = useState<'sources' | 'search'>('sources')

  const sortedExtensions = useMemo(() => {
    return [...installedExtensions].sort((a, b) => {
      const aPinned = pinnedExtensions.includes(a.pkg)
      const bPinned = pinnedExtensions.includes(b.pkg)
      if (aPinned && !bPinned) return -1
      if (!aPinned && bPinned) return 1
      return a.name.localeCompare(b.name)
    })
  }, [installedExtensions, pinnedExtensions])

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="flex flex-col space-y-1.5">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Browse</h1>
          <p className="text-muted-foreground text-sm">
            {activeSubTab === 'sources' 
              ? "Manage your installed sources and explore their contents." 
              : "Search for manga across all your installed extensions."}
          </p>
        </div>

        <div className="flex items-center gap-1 bg-secondary/20 p-1 rounded-lg border border-border/50 self-start sm:self-auto">
          <button
            onClick={() => setActiveSubTab('sources')}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all",
              activeSubTab === 'sources' 
                ? "bg-primary text-primary-foreground shadow-sm" 
                : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
            )}
          >
            <Package className="h-3.5 w-3.5" />
            Sources
          </button>
          <button
            onClick={() => setActiveSubTab('search')}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all",
              activeSubTab === 'search' 
                ? "bg-primary text-primary-foreground shadow-sm" 
                : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
            )}
          >
            <SearchIcon className="h-3.5 w-3.5" />
            Global Search
          </button>
        </div>
      </div>

      {activeSubTab === 'search' ? (
         <GlobalSearch />
      ) : (
        <>
          {installedExtensions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-muted-foreground space-y-4 bg-secondary/10 rounded-xl border-2 border-dashed border-border/50 animate-in zoom-in-95 duration-500">
          <Package className="h-16 w-16 stroke-[1] text-muted-foreground/30" />
          <div className="text-center space-y-1">
            <p className="text-lg font-medium text-foreground">No extensions installed yet</p>
            <p className="text-sm">Go to the <span className="text-primary font-semibold">Extensions</span> tab to discover and install new sources.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedExtensions.map((ext, idx) => {
            const isPinned = pinnedExtensions.includes(ext.pkg)
            return (
              <Card 
                key={ext.pkg} 
                className={cn(
                  "group p-5 bg-card/50 backdrop-blur-sm hover:bg-secondary/30 transition-all duration-300 hover:shadow-xl border-border/40",
                  "animate-in fade-in slide-in-from-bottom-4",
                  isPinned && "border-primary/30 ring-1 ring-primary/10 shadow-lg shadow-primary/5 bg-primary/[0.02]"
                )}
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                <div className="flex items-start gap-5">
                  <div className="w-16 h-16 rounded-2xl bg-secondary/80 flex items-center justify-center p-3 shadow-inner relative overflow-hidden ring-1 ring-border/50 group-hover:scale-105 transition-transform duration-300">
                     {ext.icon ? (
                       <>
                         <img 
                            src={(() => {
                              try {
                                const pkg = ext.pkg
                                const localPath = new URL(`../../app/assets/Extensionicon/${pkg}.png`, import.meta.url).href
                                if (localPath && !localPath.includes('undefined')) return localPath
                              } catch (e) {}
                              return `lmanwa-cache://local-icon/${ext.pkg}.png`
                            })()} 
                           alt={ext.name} 
                           className="w-full h-full object-contain" 
                           onError={(e) => {
                             e.currentTarget.style.display = 'none';
                             const fallback = e.currentTarget.parentElement?.querySelector('.fallback-icon');
                             if (fallback) fallback.classList.remove('hidden');
                           }}
                         />
                         <Package className="w-8 h-8 text-muted-foreground/50 fallback-icon hidden" />
                       </>
                     ) : (
                       <Package className="w-8 h-8 text-muted-foreground/50" />
                     )}
                  </div>
                  
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-start justify-between gap-2 overflow-hidden">
                      <h3 className="font-bold text-lg text-foreground truncate group-hover:text-primary transition-colors leading-none pt-1">
                        {ext.name}
                      </h3>
                      <div className="flex items-center gap-2 shrink-0">
                         {isPinned && <Pin className="h-3 w-3 text-primary fill-primary animate-in zoom-in" />}
                         <Badge variant="secondary" className="shrink-0 flex items-center gap-1.5 px-2 py-0 border-primary/20 bg-primary/10 text-primary uppercase font-bold text-[10px]">
                            {ext.lang}
                         </Badge>
                      </div>
                    </div>
                    
                    <p className="text-xs text-muted-foreground font-mono truncate opacity-60">
                      {ext.pkg}
                    </p>
                    
                    <div className="flex items-center gap-3 pt-3">
                      <Button 
                        onClick={() => {
                          setActiveExtension(ext.pkg)
                          setActiveTab('browse')
                        }}
                        className="flex-1 h-9 gap-2 font-bold shadow-md"
                      >
                        Browse
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                      
                      <div className="flex items-center gap-1.5">
                        <Button 
                          variant="outline"
                          size="icon"
                          onClick={() => togglePin(ext.pkg)}
                          className={cn(
                            "h-9 w-9 shrink-0 transition-all border-transparent",
                            isPinned 
                              ? "text-primary bg-primary/10 hover:bg-primary/20 hover:text-primary border-primary/20" 
                              : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                          )}
                          title={isPinned ? "Unpin" : "Pin"}
                        >
                          <Pin className={cn("h-4 w-4", isPinned && "fill-current")} />
                        </Button>

                        <Button 
                          variant="outline"
                          size="icon"
                          onClick={() => uninstallExtension(ext.pkg)}
                          className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 border-transparent hover:border-destructive/20 transition-all"
                          title="Uninstall"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {installedExtensions.length > 0 && (
        <div className="pt-8 text-center animate-in fade-in duration-1000 delay-500">
          <p className="text-xs text-muted-foreground/50 italic flex items-center justify-center gap-2">
            <span className="w-8 h-px bg-border/50" />
            Tip: You can find more extensions in the Extensions tab.
            <span className="w-8 h-px bg-border/50" />
          </p>
        </div>
      )}
        </>
      )}
    </div>
  )
}
