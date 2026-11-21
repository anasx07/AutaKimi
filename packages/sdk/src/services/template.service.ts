import { networkClient } from './network'
import { repositoryService } from './repository.service'
import { keiyoushiService } from './keiyoushi.service'

export interface ScrapingTemplate {
  id: string
  name: string
  generate(baseUrl: string, ua: string): string
}

export function generateMadaraCode(baseUrl: string, ua: string): string {
  return `const baseUrl = ${JSON.stringify(baseUrl)};

if (typeof params !== "undefined" && params.type === "fetchPages") {
  let response = await fetch(params.chapterUrl, {
    headers: { "User-Agent": params._userAgent || ${JSON.stringify(ua)} }
  });
  let html = await response.text();
  const $ = cheerio.load(html);
  const pages = [];
  $(".page-break img, .reading-content img, .wp-manga-chapter-img img").each((i, el) => {
    const src = $(el).attr("src") || $(el).attr("data-src") || $(el).attr("data-lazy-src") || $(el).attr("data-cdn");
    if (src && src.trim()) pages.push(src.trim());
  });
  return { pages };
}

if (typeof params !== "undefined" && params.type === "fetchChapters") {
  let response = await fetch(params.mangaUrl, {
    headers: { "User-Agent": params._userAgent || ${JSON.stringify(ua)} }
  });
  let html = await response.text();
  let $ = cheerio.load(html);
  
  let rows = $(".wp-manga-chapter a");
  if (rows.length === 0) {
    const mangaIdNode = $("input.rating-post-id, #manga-chapters-holder");
    const mangaId = mangaIdNode.attr("value") || mangaIdNode.attr("data-id");
    if (mangaId) {
      const ajaxRes = await fetch(baseUrl + "/wp-admin/admin-ajax.php", {
        method: "POST",
        headers: { 
          "User-Agent": params._userAgent || ${JSON.stringify(ua)},
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: "action=manga_get_chapters&manga=" + mangaId
      });
      if (ajaxRes.ok) {
        const ajaxHtml = await ajaxRes.text();
        $ = cheerio.load(ajaxHtml);
        rows = $(".wp-manga-chapter a");
      }
    }
  }

  const items = [];
  rows.each((i, el) => {
    const a = $(el);
    const url = a.attr("href");
    const chapter = a.text().trim().replace(/Chapter/i, "").replace(/الفصل/i, "").trim();
    if (url) {
      items.push({
        id: url,
        url: url,
        number: parseFloat(chapter) || 0,
        title: "Chapter " + chapter,
        date: new Date().toISOString(),
        attributes: { chapter, title: "Chapter " + chapter, createdAt: new Date().toISOString() }
      });
    }
  });
  return { data: items };
}

if (typeof params !== "undefined" && params.type === "fetchMangaDetails") {
  let response = await fetch(params.mangaUrl, {
    headers: { "User-Agent": params._userAgent || ${JSON.stringify(ua)} }
  });
  let html = await response.text();
  const $ = cheerio.load(html);
  const title = $(".post-title h1, .post-title h3, .post-title").first().text().trim() || "Unknown";
  const coverUrl = $(".summary_image img").attr("data-src") || $(".summary_image img").attr("data-lazy-src") || $(".summary_image img").attr("src") || "";
  const description = $(".description-summary .summary__content, .summary__content, .manga-excerpt").first().text().trim();
  const author = $(".author-content a").first().text().trim();
  const artist = $(".artist-content a").first().text().trim();
  const status = $(".post-status .summary-content").first().text().trim();
  const genres = [];
  $(".genres-content a").each((i, el) => {
    const g = $(el).text().trim();
    if (g) genres.push(g);
  });
  return { title, coverUrl, description, author, artist, status, genres, url: params.mangaUrl };
}

// Default: Fetch Popular/Latest/Search
const page = (typeof params !== "undefined" && params.page) ? params.page : Math.floor((typeof params !== "undefined" && typeof params.offset !== "undefined" ? params.offset : 0) / (typeof params !== "undefined" && typeof params.limit !== "undefined" ? params.limit : 30)) + 1;
let url = baseUrl + "/manga/page/" + page + "/?m_orderby=latest";

if (typeof params !== "undefined") {
  if (params.type === "fetchPopular" || params.activeFeed === "popular") {
    url = baseUrl + "/manga/page/" + page + "/?m_orderby=views";
  } else if (params.type === "fetchSearch" || (params.activeFeed === "search" && params.debouncedSearch)) {
    url = baseUrl + "/?s=" + encodeURIComponent(params.debouncedSearch || params.query) + "&post_type=wp-manga";
  }
}

let response = await fetch(url, {
  headers: { "User-Agent": params._userAgent || ${JSON.stringify(ua)} }
});
let html = await response.text();

if (html.includes("page-item-detail") === false && html.includes("manga-item") === false && !url.includes("?s=")) {
  const fallbackUrl = baseUrl + "/?m_orderby=latest&page=" + page;
  response = await fetch(fallbackUrl, { headers: { "User-Agent": ${JSON.stringify(ua)} } });
  html = await response.text();
}

const $ = cheerio.load(html);
const items = [];
$(".manga-item, .page-item-detail, .c-tabs-item__content, .popular-item, .widget-content .page-item-detail").each((i, el) => {
  const node = $(el);
  const titleNode = node.find(".post-title a, h3 a, h4 a, .post-title h3 a");
  const title = titleNode.text().trim() || "Unknown";
  const url = titleNode.attr("href") || "";
  const imgNode = node.find("img");
  const cover = imgNode.attr("data-src") || imgNode.attr("data-lazy-src") || imgNode.attr("data-cdn") || imgNode.attr("src") || "";
  if (url && !items.find(it => it.id === url)) items.push({ id: url, title, cover, url, status: "Ongoing" });
});

return { data: items };
`
}

