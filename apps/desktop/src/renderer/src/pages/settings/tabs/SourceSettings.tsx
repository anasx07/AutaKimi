import { Library, Plus, Trash2, Globe, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useState, useEffect } from 'react'
import { Button, Card, SectionHeader, Badge } from '@renderer/shared/ui'
import { DataService } from '@renderer/shared/api'

export function SourceSettings(): React.JSX.Element {
  const [repos, setRepos] = useState<string[]>([])
  const [newRepoUrl, setNewRepoUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchRepos = async () => {
    try {
      const list = await DataService.sources.getRepos()
      setRepos(list)
    } catch (e) {
      console.error('Failed to fetch repos', e)
    }
  }

  useEffect(() => {
    fetchRepos()
  }, [])

  const handleAddRepo = async () => {
    if (!newRepoUrl.trim()) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await DataService.sources.addRepo(newRepoUrl.trim())
      if (res.success) {
        setNewRepoUrl('')
        fetchRepos()
      } else {
        setError(res.error || 'Failed to add repository')
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemoveRepo = async (url: string) => {
    try {
      await DataService.sources.removeRepo(url)
      fetchRepos()
    } catch (e) {
      console.error('Failed to remove repo', e)
    }
  }

  const handleRefreshAll = async () => {
    setRefreshing(true)
    try {
      await DataService.sources.refreshAll()
    } catch (e) {
      console.error('Failed to refresh templates', e)
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <SectionHeader title="Content Sources" icon={Library} />
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleRefreshAll}
            disabled={refreshing}
            className="gap-2 text-xs font-bold uppercase tracking-widest"
          >
            <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh All
          </Button>
        </div>
        
        <Card className="p-8 border-border bg-card shadow-none space-y-8">
          <div className="space-y-4">
            <h3 className="text-xl font-black uppercase tracking-tighter italic text-foreground flex items-center gap-2">
              Extension Repositories
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
              AutaKimi is a neutral browser. Add community-maintained repository URLs below to load scraping templates and extensions.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="https://example.com/templates.json"
                className="w-full bg-secondary/30 border border-border/50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                value={newRepoUrl}
                onChange={(e) => setNewRepoUrl(e.target.value)}
              />
            </div>
            <Button 
              onClick={handleAddRepo} 
              disabled={isLoading || !newRepoUrl}
              className="gap-2 font-bold px-6"
            >
              {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add Repository
            </Button>
          </div>

          {error && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl flex items-center gap-3 text-destructive text-sm animate-in shake duration-500">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-3">
            {repos.length === 0 ? (
              <div className="text-center py-10 border-2 border-dashed border-border/50 rounded-2xl">
                <Globe className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No repositories added yet.</p>
              </div>
            ) : (
              repos.map((url) => (
                <div 
                  key={url}
                  className="flex items-center justify-between p-4 bg-secondary/20 border border-border/50 rounded-2xl group hover:border-primary/30 transition-all"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <Globe className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate pr-4">{url}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge className="bg-green-500/10 text-green-500 border-none text-[10px] uppercase font-black px-1.5 py-0">Active</Badge>
                        <span className="text-[10px] text-muted-foreground opacity-50 uppercase font-bold tracking-tighter">Verified Provider</span>
                      </div>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                    onClick={() => handleRemoveRepo(url)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-6 border-border/50 bg-secondary/10 space-y-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="space-y-2">
              <h4 className="font-bold text-sm uppercase tracking-tight">Community Driven</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                We recommend using community-vetted repositories. Always be careful when adding custom URLs.
              </p>
            </div>
          </Card>
          <Card className="p-6 border-border/50 bg-secondary/10 space-y-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div className="space-y-2">
              <h4 className="font-bold text-sm uppercase tracking-tight">Legal Neutrality</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                By adding repositories, you acknowledge that you are responsible for the content you access.
              </p>
            </div>
          </Card>
        </div>
      </section>
    </div>
  )
}
