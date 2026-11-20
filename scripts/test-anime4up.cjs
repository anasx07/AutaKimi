const cheerio = require('cheerio');

(async () => {
  try {
    const res = await fetch('https://anime4up.quest/?search_param=animes&s=banana', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        'Referer': 'https://anime4up.quest/'
      }
    });
    const html = await res.text();
    const $ = cheerio.load(html);
    $('.anime-card-title a, .entry-title a, h3 a').each((i, el) => {
      console.log('Result:', $(el).attr('href'), $(el).text().trim());
    });
    if ($('.anime-card-title a').length === 0) {
      console.log('No cards found. Title:', $('title').text());
    }
  } catch (e) {
    console.error(e);
  }
})();
