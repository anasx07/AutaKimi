import { settingsRepo } from '../db'
import crypto from 'crypto'
import { AppService, ServicePriority } from './service.registry'

export class IdentityService implements AppService {
  public priority = ServicePriority.CORE
  private deviceId: string | null = null
  private syncSecret: string | null = null

  constructor() {}

  async initialize(): Promise<void> {
    this.deviceId = await settingsRepo.get('device_id')
    if (!this.deviceId) {
      this.deviceId = crypto.randomUUID()
      await settingsRepo.set('device_id', this.deviceId)
    }

    this.syncSecret = await settingsRepo.get('sync_secret')
    if (!this.syncSecret) {
      this.syncSecret = crypto.randomBytes(32).toString('hex')
      await settingsRepo.set('sync_secret', this.syncSecret)
    }

    // Migration and initialization of multiple repositories
    const reposJson = await settingsRepo.get('source_repositories')
    if (!reposJson) {
      // Check for old single URL to migrate
      const oldUrl = await settingsRepo.get('template_repo_url')
      const initialRepos = oldUrl 
        ? [oldUrl] 
        : ['https://raw.githubusercontent.com/Autakimi-Ecosystem/autakimi-extensions/main/templates.json']
      
      await settingsRepo.set('source_repositories', JSON.stringify(initialRepos))
    }
  }

  async shutdown(): Promise<void> {
    // No specific shutdown logic needed for identity
  }

  getDeviceId(): string {
    return this.deviceId || ''
  }

  getSyncSecret(): string {
    return this.syncSecret || ''
  }

  /**
   * Generates the pairing payload for the QR code
   */
  async getPairingPayload(ip: string, port: number): Promise<string> {
    if (!this.deviceId || !this.syncSecret) await this.initialize()
    return `autakimi-pair://${ip}:${port}?secret=${this.syncSecret}&id=${this.deviceId}`
  }
}

export const identityService = new IdentityService()
