import * as Crypto from 'expo-crypto'
import { MobileDB } from './db.native'
import { templateService, sourceService } from '@common'

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
        : []
      
      await MobileDB.setSetting('source_repositories', JSON.stringify(repos))
    }

    // Trigger templates and sources fetch for all repositories
    Promise.all([
      templateService.loadAllRepositories(repos),
      sourceService.loadAllRepositories(repos)
    ]).then(([tmplRes, srcRes]) => {
      console.log(`[MobileTemplates] Loaded ${tmplRes.totalCount} templates from ${repos.length} repos.`)
      console.log(`[MobileSources] Loaded ${srcRes.totalCount} sources from ${repos.length} repos.`)
    }).catch((err) => {
      console.error('[MobileTemplates/Sources] Initialization fetch failed:', err)
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
