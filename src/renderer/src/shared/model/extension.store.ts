import { create } from 'zustand'
import { DataService } from '@renderer/shared/api'

export interface ExtensionMetadata {
  pkg: string
  name: string
  lang: string
  icon: string
  baseUrl: string
  version: string
}

interface ExtensionState {
  installedExtensions: ExtensionMetadata[]
  activeExtension: string | null
  extensionSortBy: 'name' | 'installed' | 'update'
  extensionSortOrder: 'asc' | 'desc'
  domainOverrides: Record<string, string>

  // Actions
  setInstalledExtensions: (exts: ExtensionMetadata[]) => void
  setActiveExtension: (pkg: string | null) => void
  setDomainOverrides: (overrides: Record<string, string>) => void
  setExtensionSortBy: (val: 'name' | 'installed' | 'update') => Promise<void>
  setExtensionSortOrder: (val: 'asc' | 'desc') => Promise<void>
  setDomainOverride: (pkg: string, domain: string | null) => Promise<void>
  installExtension: (pkg: string) => Promise<void>
  uninstallExtension: (pkg: string) => Promise<void>
  
  // Init
  _init: (installed: ExtensionMetadata[], settings: Record<string, string>) => void
}

export const useExtensionStore = create<ExtensionState>((set, get) => ({
  installedExtensions: [],
  activeExtension: null,
  extensionSortBy: 'name',
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

  installExtension: async () => {
    const installed = await DataService.db.getExtensions()
    set({ installedExtensions: (installed as ExtensionMetadata[]) || [] })
  },

  uninstallExtension: async (pkg) => {
    await DataService.db.removeExtension(pkg)
    set((state) => ({ 
      installedExtensions: state.installedExtensions.filter((e) => e.pkg !== pkg) 
    }))
  },

  _init: (installed, settings) => {
    const overrides: Record<string, string> = {}
    if (installed) {
      for (const ext of installed) {
        const domain = settings[`domain_override_${ext.pkg}`]
        if (domain) overrides[ext.pkg] = domain
      }
    }

    set({
      installedExtensions: installed || [],
      domainOverrides: overrides,
      extensionSortBy: (settings.extension_sort_by as any) || 'name',
      extensionSortOrder: (settings.extension_sort_order as any) || 'asc',
    })
  }
}))