export function generateMangaStreamCode(baseUrl: string, ua: string): string {
  return `const baseUrl = ${JSON.stringify(baseUrl)};

if (typeof params !== "undefined" && params.type === "fetchPages") {
  let response = await fetch(params.chapterUrl, {
    headers: { "User-Agent": params._userAgent || ${JSON.stringify(ua)} }
  });
  let html = await response.text();
  const $ = cheerio.load(html);
  const pages = [];
  
  $("img").each((i, el) => {
     const src = $(el).attr("src");
     if (src && src.includes("/uploads/")) {
        if (src.startsWith("//")) {
           pages.push("https:" + src);
        } else if (src.startsWith("/")) {
           pages.push(baseUrl + src);
        } else {
           pages.push(src);
        }
     }
  });
  return { pages };
}

if (typeof params !== "undefined" && params.type === "fetchChapters") {
  let response = await fetch(params.mangaUrl, {
    headers: { "User-Agent": params._userAgent || ${JSON.stringify(ua)} }
  });
  let html = await response.text();
  const $ = cheerio.load(html);
  const items = [];

  const rows = $(".eph-num a, .chapter-list li a, .chapter-card a, .chapter-link");
  rows.each((i, el) => {
    const a = $(el);
    const url = a.attr("href");
    let chapter = "";
    
    const cardNode = a.closest(".chapter-card");
    if (cardNode.length && cardNode.attr("data-number")) {
       chapter = cardNode.attr("data-number");
    } else {
       chapter = a.find(".chapnum, .chapter-number").text().trim() || a.text().trim();
    }
    
    chapter = chapter.replace(/Chapter/i, "").replace(/الفصل/i, "").trim() || (i + 1).toString();
    
    let createdAt = a.find(".chapterdate").text().trim() || cardNode.find(".chapter-date").text().trim() || new Date().toISOString();
    
    if (url) {
      items.push({
        id: url,
        url: url,
        number: parseFloat(chapter) || (i + 1),
        title: "Chapter " + chapter,
        date: createdAt,
        attributes: { chapter, title: "Chapter " + chapter, createdAt }
      });
    }
  });
  
  return { data: items };
}

if (typeof params !== "undefined" && params.type === "fetchMangaDetails") {
  let response = await fetch(params.mangaUrl, {
    headers: { "User-Agent": params._userAgent || ${JSON.stringify(ua)} }
  });
  let html = await response.text();
  const $ = cheerio.load(html);
  const title = $("h1.entry-title").first().text().trim() || "Unknown";
  const coverUrl = $(".thumb img").attr("data-src") || $(".thumb img").attr("data-lazy-src") || $(".thumb img").attr("src") || "";
  const description = $(".entry-content, .infox .desc").first().text().trim();
  const author = $(".infox .fmed:contains('Author') span, .infox span:contains('Author')").first().text().trim();
  const status = $(".infox .fmed:contains('Status') span, .infox span:contains('Status')").first().text().trim();
  const genres = [];
  $(".mgen a").each((i, el) => {
    const g = $(el).text().trim();
    if (g) genres.push(g);
  });
  return { title, coverUrl, description, author, status, genres, url: params.mangaUrl };
}

// Default: Fetch Popular/Latest/Search
const page = (typeof params !== "undefined" && params.page) ? params.page : Math.floor((typeof params !== "undefined" && typeof params.offset !== "undefined" ? params.offset : 0) / (typeof params !== "undefined" && typeof params.limit !== "undefined" ? params.limit : 30)) + 1;
let url = baseUrl + "/series/?page=" + page;

if (typeof params !== "undefined") {
  if (params.type === "fetchSearch" || (params.activeFeed === "search" && params.debouncedSearch)) {
    url = baseUrl + "/?s=" + encodeURIComponent(params.debouncedSearch || params.query);
  } else if (params.type === "fetchLatest" || params.activeFeed === "latest") {
    url = baseUrl + "/series/?page=" + page + "&order=update";
  } else if (params.type === "fetchPopular" || params.activeFeed === "popular") {
    url = baseUrl + "/series/?page=" + page + "&order=popular";
  }
}

let response = await fetch(url, {
  headers: {
    "User-Agent": params._userAgent || ${JSON.stringify(ua)}
  }
});
let html = await response.text();
if (html.split("<div class=\\"bsx\\">").length <= 1 && !url.includes("?s=")) {
  const fallbackUrl = baseUrl + "/manga/?page=" + page;
  response = await fetch(fallbackUrl, {
    headers: { "User-Agent": ${JSON.stringify(ua)} }
  });
  html = await response.text();
}

const $ = cheerio.load(html);
const items = [];
const selectors = [".bsx", ".listupd .bs", ".utao .uta", ".manga-item"];
$(selectors.join(", ")).each((i, el) => {
  const node = $(el);
  const a = node.find("a");
  const title = a.attr("title") || node.find(".tt").text().trim() || node.find("h3, h4").text().trim() || "Unknown";
  const url = a.attr("href") || "";
  const img = node.find("img");
  const cover = img.attr("src") || img.attr("data-lazy-src") || img.attr("data-src") || "";
  if (url && !items.find(it => it.id === url)) items.push({ id: url, title, cover, url, status: "Ongoing" });
});

return { data: items };
`
}

