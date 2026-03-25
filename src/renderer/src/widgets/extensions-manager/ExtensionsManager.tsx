import { DataService } from '@renderer/shared/api'
import { useState } from 'react'
import { Search, Package, ExternalLink, Loader2, Check, X, ArrowUpAZ, ArrowDownAZ, ArrowUpDown, Sparkles, PackageCheck, ShieldCheck, Settings, Globe } from 'lucide-react'
import { cn } from '@renderer/shared/lib/utils'
import { useLibraryStore, useExtensionStore, useSettingsStore, useUIStore } from '@renderer/shared/model'
import { Button, Input, Card, Badge, Select } from '@renderer/shared/ui'

import localExtensions from '@renderer/shared/api/sources/Extensions.json'
import { getNativeSource, isFullySupported } from '@renderer/shared/api/sources'
import { DomainOverrideModal } from '@renderer/features/extension-management'

const LANGUAGE_NAMES: Record<string, string> = {
  all: 'Global',
  ar: 'العربية',
  bg: 'Български',
  ca: 'Català',
  cs: 'Čeština',
  de: 'Deutsch',
  en: 'English',
  es: 'Español',
  fr: 'Français',
  id: 'Bahasa Indonesia',
  it: 'Italiano',
  ja: '日本語',
  ko: '한국어',
  pl: 'Polski',
  'pt-br': 'Português (Brasil)',
  ru: 'Русский',
  th: 'ไทย',
  tr: 'Türkçe',
  uk: 'Українська',
  vi: 'Tiếng Việt',
  zh: '中文',
  'zh-hans': '简体中文',
  'zh-hant': '繁體中文'
}

interface Extension {
  name: string
  pkg: string
  version: string
  lang: string
  icon?: string
  nsfw?: number
  sources?: { name: string; lang: string; id: string; baseUrl: string }[]
}

