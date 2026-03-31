import { create } from 'zustand'
import { DataService } from '@renderer/shared/api'
import { SettingsSchema } from '@common/types'
import { Haptics, ImpactStyle } from '@capacitor/haptics'

export interface ExtensionMetadata {
  pkg: string
  name: string
  lang: string
  icon: string
  baseUrl: string
  version: string
  nsfw?: number
  repoUrl?: string
}

const triggerHaptic = async (style: ImpactStyle = ImpactStyle.Light) => {
  try {
    if (DataService.platform !== 'win32' && DataService.platform !== 'darwin') {
      await Haptics.impact({ style })
    }
  } catch (e) {
    // Ignore haptic failures
  }
}

type ExtensionState = SettingsSchema['extensions'] & {
  installedExtensions: ExtensionMetadata[]
  activeExtension: string | null
  installingPkgs: Set<string>

  // Actions
  setInstalledExtensions: (exts: ExtensionMetadata[]) => void
  setActiveExtension: (pkg: string | null) => void
  setDomainOverrides: (overrides: Record<string, string>) => void
  setExtensionSortBy: (val: 'name' | 'installed' | 'update' | 'supported') => Promise<void>
  setExtensionSortOrder: (val: 'asc' | 'desc') => Promise<void>
  setDomainOverride: (pkg: string, domain: string | null) => Promise<void>
  loadInstalled: () => Promise<void>
  uninstallExtension: (pkg: string) => Promise<void>
  installExtension: (ext: any) => Promise<void>
  togglePin: (pkg: string) => Promise<void>

  // Init
  _init: (installed: ExtensionMetadata[], settings: SettingsSchema['extensions']) => void
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
    set({ installedExtensions: (installed as ExtensionMetadata[]) || [] })
  },

  uninstallExtension: async (pkg) => {
    await triggerHaptic(ImpactStyle.Medium)
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
      await DataService.installExtension(ext, ext.repoUrl)
      await triggerHaptic(ImpactStyle.Heavy)

      // Refresh installed list
      const installed = await DataService.db.getInstalledExtensions()
      set((state) => {
        const nextInstalling = new Set(state.installingPkgs)
        nextInstalling.delete(pkg)
        return {
          installedExtensions: (installed as ExtensionMetadata[]) || [],
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
    await triggerHaptic(ImpactStyle.Light)
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
