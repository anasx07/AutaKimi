import { net } from 'electron'
import { Worker } from 'worker_threads'
import path from 'path'
import { extensionRepo, settingsRepo } from '../db'
import { getTemplate } from '../templates'
import { NetworkService } from '../../common/services/network'
import { NetworkConfig } from '../../common/config/network'

/**
 * ExtensionOrchestrator handles the complete lifecycle of extensions:
 * - Installation and theme detection
 * - Template generation
 * - Isolated sandbox execution
 * - Configuration and persistence
 */
export class ExtensionOrchestrator {
  private static instance: ExtensionOrchestrator;
  
  public static getInstance(): ExtensionOrchestrator {
    if (!ExtensionOrchestrator.instance) {
      ExtensionOrchestrator.instance = new ExtensionOrchestrator();
    }
    return ExtensionOrchestrator.instance;
  }

  // --- Sandbox Execution ---

  /**
   * Executes dynamic Javascript code inside an isolated Worker Thread + Sandbox
   */
  async runInSandbox(code: string, params: Record<string, any> = {}): Promise<any> {
    const workerPath = path.join(__dirname, 'extension-worker.js');
        
    console.log(`[ExtensionOrchestrator] Spawning sandbox for code execution.`);

    return new Promise((resolve) => {
      const worker = new Worker(workerPath, {
          workerData: { code, params },
          resourceLimits: {
              maxOldGenerationSizeMb: 64,
              maxYoungGenerationSizeMb: 16,
              codeRangeSizeMb: 16
          }
      });

      const timeout = setTimeout(() => {
          worker.terminate();
          resolve({ error: 'Sandbox execution timed out (30s)' });
      }, 30000);

      worker.on('message', (result) => {
          clearTimeout(timeout);
          resolve(result);
      });

      worker.on('error', (err) => {
          clearTimeout(timeout);
          console.error('[ExtensionOrchestrator Sandbox Error]:', err);
          resolve({ error: err.message });
      });

      worker.on('exit', (code) => {
          if (code !== 0) {
              clearTimeout(timeout);
              resolve({ error: `Worker exited with code ${code}` });
          }
      });
    });
  }

  // --- Fetch Utilities ---

  /**
   * Electron-native fetch wrapper using net.fetch for automatic cookie/session handling
   */
  async electronFetch(url: string, init?: any): Promise<any> {
    try {
      // net.fetch uses the default session cookies automatically
      const response = await net.fetch(url, init);
      return response;
    } catch (e) {
      console.error('[ExtensionOrchestrator] electronFetch error:', e);
      throw e;
    }
  }

  /**
   * Unified fetch entry point for extensions with retry logic
   */
  async fetch(url: string, init?: any, bypassCf = false): Promise<any> {
    const fetchFn = bypassCf ? this.electronFetch.bind(this) : fetch;
    return NetworkService.fetchWithRetry(url, init, 3, 1000, fetchFn);
  }

  // --- Installation & Detection ---

  async detectTheme(url: string, bypassCf = true): Promise<'madara' | 'mangastream' | 'unknown'> {
    const check = async (testUrl: string) => {
      try {
        const response = await this.fetch(testUrl, {
          headers: { 'User-Agent': NetworkConfig.DEFAULT_UA }
        }, bypassCf);
        const html = await response.text();
        if (html.includes('madara') || html.includes('wp-content/themes/madara') || html.includes('Madara')) return 'madara';
        if (html.includes('mangastream') || html.includes('wp-content/themes/mangastream') || html.includes('class="bsx"') || html.includes('class="listupd"')) return 'mangastream';
      } catch (e) {
        console.warn(`[ExtensionOrchestrator] detectTheme error on ${testUrl}:`, e);
      }
      return 'unknown';
    };

    let theme = await check(url);
    if (theme === 'unknown') {
      const cleanUrl = url.replace(/\/$/, '');
      theme = await check(`${cleanUrl}/series`);
      if (theme === 'unknown') theme = await check(`${cleanUrl}/manga`);
    }
    return theme as any;
  }

  async install(ext: any, repoUrl: string): Promise<{ success: boolean }> {
    const KEI_REPO = 'https://raw.githubusercontent.com/keiyoushi/extensions-source/main';
    const baseUrl = repoUrl === 'local' ? KEI_REPO : repoUrl.replace('/index.min.json', '');
    let code = '';
    
    const bypassCf = (await settingsRepo.get('bypass_cloudflare')) === 'true';

    try {
      const response = await this.fetch(`${baseUrl}/js/${ext.pkg}.js`, {}, bypassCf);
      if (response.ok) code = await response.text();
    } catch (e) {}

    if (!code) {
      const extBaseUrl = ext.sources?.[0]?.baseUrl;
      if (extBaseUrl) {
        const theme = await this.detectTheme(extBaseUrl, bypassCf);
        const template = getTemplate(theme);
        if (template) code = template.generate(extBaseUrl);
      }
    }

    // Use a clean local-only URL format
    const iconUrl = `autakimi-cache://local-icon/${ext.pkg}.png`;

    await extensionRepo.upsert({
      pkg: ext.pkg,
      installedAt: new Date().toISOString(),
      code,
      name: ext.name,
      baseUrl: ext.sources?.[0]?.baseUrl,
      lang: ext.lang,
      icon: iconUrl,
      version: ext.version
    });

    return { success: true };
  }

  }

export const extensionOrchestrator = ExtensionOrchestrator.getInstance();
