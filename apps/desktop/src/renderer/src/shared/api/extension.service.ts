import { Extension } from '@common/types'
import { getApi, callIpc } from './base'

export const ExtensionService = {
  /**
   * Resolves the icon path for an extension using the centralized cache protocol.
   */
  getExtensionIcon: (pkg: string): string => {
    return `autakimi-cache://local-icon/${pkg}.png`
  },

  executeExtension: (args: { pkg: string; code: string; contextArgs?: Record<string, unknown> }) =>
    callIpc(() => getApi().executeExtension(args)),
  installExtension: (ext: Extension, repoUrl: string) =>
    callIpc(() => getApi().installExtension(ext, repoUrl)),
  getExtensionsCatalog: () => callIpc(() => getApi().sources.getCatalogExtensions())
}
