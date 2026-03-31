export const isElectron = (): boolean => {
  return typeof window !== 'undefined' && !!(window as any).api
}

export const isCapacitor = (): boolean => {
  return typeof window !== 'undefined' && (!!(window as any).Capacitor || !!(window as any).webkit?.messageHandlers?.bridge)
}

export const isNative = (): boolean => {
  return typeof window !== 'undefined' && !!(window as any).Capacitor?.isNative
}

export const isMobile = (): boolean => {
  // If we are on Desktop (Electron), only use mobile UI for very small breakpoints
  if (isElectron()) return window.innerWidth < 1024
  // For other platforms (Native, Web), any window under 1024px or Capacitor environment is mobile
  return isCapacitor() || window.innerWidth < 1024
}

export const isDesktop = (): boolean => !isMobile()
