export interface AppService {
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
}

export class ServiceRegistry {
  private static services: AppService[] = [];

  static register(service: AppService) {
    this.services.push(service);
  }

  static async initializeAll() {
    console.log('[ServiceRegistry] Initializing services...');
    for (const service of this.services) {
      try {
        await service.initialize();
      } catch (err) {
        console.error(`[ServiceRegistry] Failed to initialize service:`, err);
      }
    }
  }

  static async shutdownAll() {
    console.log('[ServiceRegistry] Shutting down services...');
    for (const service of this.services) {
      try {
        await service.shutdown();
      } catch (err) {
        console.error(`[ServiceRegistry] Failed to shutdown service:`, err);
      }
    }
  }
}
