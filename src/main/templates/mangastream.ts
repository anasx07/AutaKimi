import { NetworkConfig } from '../../common/config/network'
import { ScrapingTemplate } from './index'

export const MangaStreamTemplate: ScrapingTemplate = {
  name: 'mangastream',
  generate: (baseUrl: string) => {
    const ua = NetworkConfig.DEFAULT_UA
    return `
const baseUrl = ${JSON.stringify(baseUrl)};

if (typeof params !== 'undefined' && params.type === 'fetchPages') {
  let response = await fetch(params.chapterUrl, {
    headers: { 'User-Agent': params._userAgent || ${JSON.stringify(ua)} }
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
    headers: { 'User-Agent': params._userAgent || ${JSON.stringify(ua)} }
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
    'User-Agent': params._userAgent || ${JSON.stringify(ua)}
  }
});
let html = await response.text();
if (html.split('<div class="bsx">').length <= 1 && !url.includes('?s=')) {
  const fallbackUrl = baseUrl + '/manga/?page=' + page;
  response = await fetch(fallbackUrl, {
    headers: { 'User-Agent': ${JSON.stringify(ua)} }
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
`
  }
}
