export enum ServicePriority {
  CORE = 0,      // Infrastructure (Broadcast, Identity)
  NETWORK = 10,  // Providers (Cloudflare)
  STORAGE = 20,  // Cache, DB managers
  FEATURE = 30,  // Sync, Download
  PLUGIN = 40    // Consumers
}

export interface AppService {
  priority?: number // Lower values initialize first
  initialize(): Promise<void>
  shutdown(): Promise<void>
}

export class ServiceRegistry {
  private static services: AppService[] = []

  static register(service: AppService) {
    this.services.push(service)
  }

  static async initializeAll() {
    console.log('[ServiceRegistry] Initializing services...')
    
    // Sort services by priority before initialization
    // Default priority is 50 if not specified
    const sortedServices = [...this.services].sort((a, b) => {
      const pA = a.priority ?? 50
      const pB = b.priority ?? 50
      return pA - pB
    })

    for (const service of sortedServices) {
      try {
        await service.initialize()
      } catch (err) {
        console.error(`[ServiceRegistry] Failed to initialize service:`, err)
      }
    }
  }

  static async shutdownAll() {
    console.log('[ServiceRegistry] Shutting down services...')
    
    // Shutdown in reverse priority order
    const sortedServices = [...this.services].sort((a, b) => {
      const pA = a.priority ?? 50
      const pB = b.priority ?? 50
      return pB - pA
    })

    for (const service of sortedServices) {
      try {
        await service.shutdown()
      } catch (err) {
        console.error(`[ServiceRegistry] Failed to shutdown service:`, err)
      }
    }
  }
}
