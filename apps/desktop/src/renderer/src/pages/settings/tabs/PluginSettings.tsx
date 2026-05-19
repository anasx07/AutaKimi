import { useState, useEffect } from 'react'
import { Puzzle, RefreshCcw } from 'lucide-react'
import { DataService } from '@renderer/shared/api'
import { SectionHeader, Card, SettingsRow, Switch } from '@renderer/shared/ui'
import { useUIStore } from '@renderer/shared/model'

interface PluginManifest {
  id: string
  name: string
  description: string
  author: string
  version: string
  target: string
  enabled: boolean
  installed?: boolean
  updateAvailable?: boolean
  installable?: boolean
  code?: string
}

export function PluginSettings(): React.JSX.Element {
  const [plugins, setPlugins] = useState<PluginManifest[]>([])
  const [loading, setLoading] = useState(true)
  const [repoCount, setRepoCount] = useState<number>(0)

  const loadPlugins = async () => {
    try {
      setLoading(true)
      
      let repos: string[] = []
      try {
        repos = await DataService.sources.getRepos()
        setRepoCount(repos.length)
      } catch (err) {
        console.error('Failed to load repos:', err)
      }

      let data: PluginManifest[] = []
      try {
        data = await DataService.plugins.getAll()
        setPlugins(data)
      } catch (err) {
        console.error('Failed to load plugins:', err)
      }

      // Proactive Update & Refresh Toast Notification Checks
      try {
        const { addToast } = useUIStore.getState()
        
        // 1. Toast for Installable Plugins / Sources needing manual updates
        const installableUpdates = data.filter((p) => p.installed && p.updateAvailable && p.installable)
        if (installableUpdates.length > 0) {
          addToast({
            type: 'info',
            title: 'Plugin Updates Available',
            message: 'Available plugins/sources need to be updated. Please click the Update button.',
            duration: 7000
          })
        }

        // 2. Toast for Non-Installable (online-only) Plugins & Scrapers requiring a repository refresh
        const catalog = await DataService.getExtensionsCatalog()
        const installed = await DataService.db.getExtensions()
        const hasSourceUpdates = installed.some((inst) => {
          const remote = catalog.find((c) => c.pkg === inst.pkg)
          return remote && remote.version !== inst.version
        })
        
        const hasNonInstallableUpdates = data.some((p) => !p.installable && p.updateAvailable)

        if (hasSourceUpdates || hasNonInstallableUpdates) {
          addToast({
            type: 'info',
            title: 'Refresh Required',
            message: 'Manga/Anime sources and online plugins need a refresh. Please go and click the "Refresh Repositories" button.',
            duration: 9000
          })
        }
      } catch (err) {
        console.error('Failed to analyze updates for toast notifications:', err)
      }
      
    } catch (e) {
      console.error('Fatal load error:', e)
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

  const handleInstall = async (plugin: PluginManifest) => {
    try {
      setLoading(true)
      await DataService.plugins.install(plugin)
      await loadPlugins()
    } catch (e) {
      console.error('Failed to install plugin:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleUninstall = async (id: string) => {
    try {
      setLoading(true)
      await DataService.plugins.uninstall(id)
      await loadPlugins()
    } catch (e) {
      console.error('Failed to uninstall plugin:', e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <SectionHeader title="Plugins" icon={Puzzle} />
          <div className="flex items-center gap-2">
            {repoCount > 0 && (
              <button 
                onClick={async () => {
                  try {
                    setLoading(true)
                    await DataService.sources.refreshAll()
                    await loadPlugins()
                  } catch (e) {
                    console.error('Failed to refresh repositories:', e)
                  } finally {
                    setLoading(false)
                  }
                }}
                disabled={loading}
                className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-secondary hover:bg-secondary/80 text-foreground border border-border/40 flex items-center gap-1.5 transition-all"
              >
                Refresh Repositories <RefreshCcw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              </button>
            )}
            <button 
              onClick={loadPlugins} 
              className="p-2 hover:bg-secondary rounded-lg transition-colors group"
              disabled={loading}
            >
              <RefreshCcw className={`w-4 h-4 text-muted-foreground group-hover:text-foreground ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
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
                      {plugin.installed && plugin.updateAvailable && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 font-mono font-bold uppercase animate-pulse border border-amber-500/20">
                          Update Available
                        </span>
                      )}
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
                <div className="flex items-center gap-4">
                  {!plugin.installable ? (
                    <Switch 
                      checked={plugin.enabled} 
                      onCheckedChange={(val) => handleToggle(plugin.id, !!val)} 
                    />
                  ) : plugin.installed ? (
                    <>
                      {plugin.updateAvailable && (
                        <button
                          onClick={() => handleInstall(plugin)}
                          disabled={loading}
                          className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-amber-500 hover:bg-amber-500/90 text-black font-bold transition-all shadow-lg shadow-amber-500/20 animate-pulse"
                        >
                          Update
                        </button>
                      )}
                      <button
                        onClick={() => handleUninstall(plugin.id)}
                        disabled={loading}
                        className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/20 transition-all"
                      >
                        Uninstall
                      </button>
                      <Switch 
                        checked={plugin.enabled} 
                        onCheckedChange={(val) => handleToggle(plugin.id, !!val)} 
                      />
                    </>
                  ) : (
                    <button
                      onClick={() => handleInstall(plugin)}
                      disabled={loading}
                      className="px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-primary hover:bg-primary/90 text-primary-foreground transition-all shadow-lg shadow-primary/20"
                    >
                      Install
                    </button>
                  )}
                </div>
              </SettingsRow>
            ))
          )}
        </Card>
      </section>
    </div>
  )
}
