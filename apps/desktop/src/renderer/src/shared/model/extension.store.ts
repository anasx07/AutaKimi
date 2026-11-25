import { create } from 'zustand'
import { DataService } from '@renderer/shared/api'
import { SettingsSchema, Extension } from '@common/types'
import { resolveInstallPayload } from '../../entities/extension/lib/updates'
export type ExtensionMetadata = Extension

type ExtensionState = SettingsSchema['extensions'] & {
  installedExtensions: Extension[]
  activeExtension: string | null
  installingPkgs: Set<string>

  // Actions
  setInstalledExtensions: (exts: Extension[]) => void
  setActiveExtension: (pkg: string | null) => void
  setDomainOverrides: (overrides: Record<string, string>) => void
  setExtensionSortBy: (val: 'name' | 'installed' | 'update' | 'supported') => Promise<void>
  setExtensionSortOrder: (val: 'asc' | 'desc') => Promise<void>
  setDomainOverride: (pkg: string, domain: string | null) => Promise<void>
  loadInstalled: () => Promise<void>
  uninstallExtension: (pkg: string) => Promise<void>
  installExtension: (ext: Extension) => Promise<void>
  togglePin: (pkg: string) => Promise<void>
  toggleAnimePin: (pkg: string) => Promise<void>

  // Init
  _init: (installed: Extension[], settings: SettingsSchema['extensions']) => void
}

export const useExtensionStore = create<ExtensionState>((set, get) => ({
  installedExtensions: [],
  pinnedExtensions: [],
  pinnedAnimeSources: [],
  activeExtension: null,
  installingPkgs: new Set(),
  extensionSortBy: 'supported',
  extensionSortOrder: 'asc',
  domainOverrides: {},
  pluginsEnabled: [],

  setInstalledExtensions: (installedExtensions) => set({ installedExtensions }),
  setActiveExtension: (activeExtension) => set({ activeExtension }),
  setDomainOverrides: (domainOverrides) => set({ domainOverrides }),

  setExtensionSortBy: async (val) => {
    await DataService.db.setSetting('extension_sort_by', val)
    set({ extensionSortBy: val })
  },

  setExtensionSortOrder: async (val) => {
    await DataService.db.setSetting('extension_sort_order', val)
    set({ extensionSortOrder: val })
  },

  setDomainOverride: async (pkg, domain) => {
    await DataService.db.setSetting(`domain_override_${pkg}`, domain || '')
    set((state) => ({
      domainOverrides: { ...state.domainOverrides, [pkg]: domain || '' }
    }))
  },

  loadInstalled: async () => {
    const installed = await DataService.db.getInstalledExtensions()
    set({ installedExtensions: installed || [] })
  },

  uninstallExtension: async (pkg) => {
    await DataService.db.removeExtension(pkg)
    const state = get()
    const currentPinned = Array.isArray(state.pinnedExtensions) ? state.pinnedExtensions : []
    const currentAnime = Array.isArray(state.pinnedAnimeSources) ? state.pinnedAnimeSources : []
    const nextPinned = currentPinned.filter((p: string) => p !== pkg)
    const nextAnime = currentAnime.filter((p: string) => p !== pkg)

    const jsonPinned = JSON.stringify(nextPinned)
    await Promise.all([
      DataService.db.setSetting('pinned_extensions', jsonPinned),
      DataService.db.setSetting('pinnedAnimeSources', jsonPinned),
      DataService.db.setSetting('pinned_anime_sources', jsonPinned)
    ]).catch(() => {})

    set({
      installedExtensions: state.installedExtensions.filter((e: Extension) => e.pkg !== pkg),
      pinnedExtensions: nextPinned,
      pinnedAnimeSources: nextAnime
    })
  },

  installExtension: async (ext) => {
    const targetExt = resolveInstallPayload(ext, get().installedExtensions || [])
    const pkg = targetExt.pkg
    set((state) => ({ installingPkgs: new Set(state.installingPkgs).add(pkg) }))

    try {
      await DataService.installExtension(targetExt, targetExt.repoUrl || 'local')

      // Refresh installed list
      const installed = await DataService.db.getInstalledExtensions()
      set((state) => {
        const nextInstalling = new Set(state.installingPkgs)
        nextInstalling.delete(pkg)
        return {
          installedExtensions: installed || [],
          installingPkgs: nextInstalling
        }
      })
    } catch (e) {
      set((state) => {
        const nextInstalling = new Set(state.installingPkgs)
        nextInstalling.delete(pkg)
        return { installingPkgs: nextInstalling }
      })
      console.error('Failed to install extension:', e)
      throw e
    }
  },

  togglePin: async (pkg) => {
    const state = get()
    const currentPinned = Array.isArray(state.pinnedExtensions) ? state.pinnedExtensions : []
    const isPinned = currentPinned.includes(pkg)
    const nextPinned = isPinned
      ? currentPinned.filter((p: string) => p !== pkg)
      : [...currentPinned, pkg]

    // Persist as JSON array string
    const jsonPinned = JSON.stringify(nextPinned)
    await Promise.all([
      DataService.db.setSetting('pinned_extensions', jsonPinned),
      DataService.db.setSetting('pinnedAnimeSources', jsonPinned),
      DataService.db.setSetting('pinned_anime_sources', jsonPinned)
    ]).catch((err) => console.error('Failed to persist pinned extensions:', err))

    set({
      pinnedExtensions: nextPinned,
      pinnedAnimeSources: nextPinned
    })
  },

  toggleAnimePin: async (pkg): Promise<void> => {
    return get().togglePin(pkg)
  },

  _init: (installed, settings) => {
    const normalizeList = (raw: any): string[] => {
      if (Array.isArray(raw)) return raw
      if (typeof raw === 'string' && raw.trim()) {
        try {
          const parsed = JSON.parse(raw)
          if (Array.isArray(parsed)) return parsed
        } catch {}
        return raw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      }
      return []
    }

    const rawPinned = normalizeList(settings?.pinnedExtensions)
    const rawAnimePinned = normalizeList(settings?.pinnedAnimeSources)
    const unifiedPinned = Array.from(new Set([...rawPinned, ...rawAnimePinned]))

    set({
      ...settings,
      pinnedExtensions: unifiedPinned,
      pinnedAnimeSources: unifiedPinned,
      installedExtensions: installed || []
    })
  }
}))
