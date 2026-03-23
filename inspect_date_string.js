const https = require('https');

const url = 'https://appswat.com/v2/api/v2/chapters/?order_by=-created_at&page_size=30';
https.get(url, {
  headers: { 'User-Agent': 'ktor-client' }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      if (json.results) {
         json.results.forEach(item => {
            const date = item.created_at_humanized;
            if (date) {
               let codes = [];
               for (let i=0; i<date.length; i++) {
                  codes.push(date.charCodeAt(i));
               }
               console.log(`[${date}] Code List: ${codes.join(', ')}`);
            }
         });
      }
    } catch (e) {
      console.log("Parse failed");
    }
  });
});
