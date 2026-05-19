import { IBypassProvider, Result, networkClient } from '@autakimi/sdk'
import { router } from 'expo-router'
import { CfCookieStore, CfBypassFlow } from './cf-cookies'

export class MobileBypassProvider implements IBypassProvider {
  private static instance: MobileBypassProvider
  private userAgent = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'

  public static getInstance(): MobileBypassProvider {
    if (!MobileBypassProvider.instance) {
      MobileBypassProvider.instance = new MobileBypassProvider()
    }
    return MobileBypassProvider.instance
  }

  async getCredentials(url: string): Promise<{ userAgent: string; cookies: string }> {
    const domain = new URL(url).hostname
    const cfCookie = CfCookieStore.get(domain)
    return {
      userAgent: this.userAgent,
      cookies: cfCookie ? `cf_clearance=${cfCookie}` : ''
    }
  }

  async resolveChallenge(url: string, silent?: boolean): Promise<Result<{ userAgent: string; cookies: string }>> {
    try {
      // Background/silent bypasses are not supported on mobile yet
      if (silent) return { ok: false, error: 'Silent bypass not supported on mobile' }

      // Navigate to the CF bypass screen and wait for the user to solve
      router.push('/cf-bypass')
      const cookie = await CfBypassFlow.start(url)

      if (cookie) {
        return { 
          ok: true, 
          value: { 
            userAgent: this.userAgent, 
            cookies: `cf_clearance=${cookie}` 
          } 
        }
      }
      return { ok: false, error: 'Challenge was not completed' }
    } catch (err: any) {
      return { ok: false, error: err.message || String(err) }
    }
  }

  reportPulse(_url: string): void {
    // No-op for mobile for now
  }

  initialize() {
    networkClient.setProvider(this)
  }
}

export const mobileBypassProvider = MobileBypassProvider.getInstance()
