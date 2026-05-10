// Vite uses import.meta.glob at build time to eagerly load all extension JSONs.
// Metro (Expo) picks catalog-local.native.ts instead.
export const catalogModules = import.meta.glob('./extensions/*.json', { eager: true })
export const localExtensions = Object.values(catalogModules).flatMap(
  (m: any) => (m.default || m) as any[]
)
