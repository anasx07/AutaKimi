import { create } from 'zustand'
import { DataService } from '@renderer/shared/api'
import { SettingsSchema, Extension } from '@common/types'
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

  // Init
  _init: (installed: Extension[], settings: SettingsSchema['extensions']) => void
}

export const useExtensionStore = create<ExtensionState>((set) => ({
  installedExtensions: [],
  pinnedExtensions: [],
  pinnedAnimeSources: [],
  activeExtension: null,
  installingPkgs: new Set(),
  extensionSortBy: 'supported',
  extensionSortOrder: 'asc',
  domainOverrides: {},

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
    set((state) => ({
      installedExtensions: state.installedExtensions.filter((e) => e.pkg !== pkg),
      pinnedExtensions: state.pinnedExtensions.filter((p) => p !== pkg)
    }))
  },

  installExtension: async (ext) => {
    const pkg = ext.pkg
    set((state) => ({ installingPkgs: new Set(state.installingPkgs).add(pkg) }))

    try {
      await DataService.installExtension(ext, ext.repoUrl || 'local')

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
    set((state) => {
      const isPinned = state.pinnedExtensions.includes(pkg)
      const nextPinned = isPinned
        ? state.pinnedExtensions.filter((p) => p !== pkg)
        : [...state.pinnedExtensions, pkg]

      // Persist
      DataService.db.setSetting('pinned_extensions', nextPinned.join(','))

      return { pinnedExtensions: nextPinned }
    })
  },

  _init: (installed, settings) => {
    set({
      ...settings,
      installedExtensions: installed || []
    })
  }
}))
