import * as Crypto from 'expo-crypto'
import { MobileDB } from './db.native'
import { templateService } from '@common'

export class IdentityService {
  private static instance: IdentityService
  private deviceId: string | null = null
  private syncSecret: string | null = null

  private constructor() {}

  public static getInstance(): IdentityService {
    if (!IdentityService.instance) {
      IdentityService.instance = new IdentityService()
    }
    return IdentityService.instance
  }

  async initialize(): Promise<void> {
    const deviceIdRes = await MobileDB.getSetting('device_id')
    if (deviceIdRes.ok && deviceIdRes.value) {
      this.deviceId = deviceIdRes.value
    } else {
      this.deviceId = Crypto.randomUUID()
      await MobileDB.setSetting('device_id', this.deviceId)
    }

    const syncSecretRes = await MobileDB.getSetting('sync_secret')
    if (syncSecretRes.ok && syncSecretRes.value) {
      this.syncSecret = syncSecretRes.value
    } else {
      const bytes = await Crypto.getRandomBytesAsync(32)
      this.syncSecret = Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
      await MobileDB.setSetting('sync_secret', this.syncSecret!)
    }

    // Initialize Multiple Repositories
    const reposJsonRes = await MobileDB.getSetting('source_repositories')
    let repos: string[] = []

    if (reposJsonRes.ok && reposJsonRes.value) {
      try {
        repos = JSON.parse(reposJsonRes.value)
      } catch (e) {
        repos = []
      }
    } else {
      // Migrate from single URL
      const oldUrlRes = await MobileDB.getSetting('template_repo_url')
      repos = (oldUrlRes.ok && oldUrlRes.value) 
        ? [oldUrlRes.value] 
        : ['https://raw.githubusercontent.com/Autakimi-Ecosystem/autakimi-extensions/main/templates.json']
      
      await MobileDB.setSetting('source_repositories', JSON.stringify(repos))
    }

    // Trigger templates fetch for all repositories
    templateService.loadAllRepositories(repos).then(res => {
       if (res.success) console.log(`[MobileTemplates] Loaded ${res.totalCount} templates from ${repos.length} repos.`)
    })
  }

  getDeviceId(): string {
    return this.deviceId || ''
  }

  getSyncSecret(): string {
    return this.syncSecret || ''
  }
}

export const identityService = IdentityService.getInstance()
