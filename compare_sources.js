const https = require('https');

async function test(host) {
  return new Promise((resolve) => {
    const url = `https://${host}/`;
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
      }
    };

    console.log(`\nFetching ${url}...`);
    https.get(url, options, (res) => {
      console.log(`[${host}] Status:`, res.statusCode);
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        console.log(`[${host}] Body length:`, data.length);
        if (data.includes('Just a moment')) console.log(`[${host}] ! Cloudflare detected`);
        resolve();
      });
    }).on('error', (err) => {
      console.error(`[${host}] Error:`, err.message);
      resolve();
    });
  });
}

async function main() {
  await test('lek-manga.net');
  await test('olympustaff.com');
}

main();