export function generateMangaSwatCode(_baseUrl: string, ua: string): string {
  return `const API_HOST = "appswat.com";
const BASE_API = "https://" + API_HOST + "/v2/api/v2";

const defaultHeaders = {
  "User-Agent": params._userAgent || ${JSON.stringify(ua)},
  "Accept": "application/json"
};

// 1. Fetch Pages
if (typeof params !== "undefined" && params.type === "fetchPages") {
  const chapterId = String(params.chapterUrl || "").replace(/^.*\\/chapters?\\//, "").replace(/\\/.*$/, "");
  const res = await fetch(BASE_API + "/chapters/" + chapterId + "/", { headers: defaultHeaders });
  const data = await res.json();
  const pages = (data.images || [])
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map(img => (img.image || "").replace("meshmanga.com", API_HOST));
  return { pages };
}

// 2. Fetch Chapters
if (typeof params !== "undefined" && params.type === "fetchChapters") {
  const mangaId = String(params.mangaUrl || "").replace(/^.*\\/series\\//, "").replace(/\\/.*$/, "");
  const items = [];
  let page = 1;
  let hasNext = true;
  while (hasNext && page <= 5) {
    const res = await fetch(BASE_API + "/chapters/?serie=" + mangaId + "&order_by=-order&page_size=100&page=" + page, { headers: defaultHeaders });
    const data = await res.json();
    for (const ch of (data.results || [])) {
      items.push({
        id: String(ch.id),
        url: "https://meshmanga.com/chapter/" + ch.id,
        number: parseFloat(ch.chapter) || 0,
        title: ch.title || ("Chapter " + ch.chapter),
        date: ch.created_at || new Date().toISOString(),
        attributes: { chapter: String(ch.chapter), title: ch.title || ("Chapter " + ch.chapter) }
      });
    }
    hasNext = Boolean(data.next);
    page++;
  }
  return { data: items };
}

// 3. Fetch Manga Details
if (typeof params !== "undefined" && params.type === "fetchMangaDetails") {
  const mangaId = String(params.mangaUrl || "").replace(/^.*\\/series\\//, "").replace(/\\/.*$/, "");
  const res = await fetch(BASE_API + "/series/" + mangaId + "/", { headers: defaultHeaders });
  const data = await res.json();
  const genres = (data.genres || []).map(g => g.name);
  const coverUrl = data.poster?.medium || data.poster?.thumbnail || "";
  return {
    title: data.title || "Unknown",
    coverUrl,
    description: data.summary || data.description || "",
    author: data.editor?.name || "",
    artist: data.translator?.name || "",
    status: data.status?.name || "Ongoing",
    genres,
    url: "https://meshmanga.com/series/" + mangaId
  };
}

// 4. Default: Fetch Popular, Latest, Search
const page = (typeof params !== "undefined" && params.page) ? params.page : 1;
let url = BASE_API + "/series/?order_by=-followers_count&page_size=24&page=" + page;

if (typeof params !== "undefined") {
  if (params.type === "fetchLatest" || params.activeFeed === "latest") {
    url = BASE_API + "/series/releases/?page_size=24&page=" + page;
  } else if (params.type === "fetchSearch" || (params.activeFeed === "search" && params.debouncedSearch)) {
    url = BASE_API + "/series/?search=" + encodeURIComponent(params.debouncedSearch || params.query) + "&page_size=24&page=" + page;
  }
}

const res = await fetch(url, { headers: defaultHeaders });
const data = await res.json();
const items = (data.results || []).map(item => ({
  id: String(item.id),
  title: item.title,
  cover: item.poster?.medium || item.poster?.thumbnail || "",
  url: "https://meshmanga.com/series/" + item.id,
  status: item.status?.name || "Ongoing"
}));

return { data: items };
`
}

