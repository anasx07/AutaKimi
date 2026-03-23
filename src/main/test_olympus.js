const cheerio = require('cheerio');
const fs = require('fs');
const html = fs.readFileSync('olympus_manga.html', 'utf8');
const $ = cheerio.load(html);

console.log("Title:", $('h1').text().trim());
console.log("Cover Image:", $('img').map((i, el) => $(el).attr('src')).get().filter(src => src && src.includes('images/manga')).slice(0, 1));
console.log("Description:", $('.mb-6 p').text().trim() || $('.prose').text().trim());

const chapters = [];
$('.enhanced-chapters-grid .chapter-card').each((i, el) => {
    const $a = $(el).find('a.chapter-link');
    const href = $a.attr('href');
    const num = $(el).find('.chapter-number').text().trim();
    const sub = $(el).find('.chapter-title').text().trim();
    const date = $(el).find('.chapter-date').text().trim();
    if(href) chapters.push({href, title: num + (sub ? ' - ' + sub : ''), date});
});
console.log(chapters.slice(0,2));
