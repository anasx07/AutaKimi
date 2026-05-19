import { useState, useEffect } from 'react'
import { Puzzle, RefreshCcw } from 'lucide-react'
import { DataService } from '@renderer/shared/api'
import { SectionHeader, Card, SettingsRow, Switch } from '@renderer/shared/ui'

interface PluginManifest {
  id: string
  name: string
  description: string
  author: string
  version: string
  target: string
  enabled: boolean
}

export function PluginSettings(): React.JSX.Element {
  const [plugins, setPlugins] = useState<PluginManifest[]>([])
  const [loading, setLoading] = useState(true)
  const [repoCount, setRepoCount] = useState<number>(0)

  const loadPlugins = async () => {
    try {
      setLoading(true)
      const [data, repos] = await Promise.all([
        DataService.plugins.getAll(),
        DataService.sources.getRepos()
      ])
      setPlugins(data)
      setRepoCount(repos.length)
    } catch (e) {
      console.error('Failed to load plugins:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPlugins()
  }, [])

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      setPlugins((prev) => prev.map((p) => (p.id === id ? { ...p, enabled } : p)))
      await DataService.plugins.toggle(id, enabled)
    } catch (e) {
      console.error('Failed to toggle plugin:', e)
      // Revert on error
      loadPlugins()
    }
  }

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <SectionHeader title="Plugins" icon={Puzzle} />
          <button 
            onClick={loadPlugins} 
            className="p-2 hover:bg-secondary rounded-lg transition-colors group"
            disabled={loading}
          >
            <RefreshCcw className={`w-4 h-4 text-muted-foreground group-hover:text-foreground ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <Card className="p-1 border-border/40 bg-card/30 backdrop-blur-md">
          {plugins.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center gap-4">
               <div className="w-16 h-16 rounded-full bg-secondary/30 flex items-center justify-center ring-1 ring-border/50">
                  <Puzzle className="w-8 h-8 text-muted-foreground/40" />
               </div>
               <div className="space-y-1">
                  <p className="text-sm font-bold text-foreground">
                    {repoCount === 0 ? 'No repositories configured' : 'No plugins found'}
                  </p>
                  <p className="text-xs text-muted-foreground/70 max-w-sm leading-relaxed">
                    {repoCount === 0 
                      ? 'You need to add a source repository before you can install plugins.' 
                      : 'None of your configured repositories contain plugins. Try adding a repository that supports them.'}
                  </p>
               </div>
               
               {repoCount === 0 ? (
                 <button 
                   onClick={() => document.getElementById('settings-tab-sources')?.click()}
                   className="text-xs font-bold text-primary hover:underline flex items-center gap-1.5 mt-2"
                 >
                   Configure Sources <Puzzle className="w-3 h-3" />
                 </button>
               ) : (
                 <button 
                   onClick={() => DataService.sources.refreshAll().then(loadPlugins)}
                   className="text-xs font-bold text-primary hover:underline flex items-center gap-1.5 mt-2"
                 >
                   Refresh Repositories <RefreshCcw className="w-3 h-3" />
                 </button>
               )}
            </div>
          ) : (
            plugins.map((plugin) => (
              <SettingsRow
                key={plugin.id}
                title={
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold tracking-tight">{plugin.name}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono font-bold uppercase">
                        v{plugin.version}
                      </span>
                    </div>
                  </div>
                }
                description={
                  <div className="flex flex-col gap-2 mt-1">
                    <span className="leading-relaxed opacity-80">{plugin.description}</span>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                      <span>By: {plugin.author}</span>
                      <span>•</span>
                      <span>Target: {plugin.target}</span>
                    </div>
                  </div>
                }
              >
                <Switch 
                  checked={plugin.enabled} 
                  onCheckedChange={(val) => handleToggle(plugin.id, !!val)} 
                />
              </SettingsRow>
            ))
          )}
        </Card>
      </section>
    </div>
  )
}