export class TemplateService {
  private static instance: TemplateService
  private templates = new Map<string, ScrapingTemplate>()

  constructor() {
    this.initDefaultTemplates()
  }

  private initDefaultTemplates() {
    this.templates.set('madara', {
      id: 'madara',
      name: 'Madara',
      generate: (baseUrl: string, ua: string) => generateMadaraCode(baseUrl, ua)
    })

    this.templates.set('mangastream', {
      id: 'mangastream',
      name: 'Mangastream',
      generate: (baseUrl: string, ua: string) => generateMangaStreamCode(baseUrl, ua)
    })

    this.templates.set('mangaswat', {
      id: 'mangaswat',
      name: 'MangaSwat',
      generate: (baseUrl: string, ua: string) => generateMangaSwatCode(baseUrl, ua)
    })

    const ms = this.templates.get('mangastream')!
    this.templates.set('mangathesia', ms)
    this.templates.set('iken', ms)
  }

  public static getInstance(): TemplateService {
    if (!TemplateService.instance) {
      TemplateService.instance = new TemplateService()
    }
    return TemplateService.instance
  }

  async hydrateManifest(manifest: any): Promise<{ success: boolean; count: number }> {
    try {
      if (
        Boolean(manifest.isKeiyoushi) ||
        keiyoushiService.isKeiyoushiUrl(manifest.baseUrl) ||
        manifest.catalogs?.manga === 'index.json' ||
        manifest.catalogs?.manga === 'index.min.json'
      ) {
        return { success: true, count: 0 }
      }

      const fetchUrl = `${manifest.baseUrl}${manifest.templates}`
      return await this.fetchTemplates(fetchUrl)
    } catch (e) {
      console.error(`[TemplateService] Error hydrating manifest at ${manifest.baseUrl}:`, e)
      return { success: false, count: 0 }
    }
  }

