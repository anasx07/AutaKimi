import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DataService } from '@renderer/shared/api'
import { setGeneratedSources } from '@renderer/shared/api/sources/SourceRegistry'
import { ExtensionMetadata, useExtensionStore } from '@renderer/shared/model'
import { computeAvailableUpdates } from '../lib/updates'

export const extensionKeys = {
  all: ['extensions'] as const,
  catalog: (lang?: string) => [...extensionKeys.all, 'catalog', lang || 'all'] as const,
  installed: () => [...extensionKeys.all, 'installed'] as const,
  updates: () => [...extensionKeys.all, 'updates'] as const
}

/**
 * Hook for fetching and managing the universal extension catalog.
 */
export function useExtensionsCatalog(lang?: string) {
  return useQuery({
    queryKey: extensionKeys.catalog(lang),
    queryFn: async () => {
      const res = await DataService.getExtensionsCatalog(lang)
      const list = (Array.isArray(res) ? res : []) as ExtensionMetadata[]
      setGeneratedSources(list)
      return list
    },
    staleTime: 1000 * 60 * 15, // 15 minutes cache
    gcTime: 1000 * 60 * 60 // 1 hour memory
  })
}

/**
 * Hook for detecting available updates for installed extensions.
 * Derived synchronously from installedExtensions + catalog so updates clear immediately after install.
 */
export function useExtensionUpdates() {
  const { installedExtensions = [] } = useExtensionStore()
  const { data: catalog = [], isLoading, refetch } = useExtensionsCatalog()

  const data = useMemo(
    () => computeAvailableUpdates(installedExtensions, catalog),
    [installedExtensions, catalog]
  )

  return { data, isLoading, refetch }
}

/**
 * Mutation hook for installing/updating extensions with cache invalidation.
 */
export function useInstallExtension() {
  const queryClient = useQueryClient()
  const { installExtension } = useExtensionStore()

  return useMutation({
    mutationFn: async (ext: any) => {
      await installExtension(ext)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: extensionKeys.updates() })
    }
  })
}

/**
 * Mutation hook for bulk updating multiple extensions.
 */
export function useBulkUpdate() {
  const queryClient = useQueryClient()
  const { installExtension } = useExtensionStore()

  return useMutation({
    mutationFn: async (exts: any[]) => {
      // Parallel execution for robust speed
      await Promise.all(exts.map((ext) => installExtension(ext)))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: extensionKeys.updates() })
    }
  })
}
