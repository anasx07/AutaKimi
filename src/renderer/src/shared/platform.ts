export const isElectron = (): boolean => {
  return typeof window !== 'undefined' && !!(window as any).api
}

export const isMobile = (): boolean => {
  // If we are on Desktop (Electron), we are never mobile
  if (isElectron()) return false
  // For other platforms (Web), any window under 1024px is mobile
  return window.innerWidth < 1024
}

export const isDesktop = (): boolean => !isMobile()


