import React, { useState, useEffect, useMemo } from 'react'
import {
  Globe,
  Plus,
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Folder,
  Puzzle,
  RefreshCcw,
  ExternalLink,
  Layers,
  ArrowUpCircle
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { extensionKeys } from '@renderer/entities/extension/api/useExtensionQueries'
import { Button, Card, SectionHeader, Badge, SettingsRow, Switch } from '@renderer/shared/ui'
import { DataService } from '@renderer/shared/api'
import { useSettingsStore, useUIStore } from '@renderer/shared/model'
import { cn } from '@renderer/shared/lib/utils'

interface PluginManifest {
  id: string
  name: string
  description: string
  author: string
  version: string
  installedVersion?: string
  target: string
  enabled: boolean
  installed?: boolean
  updateAvailable?: boolean
  installable?: boolean
  code?: string
}

export interface RepositoriesPageProps {
  hideHeader?: boolean
  onRepoCountChange?: (count: number) => void
  onPluginUpdatesCountChange?: (count: number) => void
}

export default function RepositoriesPage({
  hideHeader = true,
  onRepoCountChange,
  onPluginUpdatesCountChange
}: RepositoriesPageProps = {}): React.JSX.Element {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { devMode, setBrowseSection } = useSettingsStore()
  const [subTab, setSubTab] = useState<'repos' | 'plugins'>('repos')

  // Repositories State
  const [repos, setRepos] = useState<string[]>([])
  const [newRepoUrl, setNewRepoUrl] = useState('')
  const [isLoadingRepo, setIsLoadingRepo] = useState(false)
  const [repoError, setRepoError] = useState<string | null>(null)
  const [suggestion, setSuggestion] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  // Plugins State
  const [plugins, setPlugins] = useState<PluginManifest[]>([])
  const [loadingPlugins, setLoadingPlugins] = useState(true)
  const [updatingPluginId, setUpdatingPluginId] = useState<string | null>(null)
  const [updatingAllPlugins, setUpdatingAllPlugins] = useState(false)

  const pluginUpdates = useMemo(
    () => plugins.filter((p) => p.installed && p.updateAvailable),
    [plugins]
  )
  const pluginUpdatesCount = pluginUpdates.length

  const handleUpdatePlugin = async (plugin: PluginManifest) => {
    try {
      setUpdatingPluginId(plugin.id)
      await DataService.plugins.install(plugin)
      await loadPlugins()
      useUIStore.getState().addToast({
        type: 'success',
        message: `Updated "${plugin.name}" to v${plugin.version}`
      })
    } catch (e: any) {
      console.error(`Failed to update plugin ${plugin.name}:`, e)
      useUIStore.getState().addToast({
        type: 'error',
        message: `Failed to update "${plugin.name}": ${e?.message || 'Unknown error'}`
      })
    } finally {
      setUpdatingPluginId(null)
    }
  }

  const handleUpdateAllPlugins = async () => {
    if (pluginUpdates.length === 0) return
    const count = pluginUpdates.length
    try {
      setUpdatingAllPlugins(true)
      for (const p of pluginUpdates) {
        await DataService.plugins.install(p)
      }
      await loadPlugins()
      useUIStore.getState().addToast({
        type: 'success',
        message: `Updated ${count} ${count === 1 ? 'plugin' : 'plugins'} successfully`
      })
    } catch (e: any) {
      console.error('Failed to update all plugins:', e)
      useUIStore.getState().addToast({
        type: 'error',
        message: `Failed to update plugins: ${e?.message || 'Unknown error'}`
      })
    } finally {
      setUpdatingAllPlugins(false)
    }
  }

  const fetchRepos = async () => {
    try {
      const list = await DataService.sources.getRepos()
      const arr = Array.isArray(list) ? list : []
      setRepos(arr)
      onRepoCountChange?.(arr.length)
    } catch (e) {
      console.error('Failed to fetch repos', e)
    }
  }

  const loadPlugins = async () => {
    try {
      setLoadingPlugins(true)
      let data: PluginManifest[] = []
      try {
        data = await DataService.plugins.getAll()
        setPlugins(data)
        const updatesCount = (data || []).filter((p) => p.installed && p.updateAvailable).length
        onPluginUpdatesCountChange?.(updatesCount)
      } catch (err) {
        console.error('Failed to load plugins:', err)
      }
    } catch (e) {
      console.error('Fatal load error:', e)
    } finally {
      setLoadingPlugins(false)
    }
  }

  useEffect(() => {
    fetchRepos()
    loadPlugins()
  }, [])

  const getGithubRawSuggestion = (url: string): string | null => {
    try {
      const parsed = new URL(url)
      if (parsed.hostname === 'github.com') {
        const parts = parsed.pathname.split('/').filter(Boolean)
        if (parts.length >= 2) {
          const user = parts[0]
          const repo = parts[1]
          if (parts[2] === 'blob' && parts.length >= 4) {
            const branchAndPath = parts.slice(3).join('/')
            return `https://raw.githubusercontent.com/${user}/${repo}/${branchAndPath}`
          } else if (parts.length === 2 || (parts.length >= 3 && parts[2] === 'tree')) {
            const branch = parts.length >= 4 && parts[2] === 'tree' ? parts[3] : 'main'
            return `https://raw.githubusercontent.com/${user}/${repo}/${branch}/templates.json`
          }
        }
      }
      return null
    } catch {
      return null
    }
  }

  const submitRepo = async (url: string) => {
    setIsLoadingRepo(true)
    setRepoError(null)
    setSuggestion(null)
    try {
      const res = await DataService.sources.addRepo(url)
      if (res.success) {
        setNewRepoUrl('')
        await fetchRepos()
        await DataService.sources.refreshAll()
        await queryClient.invalidateQueries({ queryKey: extensionKeys.all })
        await loadPlugins()
      } else {
        setRepoError((res as any).error || 'Failed to add repository')
      }
    } catch (e: any) {
      setRepoError(e.message)
    } finally {
      setIsLoadingRepo(false)
    }
  }

  const handleAddRepo = async () => {
    if (!newRepoUrl.trim()) return
    const url = newRepoUrl.trim()
    const rawSuggestion = getGithubRawSuggestion(url)
    if (rawSuggestion) {
      setSuggestion(rawSuggestion)
      return
    }
    await submitRepo(url)
  }

  const handleSelectLocalDir = async () => {
    setIsLoadingRepo(true)
    setRepoError(null)
    try {
      const result = await (window.api as any).sources.selectDirectory()
      const localPath = typeof result === 'string' ? result : result?.value
      if (localPath && typeof localPath === 'string') {
        await submitRepo(localPath)
      }
    } catch (e: any) {
      setRepoError(e.message)
    } finally {
      setIsLoadingRepo(false)
    }
  }

  const handleRemoveRepo = async (url: string) => {
    try {
      await DataService.sources.removeRepo(url)
      await queryClient.invalidateQueries({ queryKey: extensionKeys.all })
      await fetchRepos()
      await loadPlugins()
    } catch (e) {
      console.error('Failed to remove repo', e)
    }
  }

  const handleRefreshAll = async () => {
    setRefreshing(true)
    try {
      await DataService.sources.refreshAll()
      await queryClient.invalidateQueries({ queryKey: extensionKeys.all })
      await loadPlugins()
    } catch (e) {
      console.error('Failed to refresh repositories', e)
    } finally {
      setRefreshing(false)
    }
  }

  const handleTogglePlugin = async (id: string, enabled: boolean) => {
    try {
      setPlugins((prev) => prev.map((p) => (p.id === id ? { ...p, enabled } : p)))
      await DataService.plugins.toggle(id, enabled)
    } catch (e) {
      console.error('Failed to toggle plugin:', e)
      loadPlugins()
    }
  }

  const handleInstallPlugin = async (plugin: PluginManifest) => {
    try {
      setLoadingPlugins(true)
      await DataService.plugins.install(plugin)
      await loadPlugins()
    } catch (e) {
      console.error('Failed to install plugin:', e)
    } finally {
      setLoadingPlugins(false)
    }
  }

  const handleUninstallPlugin = async (id: string) => {
    try {
      setLoadingPlugins(true)
      await DataService.plugins.uninstall(id)
      await loadPlugins()
    } catch (e) {
      console.error('Failed to uninstall plugin:', e)
    } finally {
      setLoadingPlugins(false)
    }
  }

  const handleNavigateToCatalog = () => {
    setBrowseSection('extensions')
    navigate('/browse')
  }

  return (
    <div className={cn('space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10', !hideHeader && 'space-y-8')}>
      {/* Top Header with Quick Actions */}
      {!hideHeader ? (
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <SectionHeader title="Repositories & Addons" icon={Globe} />
            
            <div className="flex items-center gap-2.5">
              <Button
                variant="outline"
                size="sm"
                onClick={handleNavigateToCatalog}
                className="gap-2 text-xs font-bold border-border/60 bg-secondary/30 hover:bg-secondary/70 h-9 rounded-xl transition-all"
              >
                <Layers className="h-3.5 w-3.5 text-primary" />
                Extensions Catalog
                <ExternalLink className="h-3 w-3 opacity-50" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefreshAll}
                disabled={refreshing}
                className="gap-2 text-xs font-bold uppercase tracking-wider h-9 rounded-xl"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
                Refresh All
              </Button>
            </div>
          </div>

          {/* Sub-Tabs Switcher */}
          <div className="flex items-center gap-2 p-1 bg-secondary/30 border border-border/40 rounded-2xl w-fit">
            <button
              onClick={() => setSubTab('repos')}
              className={cn(
                'px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2',
                subTab === 'repos'
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-100'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              )}
            >
              <Globe className="h-3.5 w-3.5" />
              Repositories
              <span
                className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold',
                  subTab === 'repos'
                    ? 'bg-white/20 text-white'
                    : 'bg-secondary text-muted-foreground'
                )}
              >
                {repos.length}
              </span>
            </button>

            <button
              onClick={() => setSubTab('plugins')}
              className={cn(
                'px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2',
                subTab === 'plugins'
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-100'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              )}
            >
              <Puzzle className="h-3.5 w-3.5" />
              Plugins
              <span
                className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold',
                  subTab === 'plugins'
                    ? 'bg-white/20 text-white'
                    : 'bg-secondary text-muted-foreground'
                )}
              >
                {plugins.length}
              </span>
              {pluginUpdatesCount > 0 && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500 text-black font-black uppercase tracking-wider animate-pulse shadow-sm">
                  {pluginUpdatesCount} {pluginUpdatesCount === 1 ? 'update' : 'updates'}
                </span>
              )}
            </button>
          </div>
        </section>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          {/* Sub-Tabs Switcher */}
          <div className="flex items-center gap-2 p-1 bg-secondary/30 border border-border/40 rounded-2xl w-fit">
            <button
              onClick={() => setSubTab('repos')}
              className={cn(
                'px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2',
                subTab === 'repos'
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-100'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              )}
            >
              <Globe className="h-3.5 w-3.5" />
              Repositories
              <span
                className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold',
                  subTab === 'repos'
                    ? 'bg-white/20 text-white'
                    : 'bg-secondary text-muted-foreground'
                )}
              >
                {repos.length}
              </span>
            </button>

            <button
              onClick={() => setSubTab('plugins')}
              className={cn(
                'px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2',
                subTab === 'plugins'
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-100'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              )}
            >
              <Puzzle className="h-3.5 w-3.5" />
              Plugins
              <span
                className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold',
                  subTab === 'plugins'
                    ? 'bg-white/20 text-white'
                    : 'bg-secondary text-muted-foreground'
                )}
              >
                {plugins.length}
              </span>
              {pluginUpdatesCount > 0 && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500 text-black font-black uppercase tracking-wider animate-pulse shadow-sm">
                  {pluginUpdatesCount} {pluginUpdatesCount === 1 ? 'update' : 'updates'}
                </span>
              )}
            </button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefreshAll}
            disabled={refreshing}
            className="gap-2 text-xs font-bold uppercase tracking-wider h-9 rounded-xl w-fit"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            Refresh Repositories
          </Button>
        </div>
      )}

      {/* ─── TAB 1: REPOSITORIES ─── */}
      {subTab === 'repos' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <Card className="p-6 md:p-8 border-border bg-card shadow-none space-y-6 rounded-2xl">
            <div className="space-y-2">
              <h3 className="text-lg md:text-xl font-black uppercase tracking-tight text-foreground flex items-center gap-2">
                Extension Repositories
              </h3>
              <p className="text-xs md:text-sm text-muted-foreground leading-relaxed max-w-2xl">
                AutaKimi is an open-source, neutral media platform. Add community repository URLs
                (AutaKimi manifest.json or Keiyoushi index.min.json) to discover and install manga/anime scrapers and plugins.
              </p>
            </div>

            {/* Input Row */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="https://example.com/manifest.json or index.min.json"
                  className="w-full bg-secondary/30 border border-border/50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-mono text-xs"
                  value={newRepoUrl}
                  onChange={(e) => {
                    setNewRepoUrl(e.target.value)
                    if (suggestion) setSuggestion(null)
                    if (repoError) setRepoError(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddRepo()
                  }}
                />
              </div>
              <Button
                onClick={handleAddRepo}
                disabled={isLoadingRepo || !newRepoUrl.trim()}
                className="gap-2 font-bold px-6 shrink-0 h-11 rounded-xl"
              >
                {isLoadingRepo ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Add Repository
              </Button>
              {devMode && (
                <Button
                  variant="outline"
                  onClick={handleSelectLocalDir}
                  disabled={isLoadingRepo}
                  className="gap-2 font-bold px-5 border-dashed border-primary/40 text-primary hover:bg-primary/5 hover:border-primary shrink-0 h-11 rounded-xl"
                >
                  <Folder className="h-4 w-4" />
                  Load Local (manifest.json)
                </Button>
              )}
            </div>

            {/* Error Message */}
            {repoError && (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl flex items-center gap-3 text-destructive text-sm animate-in shake duration-500">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {repoError}
              </div>
            )}

            {/* GitHub URL Auto-fix Suggestion */}
            {suggestion && (
              <div className="p-4 bg-primary/10 border border-primary/20 rounded-xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-primary">Bad URL Format Detected</p>
                    <p className="text-xs text-primary/80">
                      We noticed you entered a GitHub web URL instead of the raw JSON file. Would you like to use this direct link?
                    </p>
                    <p className="text-xs font-mono bg-background/50 p-2 rounded-lg text-primary/80 mt-1 break-all">
                      {suggestion}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1 ml-8">
                  <Button
                    size="sm"
                    className="h-8 text-xs font-bold rounded-lg"
                    onClick={() => {
                      setNewRepoUrl(suggestion)
                      submitRepo(suggestion)
                    }}
                  >
                    Apply Fix & Add
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs font-bold border-primary/20 text-primary hover:bg-primary/10 rounded-lg"
                    onClick={() => submitRepo(newRepoUrl.trim())}
                  >
                    Add Original Anyway
                  </Button>
                </div>
              </div>
            )}

            {/* Repositories List */}
            <div className="space-y-3 pt-2">
              {repos.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-border/50 rounded-2xl space-y-3">
                  <Globe className="h-10 w-10 text-muted-foreground/30 mx-auto" />
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-foreground">No repositories configured yet</p>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                      Add a community manifest URL above to unlock thousands of manga and anime sources.
                    </p>
                  </div>
                </div>
              ) : (
                repos.map((url) => {
                  const isLocal = !url.startsWith('http://') && !url.startsWith('https://')
                  const isKeiyoushi =
                    url.toLowerCase().includes('keiyoushi') ||
                    url.toLowerCase().includes('index.min.json')

                  return (
                    <div
                      key={url}
                      className="flex items-center justify-between p-4 bg-secondary/20 border border-border/50 rounded-2xl group hover:border-primary/30 transition-all gap-4"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                          {isLocal ? <Folder className="h-5 w-5" /> : <Globe className="h-5 w-5" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs md:text-sm font-bold truncate pr-2 font-mono">
                            {url}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            {isLocal ? (
                              <>
                                <Badge className="bg-amber-500/10 text-amber-500 border-none text-[9px] uppercase font-black px-1.5 py-0">
                                  Local Dev
                                </Badge>
                                <span className="text-[10px] text-muted-foreground opacity-50 uppercase font-bold tracking-tight">
                                  Developer Manifest
                                </span>
                              </>
                            ) : isKeiyoushi ? (
                              <>
                                <Badge className="bg-purple-500/10 text-purple-500 border-none text-[9px] uppercase font-black px-1.5 py-0">
                                  Keiyoushi Repo
                                </Badge>
                                <span className="text-[10px] text-muted-foreground opacity-50 uppercase font-bold tracking-tight">
                                  Community Manga Ecosystem
                                </span>
                              </>
                            ) : (
                              <>
                                <Badge className="bg-green-500/10 text-green-500 border-none text-[9px] uppercase font-black px-1.5 py-0">
                                  AutaKimi Repo
                                </Badge>
                                <span className="text-[10px] text-muted-foreground opacity-50 uppercase font-bold tracking-tight">
                                  Official Specification
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 h-9 w-9 rounded-xl"
                        onClick={() => handleRemoveRepo(url)}
                        title="Remove repository"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )
                })
              )}
            </div>
          </Card>

          {/* Educational Bento Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-5 border-border/50 bg-secondary/10 space-y-3 rounded-2xl">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-xs uppercase tracking-tight text-foreground">
                  Where to find sources?
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  After adding a repository, head over to <strong>Browse &gt; Extensions</strong> to install and update your preferred manga and anime extractors.
                </p>
              </div>
            </Card>

            <Card className="p-5 border-border/50 bg-secondary/10 space-y-3 rounded-2xl">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <AlertCircle className="h-4 w-4" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-xs uppercase tracking-tight text-foreground">
                  Neutral Platform Guarantee
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  AutaKimi does not host content. We provide a decentralized browser architecture that executes community extensions client-side.
                </p>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ─── TAB 2: PLUGINS ─── */}
      {subTab === 'plugins' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Proactive Plugin Updates Banner */}
          {pluginUpdatesCount > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl animate-in fade-in">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
                  <ArrowUpCircle className="w-5 h-5" />
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-sm font-bold text-foreground">
                    {pluginUpdatesCount} Plugin {pluginUpdatesCount === 1 ? 'Update' : 'Updates'} Available
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Newer versions of your installed system plugins are available from your repositories.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={handleUpdateAllPlugins}
                disabled={updatingAllPlugins}
                className="h-9 px-4 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-black shadow-md shadow-amber-500/20 gap-2 shrink-0"
              >
                {updatingAllPlugins ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowUpCircle className="w-4 h-4" />
                )}
                Update All ({pluginUpdatesCount})
              </Button>
            </div>
          )}

          <Card className="p-1 border-border/50 bg-card/40 backdrop-blur-md rounded-2xl overflow-hidden divide-y divide-border/40">
            {plugins.length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center justify-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-secondary/40 flex items-center justify-center ring-1 ring-border/50 text-muted-foreground/40">
                  <Puzzle className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-foreground">
                    {repos.length === 0 ? 'No repositories configured' : 'No plugins detected'}
                  </p>
                  <p className="text-xs text-muted-foreground/70 max-w-sm leading-relaxed">
                    {repos.length === 0
                      ? 'Add a source repository first to automatically discover available system plugins.'
                      : 'None of your active repositories contain standalone plugins. Repositories primarily provide manga and anime scrapers.'}
                  </p>
                </div>

                {repos.length === 0 ? (
                  <Button
                    onClick={() => setSubTab('repos')}
                    className="text-xs font-bold gap-2 mt-2 rounded-xl"
                  >
                    <Plus className="w-3.5 h-3.5" /> Configure Repositories
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={handleRefreshAll}
                    className="text-xs font-bold gap-2 mt-2 rounded-xl"
                  >
                    <RefreshCcw className="w-3.5 h-3.5" /> Refresh Repositories
                  </Button>
                )}
              </div>
            ) : (
              plugins.map((plugin) => (
                <SettingsRow
                  key={plugin.id}
                  title={
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold tracking-tight text-sm">{plugin.name}</span>
                        {plugin.installed && plugin.installedVersion && plugin.updateAvailable ? (
                          <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold">
                            <span className="px-1.5 py-0.5 rounded-md bg-secondary text-muted-foreground">
                              v{plugin.installedVersion}
                            </span>
                            <span className="text-amber-500 font-bold">→</span>
                            <span className="px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-500">
                              v{plugin.version}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-mono font-bold uppercase">
                            v{plugin.version}
                          </span>
                        )}
                        {plugin.installed ? (
                          <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-mono font-bold uppercase border border-emerald-500/20">
                            Installed
                          </span>
                        ) : (
                          <span className="text-[9px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-mono font-bold uppercase border border-border/40">
                            Available
                          </span>
                        )}
                        {plugin.installed && plugin.updateAvailable && (
                          <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500 font-mono font-bold uppercase animate-pulse border border-amber-500/30">
                            Update Available
                          </span>
                        )}
                      </div>
                    </div>
                  }
                  description={
                    <div className="flex flex-col gap-1.5 mt-1">
                      <span className="text-xs leading-relaxed text-muted-foreground">
                        {plugin.description}
                      </span>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60 font-medium uppercase tracking-wider">
                        <span>By: {plugin.author}</span>
                        <span>•</span>
                        <span>Target: {plugin.target}</span>
                      </div>
                    </div>
                  }
                >
                  <div className="flex items-center gap-2.5">
                    {!plugin.installable ? (
                      <Switch
                        checked={plugin.enabled}
                        onCheckedChange={(val) => handleTogglePlugin(plugin.id, !!val)}
                      />
                    ) : plugin.installed ? (
                      <>
                        {plugin.updateAvailable && (
                          <Button
                            size="sm"
                            onClick={() => handleUpdatePlugin(plugin)}
                            disabled={updatingPluginId === plugin.id || updatingAllPlugins}
                            className="h-8 px-3.5 rounded-xl text-[10px] font-black uppercase tracking-wider bg-amber-500 hover:bg-amber-600 text-black shadow-md shadow-amber-500/20 gap-1.5 animate-pulse"
                          >
                            {updatingPluginId === plugin.id ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <ArrowUpCircle className="w-3.5 h-3.5" />
                            )}
                            Update to v{plugin.version}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleUninstallPlugin(plugin.id)}
                          disabled={loadingPlugins || updatingPluginId === plugin.id || updatingAllPlugins}
                          className="h-8 px-3 rounded-xl text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          Uninstall
                        </Button>
                        <Switch
                          checked={plugin.enabled}
                          onCheckedChange={(val) => handleTogglePlugin(plugin.id, !!val)}
                        />
                      </>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleInstallPlugin(plugin)}
                        disabled={loadingPlugins}
                        className="px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest"
                      >
                        Install
                      </Button>
                    )}
                  </div>
                </SettingsRow>
              ))
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