export default function ExtensionsManager() {
  const {
    showNsfw, selectedLangs, setSelectedLangs
  } = useSettingsStore()

  const { loadFromDb } = useLibraryStore()
  const {
    installedExtensions, uninstallExtension, setActiveExtension,
    extensionSortBy, extensionSortOrder,
    setExtensionSortBy, setExtensionSortOrder
  } = useExtensionStore()
  const { setActiveTab: setGlobalActiveTab } = useUIStore()
  const [extensions] = useState<Extension[]>(localExtensions as Extension[])
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'installed' | 'all'>('installed')
  const [installStatuses, setInstallStatuses] = useState<Record<string, 'loading' | 'success' | 'error' | null>>({})
  const [editingExt, setEditingExt] = useState<Extension | null>(null)

  const uniqueLangs = [...new Set(extensions.map(ext => ext.lang).filter(l => l && l.toLowerCase() !== 'all'))].sort()
  const languages = ['all', ...uniqueLangs]

  const filteredExtensions = extensions.filter(ext => {
    const matchesSearch = ext.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ext.pkg.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesTab = activeTab === 'all' || installedExtensions.some(e => e.pkg === ext.pkg)
    const matchesLang = selectedLangs.includes('all') || selectedLangs.length === 0 || selectedLangs.includes(ext.lang)
    const matchesNsfw = showNsfw || !ext.nsfw

    return matchesSearch && matchesTab && matchesLang && matchesNsfw
  }).sort((a, b) => {
    if (extensionSortBy === 'supported') {
      const aSupp = isFullySupported(a.pkg) ? 1 : 0
      const bSupp = isFullySupported(b.pkg) ? 1 : 0
      if (aSupp !== bSupp) {
        return extensionSortOrder === 'asc' ? bSupp - aSupp : aSupp - bSupp
      }
      return a.name.localeCompare(b.name)
    }

    if (extensionSortBy === 'name') {
      return extensionSortOrder === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
    }
    if (extensionSortBy === 'installed') {
      const aInst = installedExtensions.some(e => e.pkg === a.pkg) ? 1 : 0
      const bInst = installedExtensions.some(e => e.pkg === b.pkg) ? 1 : 0
      if (aInst !== bInst) {
        return extensionSortOrder === 'asc' ? bInst - aInst : aInst - bInst
      }
      return a.name.localeCompare(b.name)
    }
    if (extensionSortBy === 'update') {
      const hasUpdate = (ext: Extension) => {
        const inst = installedExtensions.find(e => e.pkg === ext.pkg)
        return (inst && inst.version !== ext.version) ? 1 : 0
      }
      const aUpd = hasUpdate(a)
      const bUpd = hasUpdate(b)
      if (aUpd !== bUpd) return bUpd - aUpd
      return a.name.localeCompare(b.name)
    }
    return 0
  })

  // Helper to get local icon path
  const getIconPath = (ext: Extension) => {
    const pkg = ext.pkg
    if (ext.icon) return ext.icon.replace('https://', 'lmanwa-cache://')

    try {
      // 1. Try local asset first (bundled with the app)
      const localPath = new URL(`../../app/assets/Extensionicon/${pkg}.png`, import.meta.url).href
      if (localPath && !localPath.includes('undefined')) return localPath
    } catch (e) {}

    // No remote fallback - use our local protocol
    return `lmanwa-cache://local-icon/${pkg}.png`
  }

  return (
      <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Extension Catalog</h1>
          <p className="text-muted-foreground">Discover and install new sources to expand your library.</p>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-4 border-b border-border">
          {(['installed', 'all'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "pb-3 px-1 text-sm font-medium border-b-2 transition-colors capitalize",
                activeTab === tab
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab} Extensions ({tab === 'all' ? extensions.length : installedExtensions.length})
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search local extensions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 bg-secondary/10 p-1.5 rounded-md border border-border/40">
            <Globe className='text-primary' />
            <span className="text-xs text-muted-foreground">Language:</span>
            <Select
              className="h-8 w-[140px] text-xs font-medium p-1 items-center"
              dir='auto'
              value={selectedLangs[0] || 'all'}
              onValueChange={(value) => {
                setSelectedLangs([value])
              }}
              options={languages.map(lang => ({
                value: lang,
                label: LANGUAGE_NAMES[lang.toLowerCase()] || lang.toUpperCase()
              }))}
            />
          </div>

          {/* Sort Controls */}
          <div className="flex items-center gap-2 bg-secondary/10 p-1.5 rounded-md border border-border/40 ml-auto">
            <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground px-2">Sort:</span>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (extensionSortBy === 'supported') setExtensionSortOrder(extensionSortOrder === 'asc' ? 'desc' : 'asc')
                else { setExtensionSortBy('supported'); setExtensionSortOrder('asc') }
              }}
              className={cn(
                "h-8 gap-2 text-xs",
                extensionSortBy === 'supported' ? "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20" : "text-muted-foreground"
              )}
            >
              <ShieldCheck className="h-4 w-4" />
              Supported
              <ArrowUpDown className={cn("h-3 w-3 opacity-50", extensionSortBy === 'supported' && "opacity-100")} />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (extensionSortBy === 'name') setExtensionSortOrder(extensionSortOrder === 'asc' ? 'desc' : 'asc')
                else { setExtensionSortBy('name'); setExtensionSortOrder('asc') }
              }}
              className={cn(
                "h-8 gap-2 text-xs",
                extensionSortBy === 'name' ? "bg-primary/10 text-primary hover:bg-primary/20" : "text-muted-foreground"
              )}
            >
              {extensionSortOrder === 'asc' ? <ArrowUpAZ className="h-4 w-4" /> : <ArrowDownAZ className="h-4 w-4" />}
              Name
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (extensionSortBy === 'installed') setExtensionSortOrder(extensionSortOrder === 'asc' ? 'desc' : 'asc')
                else { setExtensionSortBy('installed'); setExtensionSortOrder('asc') }
              }}
              className={cn(
                "h-8 gap-2 text-xs",
                extensionSortBy === 'installed' ? "bg-primary/10 text-primary hover:bg-primary/20" : "text-muted-foreground"
              )}
            >
              <PackageCheck className="h-4 w-4" />
              Installed
              <ArrowUpDown className={cn("h-3 w-3 opacity-50", extensionSortBy === 'installed' && "opacity-100")} />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExtensionSortBy('update')}
              className={cn(
                "h-8 gap-2 text-xs",
                extensionSortBy === 'update' ? "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20" : "text-muted-foreground"
              )}
            >
              <Sparkles className="h-4 w-4" />
              Updates
            </Button>
          </div>
        </div>

        {activeTab === 'all' && searchQuery === '' && (
          <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-4 flex gap-4 items-start animate-in slide-in-from-top-4 duration-500">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
              <ShieldCheck className="h-5 w-5 text-emerald-500" />
            </div>
            <div className="flex-1 space-y-1">
              <h3 className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                Recommended Sources
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                We recommend using <strong>Native Supported</strong> extensions for the best reading experience.
                These sources are verified for ultra-fast performance, automatic updates, and maximum security.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredExtensions.map((ext) => (
            <Card key={ext.pkg} className="group p-4 hover:bg-secondary/40 transition-all duration-200">
              <div className="flex items-start gap-3">
                <div className="w-14 h-14 flex-shrink-0 rounded-lg bg-secondary flex items-center p-0.5 justify-center relative overflow-hidden ring-2 ring-border/50 group-hover:ring-primary/30 transition-all">
                  <img
                    src={getIconPath(ext)}
                    alt={ext.name}
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const fallback = e.currentTarget.parentElement?.querySelector('.fallback-icon');
                      if (fallback) fallback.classList.remove('hidden');
                    }}
                  />
                  <Package className="w-6 h-6 text-muted-foreground fallback-icon hidden" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground group-hover:text-primary transition-colors">{ext.name}</span>
                        {getNativeSource(ext.pkg) && (
                          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate opacity-70 max-w-[120px]">{ext.pkg}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {(() => {
                        const inst = installedExtensions.find(e => e.pkg === ext.pkg)
                        if (inst && inst.version !== ext.version) {
                          return (
                            <Badge className="bg-blue-500 hover:bg-blue-600 text-[10px] h-5 px-1.5 animate-pulse">
                              Update ⬆
                            </Badge>
                          )
                        }
                        return null
                      })()}
                      <Badge variant={ext.nsfw ? 'destructive' : 'secondary'} className="text-[9px] h-5">
                        {ext.lang.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 overflow-hidden">
                    {(() => {
                      const native = getNativeSource(ext.pkg)
                      const fullySupported = isFullySupported(ext.pkg)

                      if (native) {
                        return (
                          <div className="flex flex-wrap gap-1 items-center">
                            {fullySupported ? (
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-emerald-500/10 text-emerald-500 border-emerald-500/20 gap-1 font-bold">
                                SUPPORTED
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-amber-500/10 text-amber-500 border-amber-500/20 gap-1 font-bold">
                                NOT YET SUPPORTED
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-blue-500/10 text-blue-500 border-blue-500/20 font-medium whitespace-nowrap">
                              Native ⚡
                            </Badge>
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-blue-500/10 text-blue-500 border-blue-500/20 uppercase font-medium truncate max-w-[60px]">
                              {native.theme}
                            </Badge>
                          </div>
                        )
                      }
                      return null
                    })()}
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs font-mono text-muted-foreground">v{ext.version}</span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async (e) => {
                          e.stopPropagation()
                          const instExt = installedExtensions.find(e => e.pkg === ext.pkg)
                          const isInstalled = !!instExt
                          const hasUpdate = isInstalled && ext.version !== instExt.version

                          if (isInstalled && !hasUpdate) {
                            uninstallExtension(ext.pkg)
                          } else {
                            // Install or Update
                            setInstallStatuses(prev => ({ ...prev, [ext.pkg]: 'loading' }))
                            try {
                              await DataService.installExtension(ext, 'local')

                              await loadFromDb()
                              setInstallStatuses(prev => ({ ...prev, [ext.pkg]: 'success' }))
                              setTimeout(() => {
                                setInstallStatuses(prev => ({ ...prev, [ext.pkg]: null }))
                              }, 3000);
                            } catch (err) {
                              console.error('[ExtensionsManager] Local install failed:', err)
                              setInstallStatuses(prev => ({ ...prev, [ext.pkg]: 'error' }))
                              setTimeout(() => {
                                setInstallStatuses(prev => ({ ...prev, [ext.pkg]: null }))
                              }, 3000);
                            }
                          }
                        }}
                        className={cn(
                          "h-8 px-2 text-xs font-medium",
                          installedExtensions.some(e => e.pkg === ext.pkg) ? "text-red-400 hover:text-red-300" : "text-primary hover:underline hover:bg-transparent"
                        )}
                      >
                        {installStatuses[ext.pkg] === 'loading' && <Loader2 className="animate-spin h-3 w-3 mr-1" />}
                        {installStatuses[ext.pkg] === 'success' && <Check className="h-3 w-3 mr-1 text-green-500" />}
                        {installStatuses[ext.pkg] === 'error' && <X className="h-3 w-3 mr-1 text-red-500" />}
                        {installStatuses[ext.pkg] === 'loading' && 'Installing...'}
                        {installStatuses[ext.pkg] === 'success' && 'Installed!'}
                        {installStatuses[ext.pkg] === 'error' && 'Failed!'}
                        {!installStatuses[ext.pkg] && (
                          (() => {
                            const inst = installedExtensions.find(e => e.pkg === ext.pkg)
                            if (!inst) return 'Install'
                            if (inst.version !== ext.version) return 'Update'
                            return 'Uninstall'
                          })()
                        )}
                      </Button>
                      {installedExtensions.some(e => e.pkg === ext.pkg) && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setActiveExtension(ext.pkg)
                              setGlobalActiveTab('browse')
                            }}
                            className="h-8 px-2 text-xs text-green-400 hover:text-green-300 hover:underline hover:bg-transparent"
                          >
                            Browse <ExternalLink className="ml-1 h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingExt(ext)}
                            className="h-8 px-2 text-muted-foreground hover:text-primary hover:bg-transparent"
                            title="Extension Settings"
                          >
                            <Settings className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {editingExt && (
          <DomainOverrideModal
            isOpen={!!editingExt}
            onClose={() => setEditingExt(null)}
            pkg={editingExt.pkg}
            name={editingExt.name}
            defaultDomain={localExtensions.find(e => e.pkg === editingExt.pkg)?.sources?.[0]?.baseUrl || ''}
          />
        )}

        {filteredExtensions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground space-y-4 animate-in fade-in zoom-in-95 duration-300">
            <div className="h-20 w-20 rounded-full bg-secondary/50 flex items-center justify-center ring-1 ring-border shadow-sm">
              <Package className="h-10 w-10 text-muted-foreground/70" />
            </div>
            <div className="text-center space-y-1 max-w-sm">
              <h3 className="text-lg font-semibold text-foreground">
                {activeTab === 'installed' ? 'No Extensions Installed' : 'No Extensions Found'}
              </h3>
              <p className="text-sm">
                {activeTab === 'installed'
                  ? 'You haven\'t installed any extensions yet. Browse the full catalog to add sources.'
                  : 'Try adjusting your search query or language filters to find what you\'re looking for.'}
              </p>
            </div>
            {activeTab === 'installed' && (
              <Button onClick={() => setActiveTab('all')} variant="primary" className="mt-2 text-primary-foreground">
                Browse All Extensions
              </Button>
            )}
          </div>
        )}
      </div>
    )
  }
