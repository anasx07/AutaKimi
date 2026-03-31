import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DataService } from '@renderer/shared/api'
import { ExtensionMetadata, useExtensionStore } from '@renderer/shared/model'

export const extensionKeys = {
  all: ['extensions'] as const,
  catalog: () => [...extensionKeys.all, 'catalog'] as const,
  installed: () => [...extensionKeys.all, 'installed'] as const,
  updates: () => [...extensionKeys.all, 'updates'] as const
}

/**
 * Hook for fetching and managing the universal extension catalog.
 */
export function useExtensionsCatalog() {
  return useQuery({
    queryKey: extensionKeys.catalog(),
    queryFn: async () => {
      const res = await DataService.getExtensionsCatalog()
      if (!res.ok) throw new Error(res.error)
      return res.value as ExtensionMetadata[]
    },
    staleTime: 1000 * 60 * 15, // 15 minutes cache
    gcTime: 1000 * 60 * 60 // 1 hour memory
  })
}

/**
 * Hook for detecting available updates for installed extensions.
 */
export function useExtensionUpdates() {
  const { installedExtensions } = useExtensionStore()
  const { data: catalog } = useExtensionsCatalog()

  return useQuery({
    queryKey: extensionKeys.updates(),
    queryFn: () => {
      if (!catalog || !installedExtensions) return []

      return installedExtensions.filter((installed) => {
        const remote = catalog.find((c) => c.pkg === installed.pkg)
        if (!remote) return false

        // Basic version comparison logic
        return remote.version !== installed.version
      })
    },
    enabled: !!catalog && installedExtensions.length > 0,
    staleTime: 1000 * 60 * 5 // 5 minutes
  })
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
