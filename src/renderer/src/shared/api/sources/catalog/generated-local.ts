// Vite-only eager glob. Metro (Expo) uses generated-local.native.ts instead.
export const metadataModules = import.meta.glob('./generated/*.json', { eager: true })