  /**
   * Fetches template definitions from multiple remote JSON files
   */
  async loadAllRepositories(urls: string[]): Promise<{ success: boolean; totalCount: number }> {
    let totalCount = 0
    for (const url of urls) {
      try {
        const manifest = await repositoryService.resolveManifest(url)
        const fetchUrl = `${manifest.baseUrl}${manifest.templates}`
        const res = await this.fetchTemplates(fetchUrl)
        if (res.success) totalCount += res.count
      } catch (e) {
        console.error(`[TemplateService] Error resolving manifest for ${url}:`, e)
      }
    }
    return { success: true, totalCount }
  }

  /**
   * Fetches template definitions from a remote JSON file
   */
  async fetchTemplates(url: string): Promise<{ success: boolean; count: number; error?: string }> {
    try {
      const res = await networkClient.fetch(url)
      if (!res.ok) throw new Error(`Failed to fetch templates: ${res.error}`)
      
      const response = res.value
      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}: Failed to retrieve file`)
      }

      const contentType = response.headers.get('content-type') || ''
      if (contentType.includes('text/html')) {
        throw new Error('Expected JSON response, but received HTML. Please make sure the URL points to a valid templates.json file.')
      }

      const data = await response.json()

      // If data is a repository manifest pointing to a relative templates file, resolve and fetch that file
      if (typeof data.templates === 'string') {
        const lastSlash = url.lastIndexOf('/')
        const baseUrl = lastSlash !== -1 ? url.substring(0, lastSlash + 1) : `${url}/`
        return this.fetchTemplates(`${baseUrl}${data.templates}`)
      }

      if (!data.templates || !Array.isArray(data.templates)) {
        // If it's a Keiyoushi manifest or catalog-only manifest with no templates, succeed gracefully
        if (data.catalogs || data.sources || data.isKeiyoushi) {
          return { success: true, count: 0 }
        }
        throw new Error('Invalid template repository format')
      }

      for (const item of data.templates) {
        this.registerDynamicTemplate(item)
      }

      return { success: true, count: data.templates.length }
    } catch (err: any) {
      console.error('[TemplateService] Fetch failed:', err)
      return { success: false, count: 0, error: err.message }
    }
  }

  /**
   * Registers a template from a dynamic JSON definition
   */
  private registerDynamicTemplate(def: { id: string; name: string; generator: string }) {
    try {
      this.templates.set(def.id, {
        id: def.id,
        name: def.name,
        generate: (baseUrl: string, ua: string) => {
          const match = def.generator.match(/return\s*`([\s\S]*)`/)
          if (!match) {
            throw new Error('Invalid template generator format: must return a backtick string.')
          }
          let content = match[1]

          content = content.replace(/\${JSON\.stringify\(baseUrl\)}/g, JSON.stringify(baseUrl))
          content = content.replace(/\${JSON\.stringify\(ua\)}/g, JSON.stringify(ua))
          content = content.replace(/\${baseUrl}/g, baseUrl)
          content = content.replace(/\${ua}/g, ua)
          content = content.replace(/\\`/g, '`')

          return content
        }
      })
      
      console.log(`[TemplateService] Registered template: ${def.name}`)
    } catch (err) {
      console.error(`[TemplateService] Failed to register template ${def.name}:`, err)
    }
  }

  getTemplate(id: string): ScrapingTemplate | undefined {
    return this.templates.get(id)
  }

  getAllTemplates(): ScrapingTemplate[] {
    return Array.from(this.templates.values())
  }
}

export const templateService = TemplateService.getInstance()
