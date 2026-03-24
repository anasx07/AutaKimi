import { NetworkConfig } from '../../common/config/network';
import { ScrapingTemplate } from './index';

export const MadaraTemplate: ScrapingTemplate = {
  name: 'madara',
  generate: (baseUrl: string) => {
    const ua = NetworkConfig.DEFAULT_UA;
    return `
const baseUrl = ${JSON.stringify(baseUrl)};

if (typeof params !== 'undefined' && params.type === 'fetchPages') {
  let response = await fetch(params.chapterUrl, {
    headers: { 'User-Agent': params._userAgent || ${JSON.stringify(ua)} }
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
    headers: { 'User-Agent': params._userAgent || ${JSON.stringify(ua)} }
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
          'User-Agent': params._userAgent || ${JSON.stringify(ua)},
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
  headers: { 'User-Agent': params._userAgent || ${JSON.stringify(ua)} }
});
let html = await response.text();

if (html.includes('page-item-detail') === false && html.includes('manga-item') === false && !url.includes('?s=')) {
  const fallbackUrl = baseUrl + '/?m_orderby=latest&page=' + page;
  response = await fetch(fallbackUrl, { headers: { 'User-Agent': ${JSON.stringify(ua)} } });
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
};
