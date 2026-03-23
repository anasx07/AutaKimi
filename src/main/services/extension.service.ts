import { net } from 'electron'
import { Worker } from 'worker_threads'
import path from 'path'
import { is } from '@electron-toolkit/utils'
import { extensionRepo, settingsRepo } from '../db'
import { NetworkService } from '../../common/services/network'

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
    const workerPath = is.dev 
        ? path.join(__dirname, 'extension-worker.js')
        : path.join(__dirname, 'extension-worker.js');
        
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
   * Electron-native fetch wrapper
   */
  async electronFetch(url: string, init?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        const request = net.request({
          url,
          method: init?.method || 'GET',
        });
        
        if (init?.headers) {
          for (const [key, value] of Object.entries(init.headers)) {
            request.setHeader(key, value as string);
          }
        }

        request.on('error', (err) => reject(err));
        
        const timeout = setTimeout(() => {
          request.abort();
          reject(new Error('Network request timed out (15s)'));
        }, 15000);

        request.on('response', (response) => {
          clearTimeout(timeout);
          const chunks: Buffer[] = [];
          response.on('data', (chunk) => chunks.push(chunk));
          response.on('end', () => {
            const body = Buffer.concat(chunks).toString('utf-8');
            resolve({
              text: async () => body,
              json: async () => JSON.parse(body),
              ok: response.statusCode >= 200 && response.statusCode < 300,
              status: response.statusCode
            });
          });
        });

        if (init?.body) {
          request.write(typeof init.body === 'string' ? init.body : JSON.stringify(init.body));
        }
        
        request.end();
      } catch (e) {
        reject(e);
      }
    });
  }

  /**
   * Unified fetch entry point for extensions with retry logic
   */
  async fetch(url: string, init?: any, bypassCf = false): Promise<any> {
    return NetworkService.fetchWithRetry(url, init, 3, 1000, bypassCf ? this.electronFetch : fetch);
  }

  // --- Installation & Detection ---

  async detectTheme(url: string, bypassCf = true): Promise<'madara' | 'mangastream' | 'unknown'> {
    const check = async (testUrl: string) => {
      try {
        const response = await this.fetch(testUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' }
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
    const baseUrl = repoUrl.replace('/index.min.json', '');
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
        if (theme === 'madara') code = this.generateMadaraTemplate(extBaseUrl);
        else if (theme === 'mangastream') code = this.generateMangaStreamTemplate(extBaseUrl);
      }
    }

    const iconUrl = (ext.icon || `${baseUrl}/icon/${ext.pkg}.png`).replace('https://', 'lmanwa-cache://');

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

  // --- Template Generators (Internal) ---

  private generateMadaraTemplate(baseUrl: string): string {
    return `
const baseUrl = ${JSON.stringify(baseUrl)};

if (typeof params !== 'undefined' && params.type === 'fetchPages') {
  let response = await fetch(params.chapterUrl, {
    headers: { 'User-Agent': params._userAgent || 'Mozilla/5.0' }
  });
  let html = await response.text();
  const $ = cheerio.load(html);
  const pages = [];
  $('.page-break img, .reading-content img, .wp-manga-chapter-img img').each((i, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src') || $(el).attr('data-cdn');
    if (src && src.trim()) pages.push(src.trim());
  });
  return { pages };
}

if (typeof params !== 'undefined' && params.type === 'fetchChapters') {
  let response = await fetch(params.mangaUrl, {
    headers: { 'User-Agent': params._userAgent || 'Mozilla/5.0' }
  });
  let html = await response.text();
  let $ = cheerio.load(html);
  
  let rows = $('.wp-manga-chapter a');
  if (rows.length === 0) {
    const mangaIdNode = $('input.rating-post-id, #manga-chapters-holder');
    const mangaId = mangaIdNode.attr('value') || mangaIdNode.attr('data-id');
    if (mangaId) {
      const ajaxRes = await fetch(baseUrl + '/wp-admin/admin-ajax.php', {
        method: 'POST',
        headers: { 
          'User-Agent': params._userAgent || 'Mozilla/5.0',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'action=manga_get_chapters&manga=' + mangaId
      });
      if (ajaxRes.ok) {
        const ajaxHtml = await ajaxRes.text();
        $ = cheerio.load(ajaxHtml);
        rows = $('.wp-manga-chapter a');
      }
    }
  }

  const items = [];
  rows.each((i, el) => {
    const a = $(el);
    const url = a.attr('href');
    const chapter = a.text().trim().replace(/Chapter/i, '').replace(/الفصل/i, '').trim();
    if (url) {
      items.push({ id: url, attributes: { chapter, title: 'Chapter ' + chapter, createdAt: new Date().toISOString() } });
    }
  });
  return { data: items };
}

// Default: Fetch Popular/Latest/Search
const page = Math.floor((typeof params !== 'undefined' && typeof params.offset !== 'undefined' ? params.offset : 0) / (typeof params !== 'undefined' && typeof params.limit !== 'undefined' ? params.limit : 30)) + 1;
let url = baseUrl + '/manga/page/' + page + '/?m_orderby=latest';

if (typeof params !== 'undefined') {
  if (params.type === 'fetchPopular' || params.activeFeed === 'popular') {
    url = baseUrl + '/manga/page/' + page + '/?m_orderby=views';
  } else if (params.type === 'fetchSearch' || (params.activeFeed === 'search' && params.debouncedSearch)) {
    url = baseUrl + '/?s=' + encodeURIComponent(params.debouncedSearch || params.query) + '&post_type=wp-manga';
  }
}

let response = await fetch(url, {
  headers: { 'User-Agent': params._userAgent || 'Mozilla/5.0' }
});
let html = await response.text();

if (html.includes('page-item-detail') === false && html.includes('manga-item') === false && !url.includes('?s=')) {
  const fallbackUrl = baseUrl + '/?m_orderby=latest&page=' + page;
  response = await fetch(fallbackUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  html = await response.text();
}

const $ = cheerio.load(html);
const items = [];
$('.manga-item, .page-item-detail, .c-tabs-item__content').each((i, el) => {
  const node = $(el);
  const titleNode = node.find('.post-title a, h3 a, h4 a');
  const title = titleNode.text().trim() || 'Unknown';
  const url = titleNode.attr('href') || '';
  const cover = node.find('img').attr('src') || node.find('img').attr('data-src') || node.find('img').attr('data-lazy-src') || '';
  if (url && !items.find(it => it.id === url)) items.push({ id: url, title, cover, url, status: 'Ongoing' });
});

return { data: items };
`;
  }

  private generateMangaStreamTemplate(baseUrl: string): string {
    return `
const baseUrl = ${JSON.stringify(baseUrl)};

if (typeof params !== 'undefined' && params.type === 'fetchPages') {
  let response = await fetch(params.chapterUrl, {
    headers: { 'User-Agent': params._userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
  });
  let html = await response.text();
  const $ = cheerio.load(html);
  const pages = [];
  
  $('img').each((i, el) => {
     const src = $(el).attr('src');
     if (src && src.includes('/uploads/')) {
        if (src.startsWith('//')) {
           pages.push('https:' + src);
        } else if (src.startsWith('/')) {
           pages.push(baseUrl + src);
        } else {
           pages.push(src);
        }
     }
  });
  return { pages };
}

if (typeof params !== 'undefined' && params.type === 'fetchChapters') {
  let response = await fetch(params.mangaUrl, {
    headers: { 'User-Agent': params._userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
  });
  let html = await response.text();
  const $ = cheerio.load(html);
  const items = [];

  const rows = $('.eph-num a, .chapter-list li a, .chapter-card a, .chapter-link');
  rows.each((i, el) => {
    const a = $(el);
    const url = a.attr('href');
    let chapter = '';
    
    const cardNode = a.closest('.chapter-card');
    if (cardNode.length && cardNode.attr('data-number')) {
       chapter = cardNode.attr('data-number');
    } else {
       chapter = a.find('.chapnum, .chapter-number').text().trim() || a.text().trim();
    }
    
    chapter = chapter.replace(/Chapter/i, '').replace(/الفصل/i, '').trim() || (i + 1).toString();
    
    let createdAt = a.find('.chapterdate').text().trim() || cardNode.find('.chapter-date').text().trim() || new Date().toISOString();
    
    if (url) {
      items.push({ id: url, attributes: { chapter, title: 'Chapter ' + chapter, createdAt } });
    }
  });
  
  return { data: items };
}

// Default: Fetch Popular/Latest/Search
const page = Math.floor((typeof params !== 'undefined' && typeof params.offset !== 'undefined' ? params.offset : 0) / (typeof params !== 'undefined' && typeof params.limit !== 'undefined' ? params.limit : 30)) + 1;
let url = baseUrl + '/series/?page=' + page;

if (typeof params !== 'undefined') {
  if (params.type === 'fetchSearch' || (params.activeFeed === 'search' && params.debouncedSearch)) {
    url = baseUrl + '/?s=' + encodeURIComponent(params.debouncedSearch || params.query);
  } else if (params.type === 'fetchLatest' || params.activeFeed === 'latest') {
    url = baseUrl + '/series/?page=' + page + '&order=update';
  } else if (params.type === 'fetchPopular' || params.activeFeed === 'popular') {
    url = baseUrl + '/series/?page=' + page + '&order=popular';
  }
}

let response = await fetch(url, {
  headers: {
    'User-Agent': params._userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  }
});
let html = await response.text();
if (html.split('<div class="bsx">').length <= 1 && !url.includes('?s=')) {
  const fallbackUrl = baseUrl + '/manga/?page=' + page;
  response = await fetch(fallbackUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  html = await response.text();
}

const $ = cheerio.load(html);
const items = [];
const selectors = ['.bsx', '.listupd .bs', '.utao .uta', '.manga-item'];
$(selectors.join(', ')).each((i, el) => {
  const node = $(el);
  const a = node.find('a');
  const title = a.attr('title') || node.find('.tt').text().trim() || node.find('h3, h4').text().trim() || 'Unknown';
  const url = a.attr('href') || '';
  const img = node.find('img');
  const cover = img.attr('src') || img.attr('data-lazy-src') || img.attr('data-src') || '';
  if (url && !items.find(it => it.id === url)) items.push({ id: url, title, cover, url, status: 'Ongoing' });
});

return { data: items };
`;
  }
}

export const extensionOrchestrator = ExtensionOrchestrator.getInstance();
